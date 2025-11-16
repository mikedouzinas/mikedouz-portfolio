import { NextRequest, NextResponse } from 'next/server';
import { retrieve, diversifyByType, buildEvidencePacks, buildEvidenceSignals } from '@/lib/iris/retrieval';
import { loadContact, loadKBItems, buildAliasIndex, loadSkills } from '@/lib/iris/load';
import { type SignalSummary } from '@/lib/iris/signals';
import { irisCache } from '@/lib/iris/cache';
import { type KBItem, type PlannerResult, type EvidenceSignals } from '@/lib/iris/schema';
import { OpenAI } from 'openai';
import { config } from '@/lib/iris/config';
import { getRecentActivityContext } from '@/lib/iris/github';

// Ensure Node.js runtime for streaming support
export const runtime = 'nodejs';

/**
 * Simplified intent types after introducing structured filtering
 * 
 * Note: We removed redundant intents (list_projects, how_built, experience, classes, skills_for)
 * These are now handled by filter_query with appropriate filters, reducing code complexity
 */
type Intent =
  | 'contact'        // Fast-path for contact information (no LLM needed)
  | 'filter_query'   // Structured filtering (e.g., "Python projects", "2025 work", "ML classes")
  | 'specific_item'  // Query about a specific item (e.g., "tell me about HiLiTe")
  | 'personal'       // Personal/family questions (stories, values, interests, education, bio/headline)
  | 'general';       // Catch-all semantic search for everything else

/**
 * Structured filter for precise KB queries
 * Enables queries like "all Python projects" or "experiences from 2024"
 */
interface QueryFilter {
  type?: Array<'project' | 'experience' | 'class' | 'blog' | 'story' | 'value' | 'interest' | 'education' | 'bio' | 'skill'>;
  // Field-based filters
  skills?: string[];          // For any item with skills field
  company?: string[];         // For experiences
  year?: number[];            // Filter by year (works across all types)
  tags?: string[];            // General tags
  title_match?: string;       // For specific item queries (e.g., "APCS A", "HiLiTe")
  // Operations
  operation?: 'contains' | 'exact' | 'any';
  show_all?: boolean;         // Return all matches, not just top 5
}

/**
 * Enhanced intent detection result with optional filters
 */
interface IntentResult {
  intent: Intent;
  filters?: QueryFilter;
}

/**
 * Pre-routing function for fast evaluative/list query detection
 * Routes evaluative queries (best/strongest/what makes) to general intent
 * Routes explicit list queries to filter_query intent
 * Returns null if query should be processed by LLM classifier
 * 
 * Professional comment: This fast pre-routing improves latency by avoiding
 * LLM calls for obvious patterns, and ensures evaluative queries get proper
 * semantic search treatment rather than being misclassified.
 */
function preRoute(query: string): Intent | null {
  // Regex patterns for evaluative/comparative language
  const EVAL_REGEX = /\b(best|strongest|top|most|unique|what makes|why should|why .* hire|biggest|differen(t|ce))\b/i;
  
  // Regex patterns for explicit list queries
  const LIST_REGEX = /\b(list|show (me )?all|every|enumerate)\b/i;

  // Check for list queries first (more specific pattern)
  if (LIST_REGEX.test(query)) {
    return 'filter_query';
  }

  // Check for evaluative queries
  if (EVAL_REGEX.test(query)) {
    return 'general';
  }

  // No pre-routing match - defer to LLM classifier
  return null;
}

/**
 * Detects the user's intent using LLM-based classification with structured output
 * Returns both intent and optional filters for precise queries
 * Uses OpenAI's function calling for reliable structured responses
 * 
 * Professional comment: Now includes pre-routing for fast pattern matching before
 * expensive LLM classification, improving latency for common query patterns.
 */
async function detectIntent(query: string, openaiClient: OpenAI): Promise<IntentResult> {
  // Check pre-routing first (fast pattern matching)
  // Only use if evaluativeRoutingV2 feature is enabled
  if (config.features?.evaluativeRoutingV2) {
    const preRouted = preRoute(query);
    if (preRouted) {
      // Return early for pre-routed queries (no LLM needed)
      if (preRouted === 'general') {
        return { intent: 'general' };
      } else if (preRouted === 'filter_query') {
        return { intent: 'filter_query' };
      }
    }
  }
  try {
    // Create timeout promise for intent detection
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Intent detection timed out.')), config.openaiTimeoutMs);
    });

    // Use function calling for structured output with timeout
    const response = await Promise.race([
      openaiClient.chat.completions.create({
        model: config.models.query_processing,
        messages: [
          {
            role: 'system',
            content: `You are an intent classifier for queries about Mike (a software engineer/entrepreneur). Today is ${new Date().toISOString().split('T')[0]}.

# Knowledge Base Structure

The knowledge base contains these item types:
- **project**: Technical projects, applications, tools Mike has built (has: title, summary, skills, dates, tech_stack, architecture)
- **experience**: Work experience, internships, jobs (has: role, company, dates, skills, specifics)
- **class**: Academic courses taken (has: title, term, professor, skills, school)
- **blog**: Blog posts and articles written (has: title, summary, dates, tags)
- **story**: Personal background stories, family history (has: text, why)
- **value**: Core values and beliefs (has: value, why)
- **interest**: Hobbies and interests (has: interest, why)
- **education**: School/degree information (has: school, degree, gpa, expected_grad)
- **bio**: Biography and headline information (has: headline, bio, name)
- **skill**: Technical skills and technologies (has: name, type, aliases, description)

# Classification Rules

Follow these rules in order to determine intent:

## 1. CONTACT Intent
Use when query explicitly asks for contact information, ways to reach Mike, or communication methods.
Patterns: "contact", "email", "reach out", "get in touch", "linkedin", "how to contact", "message", "connect", "write a message", "send a message", "message mike", "write to mike", "send to mike"

## 2. SPECIFIC_ITEM Intent
Use when query asks about a SINGLE, SPECIFIC item by name/title.
Patterns: "tell me about [ITEM]", "how was [ITEM] built?", "when did [ITEM] happen?", "what is [ITEM]?"
Examples: "HiLiTe", "APCS A", "Veson internship", "IMOS laytime"
ALWAYS include title_match filter with the item name/title extracted from the query.

## 3. FILTER_QUERY Intent
Use when query asks for MULTIPLE items or a LIST of items matching certain criteria.
Key indicators: "list", "show me", "what [items]", "all [items]", "find", "search for", "discover"

**Type Filter Rules (Multiple types can be combined with OR logic):**
- If query explicitly mentions "projects" → type: ["project"]
- If query mentions "experience", "work", "jobs", "internships", "companies" → type: ["experience"]
- If query mentions "classes", "courses", "taken", "studied" → type: ["class"]
- If query mentions "blogs", "articles", "posts", "writing" → type: ["blog"]
- If query mentions "skills", "technologies", "tools", "knows" → type: ["skill"]
- If query mentions personal info like "values", "interests", "story", "background", "education", "school", "bio" → use PERSONAL intent instead

**Multi-Type Semantic Reasoning:**
When query uses action words or asks broadly about work, consider multiple types:
- "built", "created", "developed" WITHOUT explicit "project" mention → Often means both projects AND experiences (e.g., "what has Mike built?" → type: ["project", "experience"])
  Reason: "Built" includes both personal projects and professional work where things were built
- "what work" or "what has [Mike] done" → Consider type: ["project", "experience"] for comprehensive work overview
- "technical work" → Could span multiple types: ["project", "experience", "blog"] (technical content across all work)
- Skill-focused queries (e.g., "Python work") WITHOUT explicit type → Consider type: ["project", "experience"] to cover both personal and professional usage
- When user asks broadly about a skill/technology → Prefer multiple types over single type (e.g., "React" → projects AND experiences)

**Multi-Type Guidelines:**
- Multiple types use OR logic: items matching ANY listed type are included
- When in doubt between single vs multiple types, prefer broader inclusion (multiple types)
- Explicit type mentions (e.g., "projects", "experiences") should still be respected as user intent
- Skill-focused queries often benefit from multi-type search unless type is explicitly specified

**Skill Filter Rules:**
- If query mentions a specific technology/skill (e.g., "Python", "React", "ML", "NLP") → include in skills filter
- Extract skill names as mentioned in query (don't normalize yet)
- If no type filter specified but skills mentioned → search all types (omit type filter)
- When combining skills with types: if query asks about "work" with a skill (e.g., "Python work") → consider type: ["project", "experience"] to cover both personal and professional usage

**Time/Year Filter Rules:**
- If query mentions a specific year (e.g., "2024", "2025") → include in year filter
- If query mentions "recent", "latest", "current" → you may need to infer year, but prefer leaving empty for semantic search
- If query mentions time period (e.g., "this year", "last year") → extract and include year

**Company Filter Rules:**
- If query mentions a company name → include in company filter
- Only applies to experience items (but don't limit type filter if company is mentioned)

**Show All Rules:**
- If query asks for "all", "every", "list", "show me" → show_all: true
- If query asks "what" or "which" (multiple items expected) → show_all: true
- If query asks "has [Mike] done X" or "used X" → show_all: true
- Single specific question → show_all: false (limit to top results)

**Operation Rules:**
- "all of", "must have", "using" (strict) → operation: "exact"
- "any", "related to", "involving" (loose) → operation: "any"
- Default → operation: "contains"

## 4. PERSONAL Intent
Use when query asks about personal information, background, values, interests, education, or biography.
Patterns: "values", "interests", "story", "background", "education", "school", "degree", "bio", "headline", "name", "why"

## 5. GENERAL Intent
Use ONLY as fallback when query doesn't fit any specific intent and requires semantic search across all item types.
Typically for exploratory questions like "what technical work", "what has Mike done", "tell me about Mike's work"

# Decision Process

1. Does the query explicitly ask for contact info? → CONTACT
2. Does the query mention a specific item name/title? → SPECIFIC_ITEM (with title_match)
3. Does the query ask for a list or multiple items? → FILTER_QUERY (extract type, skills, year, company filters)
4. Does the query ask about personal/background information? → PERSONAL
5. Otherwise → GENERAL

# Critical Guidelines

- Be precise with filters: only include what the user explicitly or clearly implied
- When in doubt between filter_query and specific_item: if user mentions a name/title → specific_item, otherwise filter_query
- Always set show_all: true for queries asking for lists or "all" items
- Extract skill names as written (e.g., "Framer Motion" not "framer_motion") - normalization happens later
- For ambiguous queries, prefer more specific filters over general ones

# Multi-Type Query Examples

These examples demonstrate when and how to use multiple types:

**Example 1: Broad "built/created" queries**
- Query: "what has Mike built?" → filter_query with type: ["project", "experience"], show_all: true
  Reason: "Built" semantically includes both personal projects and professional work where things were built

**Example 2: Skill-focused work queries**
- Query: "what Python work has Mike done?" → filter_query with type: ["project", "experience"], skills: ["Python"], show_all: true
  Reason: Python might be used in both personal projects and professional experiences, so search both

**Example 3: Explicit single-type queries**
- Query: "what Python projects?" → filter_query with type: ["project"], skills: ["Python"]
  Reason: User explicitly said "projects", so respect that and only include projects

**Example 4: Technical work spanning content**
- Query: "what technical work in 2024?" → filter_query with type: ["project", "experience", "blog"], year: [2024], show_all: true
  Reason: "Technical work" could span projects, experiences, and technical blog posts

**Example 5: Comprehensive work overview**
- Query: "what has Mike done with React?" → filter_query with type: ["project", "experience"], skills: ["React"], show_all: true
  Reason: React usage could be in both projects and work experiences

**Example 6: Broad work discovery**
- Query: "discover what Mike's built" → filter_query with type: ["project", "experience"], show_all: true
  Reason: "Built" without explicit type should include both categories`
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: 0,
        tools: [{
          type: 'function',
          function: {
            name: 'classify_intent',
            description: 'Classify the query intent and extract structured filters. Use classification rules to determine intent, then extract any applicable filters based on what the user is asking for.',
            parameters: {
              type: 'object',
              properties: {
                intent: {
                  type: 'string',
                  enum: ['contact', 'filter_query', 'specific_item', 'personal', 'general'],
                  description: `Primary intent classification:
- 'contact': Query explicitly asks for contact information or ways to reach Mike
- 'filter_query': Query asks for multiple items matching criteria (list, show all, find items)
- 'specific_item': Query asks about ONE specific item by name/title (e.g., "tell me about HiLiTe")
- 'personal': Query asks about personal background, values, interests, education, or biography
- 'general': Fallback for exploratory queries requiring semantic search across all types`
                },
                filters: {
                  type: 'object',
                  properties: {
                    type: {
                      type: 'array',
                      items: { type: 'string', enum: ['project', 'experience', 'class', 'blog', 'story', 'value', 'interest', 'skill'] },
                      description: `Filter by document types. Multiple types can be combined (OR logic - matches ANY listed type). Only include if user explicitly mentions the type or it's clearly implied:
- 'project': For queries about things built, created, developed
- 'experience': For queries about work, jobs, internships, companies
- 'class': For queries about courses, classes, academic work
- 'blog': For queries about articles, posts, writing
- 'skill': For queries about skills, technologies, tools
- 'story', 'value', 'interest': Usually handled by 'personal' intent instead

Multi-type usage (combine with OR logic):
- For broad queries like "what has Mike built?" → type: ["project", "experience"] (includes both personal projects and professional work)
- For skill-focused queries without explicit type → type: ["project", "experience"] to cover both personal and professional usage
- For "technical work" → type: ["project", "experience", "blog"] to span multiple content types
- When user explicitly mentions a type (e.g., "projects"), respect that intent - don't add other types unless semantically appropriate

If user mentions skills but not types, omit this filter to search all types.`
                    },
                    skills: {
                      type: 'array',
                      items: { type: 'string' },
                      description: `Filter by skills/technologies mentioned in query. Extract skill names exactly as written (normalization happens later).
Examples: ["Python"], ["React"], ["Sentence Transformers"], ["Framer Motion"]
Use when query mentions specific technologies like "Python projects" or "where has Mike used React?"
If skills mentioned but no type specified, search all types by omitting type filter.`
                    },
                    company: {
                      type: 'array',
                      items: { type: 'string' },
                      description: `Filter by company names. Extract company names from query (e.g., ["Google"], ["Microsoft"]).
Use when query mentions specific companies like "work at Google" or "Veson internship".
Only applies to experience items, but don't limit type filter if company is mentioned.`
                    },
                    year: {
                      type: 'array',
                      items: { type: 'number' },
                      description: `Filter by year(s). Extract numeric years from query (e.g., [2024], [2023, 2024]).
Use when query mentions specific years like "2024 experiences" or "what did I do in 2025?"
For relative time like "recent" or "current", prefer omitting this filter for semantic search.`
                    },
                    tags: {
                      type: 'array',
                      items: { type: 'string' },
                      description: `Filter by tags. Rarely used - only if query explicitly mentions tags.
Most filtering should use type, skills, year, or company instead.`
                    },
                    title_match: {
                      type: 'string',
                      description: `Exact title/name of a specific item to find. REQUIRED for 'specific_item' intent.
Extract the item name from query (e.g., "HiLiTe", "APCS A", "Veson internship").
Use partial matching - extract the key identifier from the query, even if not exact.
This enables finding items by name when user asks "tell me about [ITEM]" or "how was [ITEM] built?"`
                    },
                    operation: {
                      type: 'string',
                      enum: ['contains', 'exact', 'any'],
                      default: 'contains',
                      description: `How to match filters:
- 'contains': Default - flexible matching (e.g., "React" matches "ReactJS")
- 'exact': Strict - all criteria must match exactly (for "must have all of X")
- 'any': Loose - matches if any criteria present (for "related to X or Y")`
                    },
                    show_all: {
                      type: 'boolean',
                      description: `Whether to return all matching results or limit to top results:
- true: For queries asking "list", "show all", "what [items]", "all [items]", "discover", or expecting multiple results
- false: For single specific questions where top results are sufficient
Set to true when user expects to see a comprehensive list of items.`
                    }
                  },
                  description: `Optional structured filters. Only include filters that are explicitly mentioned or clearly implied by the query.
For 'specific_item' intent, ALWAYS include title_match.
For 'filter_query' intent, include relevant filters (type, skills, year, company) based on query content.
For 'contact' intent, omit filters entirely.
For 'personal' or 'general' intents, filters are rarely needed.`
                }
              },
              required: ['intent']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'classify_intent' } }
      }),
      timeoutPromise
    ]);

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (toolCall && 'function' in toolCall && toolCall.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments) as IntentResult;
        return result;
    }

    // Fallback if parsing fails
    return { intent: 'general' };
  } catch (error) {
    console.warn('[Answer API] Intent classification failed, falling back to general:', error);
    return { intent: 'general' };
  }
}

/**
 * Optional micro-planner for alias resolution and retrieval planning
 * Only called when microPlannerEnabled is true and query meets heuristic criteria
 * Returns planner result with routing decision, entities, plan, and risk assessment
 * 
 * Professional comment: This lightweight planner helps resolve aliases and suggests
 * retrieval types/quotas, but is skipped for short/unambiguous queries to keep latency low.
 */
async function runMicroPlanner(
  query: string,
  openaiClient: OpenAI,
  aliasIndex: Array<{ id: string; type: string; name: string; aliases: string[] }>,
  preRoutedIntent: Intent | null
): Promise<PlannerResult | null> {
  // Skip planner if feature is disabled
  if (!config.features?.microPlannerEnabled) {
    return null;
  }

  // Skip planner for short queries (heuristic: < 6 tokens)
  const tokens = query.trim().split(/\s+/).length;
  if (tokens < 6) {
    return null;
  }

  // Skip planner if query lacks proper nouns/org-like cues (heuristic check)
  const hasProperNoun = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/.test(query) || 
                       /\b(?:Inc|LLC|Corp|Ltd|Co|Company|University|College|Institute)\b/i.test(query);
  
  if (!hasProperNoun) {
    return null;
  }

  try {
    // Build compact alias list (limit to N names closest to query length)
    // This keeps planner call token-efficient
    const queryLength = query.length;
    const sortedAliases = aliasIndex
      .sort((a, b) => Math.abs(a.name.length - queryLength) - Math.abs(b.name.length - queryLength))
      .slice(0, 30); // Limit to top 30 for token budget

    const aliasListText = sortedAliases
      .map(a => `- ${a.name} (${a.type})${a.aliases.length > 0 ? ` aliases: ${a.aliases.join(', ')}` : ''}`)
      .join('\n');

    // Create timeout promise for planner
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Planner timed out.')), config.openaiTimeoutMs);
    });

    const plannerPrompt = `You are a micro-planner for query routing and retrieval planning.

Query: "${query}"
${preRoutedIntent ? `Pre-routed intent: ${preRoutedIntent}` : ''}

Available aliases (names and aliases from knowledge base):
${aliasListText}

Task:
1. Determine final routed intent (honor pre-route if present, otherwise classify)
2. Identify entities mentioned (names that might match aliases)
3. Suggest retrieval plan (types to search, topK per type, need diversity)
4. Assess risk (entityLinkScore, coverageRatio)

Output JSON:
{
  "routedIntent": "contact|filter_query|specific_item|personal|general",
  "entities": [{"name": "...", "typeGuess": "...", "confidence": 0.0-1.0}],
  "plan": {
    "types": ["project", "experience", ...],
    "topKPerType": {"project": 3, "experience": 2},
    "needDiversity": true,
    "fields": ["title", "summary", "specifics", "dates", "skills", "metrics"]
  },
  "risk": {
    "entityLinkScore": 0.0-1.0,
    "coverageRatio": 0.0-1.0,
    "expectedConcepts": ["..."],
    "matchedConcepts": ["..."]
  }
}`;

    const response = await Promise.race([
      openaiClient.chat.completions.create({
        model: config.models.query_processing,
        messages: [
          { role: 'system', content: plannerPrompt },
          { role: 'user', content: query }
        ],
        temperature: 0,
        max_tokens: config.features.plannerTokenBudget.out,
      }),
      timeoutPromise
    ]);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn('[Answer API] Planner returned no content');
      return null;
    }

    // Parse JSON from response (may include markdown code blocks)
    let jsonText = content.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const plannerResult = JSON.parse(jsonText) as PlannerResult;
    return plannerResult;
  } catch (error) {
    console.warn('[Answer API] Planner failed:', error);
    return null;
  }
}

/**
 * Helper function to check if two strings are similar enough to match
 * Handles singular/plural, word order, and partial matches
 * 
 * Professional comment: This enables flexible matching for user queries like
 * "sentence transformer" to match "sentence transformers" or "React" to match "ReactJS"
 */
function isFuzzyMatch(search: string, target: string): boolean {
  const searchWords = search.split(/\s+/);
  const targetWords = target.split(/\s+/);

  // Exact match
  if (search === target) return true;

  // One contains the other
  if (target.includes(search) || search.includes(target)) return true;

  // Check if all search words are present in target (handles word order)
  const allWordsPresent = searchWords.every(sw =>
    targetWords.some(tw => tw.includes(sw) || sw.includes(tw))
  );
  if (allWordsPresent) return true;

  // Handle plural/singular by checking if words match except for trailing 's'
  const searchStripped = search.endsWith('s') ? search.slice(0, -1) : search;
  const targetStripped = target.endsWith('s') ? target.slice(0, -1) : target;
  if (searchStripped === targetStripped) return true;
  if (target.includes(searchStripped) || search.includes(targetStripped)) return true;

  return false;
}

/**
 * Resolves skill names/aliases to their canonical skill IDs
 * Handles fuzzy matching for names like "framer motion" → "framer_motion"
 * 
 * @param skillNames - Array of skill names or aliases from user query
 * @param allItems - All KB items (includes skills with kind: "skill")
 * @returns Array of matching skill IDs
 * 
 * Professional comment: This function enables users to query by skill names
 * (e.g., "Framer Motion") instead of requiring exact ID matches (e.g., "framer_motion").
 * It fuzzy-matches against skill names, IDs, and aliases to maximize query success.
 */
function resolveSkillNamesToIds(skillNames: string[], allItems: KBItem[]): string[] {
  // Extract all skills from KB items
  const skills = allItems.filter(item => item.kind === 'skill') as Array<KBItem & {
    id: string;
    name: string;
    aliases?: string[];
  }>;

  const resolvedIds = new Set<string>();

  for (const searchName of skillNames) {
    const searchLower = searchName.toLowerCase().trim();

    for (const skill of skills) {
      // Match against skill ID (with underscores or hyphens normalized to spaces)
      const skillIdNormalized = skill.id.toLowerCase().replace(/[_-]/g, ' ');

      // Match against skill name
      const skillNameLower = skill.name.toLowerCase();

      // Match against aliases
      const aliasesLower = (skill.aliases || []).map(a => a.toLowerCase());

      // Check if search matches ID, name, or any alias using fuzzy matching
      if (
        isFuzzyMatch(searchLower, skillIdNormalized) ||
        isFuzzyMatch(searchLower, skillNameLower) ||
        aliasesLower.some(alias => isFuzzyMatch(searchLower, alias))
      ) {
        resolvedIds.add(skill.id);
      }
    }
  }

  return Array.from(resolvedIds);
}

/**
 * Applies structured filters to KB items
 * Enables precise queries like "all Python projects" or "2024 experiences"
 * 
 * @param items - All KB items to filter
 * @param filters - Structured filters from intent detection
 * @returns Filtered items matching all criteria
 * 
 * Professional comment: We keep a reference to the original unfiltered items
 * to enable skill name resolution even after type filtering has been applied.
 */
function applyFilters(items: KBItem[], filters: QueryFilter): KBItem[] {
  const allItems = items; // Keep reference to all items for skill resolution
  let filtered = items;

  // Filter by document type
  if (filters.type && filters.type.length > 0) {
    filtered = filtered.filter(item => filters.type!.includes(item.kind));
  }

  // Filter by title match (for specific item queries)
  if (filters.title_match) {
    const searchTitle = filters.title_match.toLowerCase();
    filtered = filtered.filter(item => {
      // Check title field
      if ('title' in item && item.title) {
        return item.title.toLowerCase().includes(searchTitle);
      }
      // Check role/company for experiences
      if ('role' in item && item.role) {
        const fullTitle = `${item.role} ${item.company || ''}`.toLowerCase();
        return fullTitle.includes(searchTitle);
      }
      // Check value/interest names
      if ('value' in item && item.value) {
        return item.value.toLowerCase().includes(searchTitle);
      }
      if ('interest' in item && item.interest) {
        return item.interest.toLowerCase().includes(searchTitle);
      }
      return false;
    });
  }

  // Filter by skills (works for any item with skills field)
  // Professional comment: Resolves skill names to IDs before matching, enabling
  // queries like "projects using Framer Motion" to match items with "framer_motion" ID
  if (filters.skills && filters.skills.length > 0) {
    // Resolve skill names to canonical IDs using the KB
    // Use allItems (not filtered) to ensure skills are available for resolution
    const resolvedSkillIds = resolveSkillNamesToIds(filters.skills, allItems);

    // If no skills resolved, try direct matching as fallback
    const searchSkills = resolvedSkillIds.length > 0
      ? resolvedSkillIds.map(s => s.toLowerCase())
      : filters.skills.map(s => s.toLowerCase());

    filtered = filtered.filter(item => {
      if (!('skills' in item) || !Array.isArray(item.skills)) return false;

      const itemSkills = item.skills.map(s => s.toLowerCase());

      if (filters.operation === 'exact') {
        return searchSkills.every(s => itemSkills.includes(s));
      } else if (filters.operation === 'any') {
        return searchSkills.some(s => itemSkills.includes(s));
      } else { // 'contains' (default)
        return searchSkills.some(s => itemSkills.some(is => is.includes(s)));
      }
    });
  }

  // Filter by company (experiences)
  if (filters.company && filters.company.length > 0) {
    filtered = filtered.filter(item => {
      if (!('company' in item) || !item.company) return false;

      const company = item.company.toLowerCase();
      const searchCompanies = filters.company!.map(c => c.toLowerCase());

      return searchCompanies.some(c => company.includes(c));
    });
  }

  // Filter by year (extract from dates field or term field)
  // Note: We prioritize date ranges to check if the year falls within the project/experience period
  if (filters.year && filters.year.length > 0) {
    filtered = filtered.filter(item => {
      // Check start/end dates for projects and experiences
      // A year matches if it falls within the start-end range
      if ('dates' in item && item.dates) {
        const startYear = parseInt(item.dates.start.split('-')[0]);
        const endYear = item.dates.end ? parseInt(item.dates.end.split('-')[0]) : new Date().getFullYear();

        return filters.year!.some(y => y >= startYear && y <= endYear);
      }

      // Check term field for classes (e.g., "Spring 2025")
      if ('term' in item && item.term && typeof item.term === 'string') {
        const yearMatch = item.term.match(/\d{4}/);
        if (yearMatch) {
          const year = parseInt(yearMatch[0]);
          return filters.year!.includes(year);
        }
      }

      return false;
    });
  }

  // Filter by tags
  if (filters.tags && filters.tags.length > 0) {
    filtered = filtered.filter(item => {
      if (!('tags' in item) || !Array.isArray(item.tags)) return false;

      const itemTags = item.tags.map(t => t.toLowerCase());
      const searchTags = filters.tags!.map(t => t.toLowerCase());

      if (filters.operation === 'exact') {
        return searchTags.every(t => itemTags.includes(t));
      } else if (filters.operation === 'any') {
        return searchTags.some(t => itemTags.includes(t));
      } else { // 'contains'
        return searchTags.some(t => itemTags.some(it => it.includes(t)));
      }
    });
  }

  return filtered;
}

/**
 * Field mapping for each intent type
 * With simplified intents, most use all fields for maximum context quality
 */
const FIELD_MAP: Record<Intent, string[]> = {
  contact: [],         // Fast-path, handled separately
  filter_query: [],    // All fields - determined by the specific filter
  specific_item: [],   // All fields - complete info for specific items
  personal: [],        // All fields from profile (stories, values, interests)
  general: []          // All fields - let semantic search find what's relevant
};

/**
 * Document type filtering for each intent
 * With structured filtering, most intents either use filters or search everything
 */
const TYPE_FILTERS: Record<Intent, Array<'project' | 'experience' | 'class' | 'blog' | 'story' | 'value' | 'interest' | 'education' | 'bio' | 'skill'> | null> = {
  contact: null,                                             // Fast-path, no retrieval needed
  filter_query: null,                                        // Types determined by filters
  specific_item: null,                                       // Search all types for specific items
  personal: ['story', 'value', 'interest', 'education', 'bio'],  // Personal/family info including education and bio
  general: null                                              // Search all types - let semantic search decide
};

/**
 * Calculates a technical complexity score for an experience
 * Used to boost technically challenging work in results
 * 
 * Factors considered:
 * - AI/ML keywords (document AI, NLP, embeddings, transformers, etc.)
 * - Algorithmic complexity (rule engines, optimization, search algorithms)
 * - Data scale (100k+ records, batch processing, etc.)
 * - Low-level systems (C#/.NET, assembly, hardware)
 */
function getTechnicalScore(doc: Partial<KBItem>): number {
  if (!('summary' in doc) || !doc.summary) return 0;

  const text = (doc.summary + ' ' + ('specifics' in doc && Array.isArray(doc.specifics) ? doc.specifics.join(' ') : '')).toLowerCase();

  let score = 0;

  // AI/ML indicators (+3 each)
  if (/(document ai|nlp|embeddings|transformers|faiss|sentence|gpt|neural|deep learning)/i.test(text)) score += 3;

  // Algorithmic complexity (+2 each)
  if (/(algorithm|optimization|rule engine|search|similarity|clustering|matching|pipeline)/i.test(text)) score += 2;

  // Data scale (+2 each)
  if (/(100\+|600k|batch|parallel|throughput|scale|automation)/i.test(text)) score += 2;

  // Low-level/systems programming (+1 each)
  if (/(c#|\.net|assembly|hardware|cpu|memory)/i.test(text)) score += 1;

  return score;
}

/**
 * Reranks results to prioritize technically complex experiences for technical queries
 * Only applies boosting if the query seems technical in nature
 */
function reranktechnical(results: Array<{ score: number; doc: Partial<KBItem> }>, query: string): Array<{ score: number; doc: Partial<KBItem> }> {
  const queryLower = query.toLowerCase();

  // Check if query is asking about technical work
  const isTechnicalQuery = /(technical|tech|engineer|build|develop|algorithm|ml|ai|data|code|system)/i.test(queryLower);

  if (!isTechnicalQuery) return results; // No reranking needed

  // Boost experiences by their technical score
  return results.map(r => {
    if ('kind' in r.doc && r.doc.kind === 'experience') {
      const techScore = getTechnicalScore(r.doc);
      // Boost score by up to 20% based on technical complexity
      const boost = 1 + (techScore * 0.03);
      return { ...r, score: r.score * boost };
    }
    return r;
  }).sort((a, b) => b.score - a.score); // Re-sort after boosting
}

/**
 * Resolves skill IDs to their display names
 * Creates a lookup map from skill ID to skill name for fast resolution
 * 
 * Professional comment: This function resolves skill IDs (e.g., "python", "react") 
 * to their proper names (e.g., "Python", "React") so Iris responses use readable names
 * instead of technical IDs.
 */
async function buildSkillNameMap(): Promise<Map<string, string>> {
  const skills = await loadSkills();
  const skillMap = new Map<string, string>();
  for (const skill of skills) {
    skillMap.set(skill.id.toLowerCase(), skill.name);
  }
  return skillMap;
}

/**
 * Resolves an array of skill IDs to their display names
 * Falls back to the ID if no match is found
 */
function resolveSkillIdsToNames(skillIds: string[], skillMap: Map<string, string>): string[] {
  return skillIds.map(id => {
    const name = skillMap.get(id.toLowerCase());
    return name || id; // Fallback to ID if not found
  });
}

/**
 * Formats retrieved documents into a clean, structured context string
 * This structured format helps the LLM extract relevant information accurately
 * Handles different KBItem types (Project, Experience, Class, Blog, Story) with varying schemas
 * 
 * @param docs - Array of KB items to format
 * @param includeDetails - If false, only includes title/summary (for list queries)
 * @param detailLevel - 'minimal' = name + summary only, 'standard' = + skills, 'full' = everything
 * @param skillMap - Optional map of skill ID to skill name for resolving skill IDs
 */
function formatContext(docs: Array<Partial<KBItem>>, includeDetails: boolean = true, detailLevel: 'minimal' | 'standard' | 'full' = 'full', skillMap?: Map<string, string>): string {
  return docs
    .map(d => {
      const parts: string[] = [];

      // Display name varies by type - include dates/years for context
      let displayName = '';
      let dateInfo = '';

      // Extract date information based on item type
      if ('dates' in d && d.dates) {
        const endDate = d.dates.end || 'Present';
        dateInfo = ` (${d.dates.start} – ${endDate})`;
      } else if ('term' in d && d.term) {
        dateInfo = ` (${d.term})`;
      }

      // Build the display name
      if ('title' in d && d.title) {
        displayName = d.title;
      } else if ('role' in d && d.role) {
        displayName = `${d.role}${('company' in d && d.company) ? ` at ${d.company}` : ''}`;
      } else if ('value' in d && d.value) {
        displayName = `Value: ${d.value}`;
      } else if ('interest' in d && d.interest) {
        displayName = `Interest: ${d.interest}`;
      } else if ('school' in d && d.school) {
        // Education items - show school and degree
        displayName = `Education: ${d.school}`;
        if ('degree' in d && d.degree) {
          displayName += ` – ${d.degree}`;
        }
      } else if ('headline' in d && d.headline) {
        // Bio items - use the headline as display name
        displayName = `Bio`;
      } else {
        displayName = d.id || 'Unknown';
      }

      parts.push(`• ${displayName}${dateInfo}`);

      // Add summary/text/why - different types use different fields
      if ('summary' in d && d.summary) {
        parts.push(`  - ${d.summary}`);
      } else if ('text' in d && d.text) {
        parts.push(`  - ${d.text}`);
      } else if ('why' in d && d.why) {
        parts.push(`  - ${d.why}`);
      } else if ('headline' in d && d.headline) {
        // For bio items, show headline and bio text
        parts.push(`  - Headline: ${d.headline}`);
        if ('bio' in d && d.bio) {
          parts.push(`  - Bio: ${d.bio}`);
        }
        if ('name' in d && d.name) {
          parts.push(`  - Name: ${d.name}`);
        }
      } else if ('school' in d && d.school) {
        // For education items without summary, show GPA and graduation date
        if ('gpa' in d && d.gpa) {
          parts.push(`  - GPA: ${d.gpa}`);
        }
        if ('expected_grad' in d && d.expected_grad) {
          parts.push(`  - Expected Graduation: ${d.expected_grad}`);
        }
      }

      // Handle detail levels:
      // - minimal: Just name + summary (for broad filter queries)
      // - standard: + skills (for filter queries that need context)
      // - full: Everything (for specific queries or semantic retrieval)

      if (detailLevel === 'minimal' || !includeDetails) {
        return parts.join('\n');
      }

      // Add skills for standard and full detail levels
      if ('skills' in d && Array.isArray(d.skills) && d.skills.length > 0) {
        // Resolve skill IDs to names if skillMap is provided
        const skillNames = skillMap 
          ? resolveSkillIdsToNames(d.skills as string[], skillMap)
          : d.skills as string[];
        parts.push(`  - Skills: ${skillNames.join(', ')}`);
      }

      // Only include specifics, architecture, and tech_stack for full detail level
      if (detailLevel === 'full') {
        // Include up to 4 specific details (not all types have this)
        if ('specifics' in d && Array.isArray(d.specifics)) {
          for (const s of d.specifics.slice(0, 4)) parts.push(`  - ${s}`);
        }

        // Add technical details for architecture-focused queries (projects)
        if ('architecture' in d && d.architecture) {
          parts.push(`  - Architecture: ${d.architecture}`);
        }

        if ('tech_stack' in d && Array.isArray(d.tech_stack) && d.tech_stack.length > 0) {
          parts.push(`  - Tech Stack: ${d.tech_stack.join(', ')}`);
        }
      }

      return parts.join('\n');
    })
    .join('\n\n');
}

/**
 * Creates a fallback response when no relevant context is found
 * Loads contact information and returns a helpful message directing users to reach out
 * This prevents hallucination when the knowledge base has no matching information
 */
async function createNoContextResponse(): Promise<Response> {

  try {
    const contact = await loadContact();
    const fallbackMessage = 
      `I don't have specific information about that in my knowledge base.\n\n` +
      `💼 LinkedIn: ${contact.linkedin}\n` +
      (contact.github ? `💻 GitHub: ${contact.github}\n` : '') +
      (contact.booking?.enabled && contact.booking?.link ? `📅 Schedule a chat: ${contact.booking.link}\n` : '') +
      `\nFeel free to ask me about Mike's projects, work experience, education, or technical skills!\n\n<ui:contact reason="insufficient_context" draft="Can you provide more details about what you'd like to know?" />`;

    // Return as streaming response for consistent client behavior
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: fallbackMessage })}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    console.error('[Answer API] Failed to create fallback response:', error);

    // Minimal fallback if contact loading fails
    const minimalFallback = `I don't have specific information about that in my knowledge base. Feel free to reach out to Mike directly through the contact section of this website for more details!\n\n<ui:contact reason="insufficient_context" draft="Can you provide more details about what you'd like to know?" />`;

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: minimalFallback })}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  }
}


/**
 * POST /api/iris/answer
 * Main answer endpoint with intent-based routing, streaming, and error handling
 */
export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body = await req.json();
    const query = body.query || body.q;
    const signalsParam = body.signals || '{}';

    // Validate query parameter
    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json(
        { error: "Missing 'query' parameter" },
        { status: 400 }
      );
    }

    // Check for required environment variables
    // This helps diagnose configuration issues early
    if (!process.env.OPENAI_API_KEY) {
      console.error('[Answer API] OPENAI_API_KEY environment variable is not set');
      return NextResponse.json({
        answer: "I'm currently unavailable. The API configuration is incomplete. Please contact the site administrator.",
        sources: [],
        cached: false,
        error: true,
        errorType: 'configuration',
        timing: Date.now()
      }, { status: 500 });
    }


    // Parse user signals for future RAG personalization
    // Note: signals are parsed but not currently used - reserved for future RAG personalization
    try {
      const parsedSignals = typeof signalsParam === 'string' ? JSON.parse(signalsParam) : signalsParam;
      // signals = parsedSignals; // Reserved for future use
    } catch (e) {
      console.warn('[Answer API] Failed to parse signals:', e);
    }

    // Initialize OpenAI client for intent detection and answer generation
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    // Check pre-routing first (fast pattern matching)
    const preRouted = config.features?.evaluativeRoutingV2 ? preRoute(query) : null;
    
    // Detect intent for optimized field filtering using LLM-based classification
    const intentResult = await detectIntent(query, openai);
    let { intent } = intentResult;
    const { filters } = intentResult;
    
    // Override intent if pre-routing found a match (unless contact explicit)
    if (preRouted && intent !== 'contact') {
      intent = preRouted;
    }

    // Load alias index for micro-planner (if enabled)
    let aliasIndex: Array<{ id: string; type: string; name: string; aliases: string[] }> = [];
    let planner: PlannerResult | null = null;
    
    if (config.features?.microPlannerEnabled) {
      const allItems = await loadKBItems();
      aliasIndex = buildAliasIndex(allItems);
      
      // Run micro-planner if enabled and query meets criteria
      planner = await runMicroPlanner(query, openai, aliasIndex, preRouted);
      
      // Use planner intent if planner returned a different intent and entityLinkScore is high
      if (planner && planner.routedIntent !== intent) {
        if (planner.risk.entityLinkScore >= 0.7) {
          intent = planner.routedIntent;
        } else {
        }
      }
      
      // For specific_item, require confident name match
      if (intent === 'specific_item' && planner && planner.risk.entityLinkScore < 0.7) {
        intent = 'general';
      }
    }

    const fields = FIELD_MAP[intent] || []; // Fallback to empty array for unknown intents

    // Check cache for previously answered queries (1 hour TTL)
    const cacheKey = `answer:${query}:${intent}`;
    const cached = await irisCache.get(cacheKey);

    if (cached) {

      try {
        const cachedData = JSON.parse(cached);

        // Return cached response as stream for consistent client behavior
        const encoder = new TextEncoder();
        const readable = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: cachedData.answer, cached: true })}\n\n`));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          }
        });

        return new Response(readable, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          }
        });
      } catch (e) {
        console.warn('[Answer API] Failed to parse cached data:', e);
        // Continue to generate fresh answer
      }
    }

    // Handle contact intent - fast path that returns contact info with UI directive
    if (intent === 'contact') {
      // Check if user wants to write/send a message
      const wantsToMessage = /\b(write|send|message|contact|reach out|get in touch)\b.*\b(mike|you|him)\b/i.test(query);
      
      // Extract the topic/subject from the query for the draft
      let draftMessage = '';
      if (wantsToMessage) {
        // Try to extract what they want to message about
        const aboutMatch = query.match(/\b(about|regarding|concerning|for)\s+(.+?)(?:\s+and|\s+how|\s+that|$)/i);
        if (aboutMatch && aboutMatch[2]) {
          const topic = aboutMatch[2].trim();
          // Create draft from user's perspective
          draftMessage = `I want to discuss ${topic}${query.includes('fix') || query.includes('help') ? ' and how you can help' : ''}`;
        } else {
          // Fallback: use the query itself as context
          const cleanQuery = query.replace(/\b(write|send|a message to|message|contact|reach out to|get in touch with)\s+(mike|you|him)\s+(about|regarding)?\s*/gi, '').trim();
          if (cleanQuery) {
            draftMessage = `I want to discuss ${cleanQuery}`;
          } else {
            draftMessage = 'I\'d like to get in touch';
          }
        }
      }
      
      const contact = await loadContact();
      const contactMessage = 
        `Here's how you can reach Mike:\n\n` +
        `💼 LinkedIn: ${contact.linkedin}\n` +
        (contact.github ? `💻 GitHub: ${contact.github}\n` : '') +
        (contact.booking?.enabled && contact.booking?.link ? `📅 Schedule a chat: ${contact.booking.link}\n` : '') +
        (contact.email ? `📧 Email: ${contact.email}\n` : '') +
        (wantsToMessage ? `\n<ui:contact reason="user_request" draft="${draftMessage}" />` : '');
      
      // Return as streaming response
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: contactMessage })}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    }

    let context: string;
    let results: Array<{ score: number; doc: Partial<KBItem> }> = [];
    let isEvaluative = false; // Track if query is evaluative for evidence signal building
    
    // Load skills once for ID-to-name resolution (cached for performance)
    const skillMap = await buildSkillNameMap();

    // Handle filter queries and specific item queries - use structured filtering instead of semantic search
    if ((intent === 'filter_query' || intent === 'specific_item') && filters) {

      // Load all KB items for filtering
      const { loadKBItems } = await import('@/lib/iris/load');
      const allItems = await loadKBItems();

      // Apply structured filters
      const filteredItems = applyFilters(allItems, filters);

      // Convert to results format for consistency
      results = filteredItems.map((doc, idx) => ({
        score: 1 - (idx * 0.01), // Arbitrary scores for ordering
        doc: doc as Partial<KBItem>
      }));

      // Determine if we should show all results or limit
      const limit = filters.show_all ? results.length : 10; // Show more for filter queries
      results = results.slice(0, limit);


      // If no results found, return fallback response with contact info instead of generating with LLM
      // This prevents hallucination when there's no matching context
      if (results.length === 0) {
        return await createNoContextResponse();
      }

      // For specific_item queries with exactly one match, we can return direct info
      if (intent === 'specific_item' && results.length === 1) {
        const item = results[0].doc;

        // Generate a direct answer based on the query type
        if (query.toLowerCase().includes('when')) {
          // Handle "when" questions
          let timeInfo = '';
          if ('term' in item && item.term) {
            timeInfo = item.term;
          } else if ('dates' in item && item.dates) {
            timeInfo = `${item.dates.start} - ${item.dates.end || 'present'}`;
          } else if ('year' in item && item.year) {
            timeInfo = item.year.toString();
          }

          if (timeInfo) {
            // Return direct answer for time-based questions
            const itemName = ('title' in item && item.title) ||
              ('role' in item && item.role) ||
              item.id;
            const answer = `${itemName}: ${timeInfo}`;

            // Send as streaming response without LLM
            const encoder = new TextEncoder();
            const readable = new ReadableStream({
              start(controller) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: answer })}\n\n`));
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
              }
            });

            return new Response(readable, {
              headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
              }
            });
          }
        }

        // For other specific queries, include all details
        context = formatContext(results.map(r => r.doc), true, 'full', skillMap);
      } else {
        // For filter queries with multiple results, use standard detail (summary + skills, no specifics)
        // This prevents the LLM from getting overwhelmed and focusing on one item
        context = formatContext(results.map(r => r.doc), true, 'standard', skillMap);
      }
    } else {
      // Standard semantic retrieval for other intents
      const typeFilter = TYPE_FILTERS[intent] || null; // Fallback to null for unknown intents
      
      // Check if this is an evaluative query (best/strongest/what makes)
      isEvaluative = config.features?.evaluativeRoutingV2 && 
                           (intent === 'general' || preRouted === 'general') &&
                           /\b(best|strongest|top|most|unique|what makes|why should|why .* hire|biggest|differen(t|ce))\b/i.test(query);
      
      // For evaluative queries, expand scope to projects+experience (+classes if academic)
      let retrievalTypes: Array<'project' | 'experience' | 'class' | 'blog' | 'story' | 'value' | 'interest' | 'education' | 'bio' | 'skill'> | undefined;
      let quotas: Record<string, number> | undefined;
      
      if (isEvaluative) {
        // Expand scope for evaluative queries
        const hasAcademic = /\b(class|course|academic)\b/i.test(query);
        retrievalTypes = hasAcademic ? ['project', 'experience', 'class'] : ['project', 'experience'];
        
        // Use planner quotas if available, otherwise use config defaults
        if (planner?.plan.topKPerType) {
          quotas = planner.plan.topKPerType as Record<string, number>;
        } else {
          quotas = config.features?.perTypeQuotas || { project: 3, experience: 2 };
          if (hasAcademic && config.features?.perTypeQuotas?.class) {
            quotas.class = config.features.perTypeQuotas.class;
          }
        }
        
      } else if (typeFilter && typeFilter.length > 0) {
        retrievalTypes = typeFilter;
      }

      const retrievalOptions: { topK: number; fields: string[]; types?: Array<'project' | 'experience' | 'class' | 'blog' | 'story' | 'value' | 'interest' | 'education' | 'bio' | 'skill'> } = {
        topK: config.features?.generalTopK ?? 5,
        fields: isEvaluative ? ['title', 'summary', 'specifics', 'dates', 'skills'] : fields
      };

      // Add type filtering if specified
      if (retrievalTypes && retrievalTypes.length > 0) {
        retrievalOptions.types = retrievalTypes;
      }

      const retrievalResults = await retrieve(query, retrievalOptions);
      results = retrievalResults.results;


      // If we have no results, use fallback response with contact info
      // The anti-hallucination instructions in the system prompt are strong enough to prevent
      // making things up when context quality is low, so we only fall back on truly empty results
      if (results.length === 0) {
        return await createNoContextResponse();
      }

      // For evaluative queries, diversify results across types
      if (isEvaluative && quotas) {
        // Map results to format expected by diversifyByType
        const resultsWithType = results.map(r => ({
          ...r,
          type: r.doc.kind || 'unknown'
        }));
        
        const diversified = diversifyByType(resultsWithType, quotas);
        results = diversified.map(r => ({
          score: r.score,
          doc: r.doc
        }));
        
      }

      // Rerank results to prioritize technically complex experiences for technical queries
      // This ensures IMOS laytime, Parsons, VesselsValue appear first for tech questions
      results = reranktechnical(results, query);

      // For evaluative queries, build evidence packs for compact context
      if (isEvaluative) {
        const evidencePacks = buildEvidencePacks(results, skillMap);
        // Format evidence packs into compact context
        context = evidencePacks.map(pack => {
          const parts = [`• ${pack.title}`];
          if (pack.dates) {
            parts.push(`  Dates: ${pack.dates.start}${pack.dates.end ? ` - ${pack.dates.end}` : ''}`);
          }
          parts.push(`  ${pack.summary}`);
          if (pack.specifics && pack.specifics.length > 0) {
            pack.specifics.forEach(s => parts.push(`  - ${s}`));
          }
          if (pack.skills && pack.skills.length > 0) {
            parts.push(`  Skills: ${pack.skills.slice(0, 5).join(', ')}`);
          }
          if (pack.metrics && pack.metrics.length > 0) {
            parts.push(`  Metrics: ${pack.metrics.join(', ')}`);
          }
          return parts.join('\n');
        }).join('\n\n');
      } else {
        // Format documents into structured context with full details
        // The LLM will decide what level of detail to include in its response
        context = formatContext(results.map(r => r.doc), true, 'full', skillMap);
      }
    }


    // Get recent GitHub activity for additional context (production only)
    let recentActivity: string | null = null;
    if (process.env.NODE_ENV === 'production') {
      try {
        recentActivity = await getRecentActivityContext();
      } catch (error) {
        console.warn('[Answer API] GitHub activity fetch failed:', error);
        // Continue without GitHub context
      }
    }

    // Load contact information to include in context
    // This allows Iris to automatically reference contact info when relevant
    let contactInfo: string | null = null;
    try {
      const contact = await loadContact();
      const contactParts: string[] = [];
      contactParts.push(`LinkedIn: ${contact.linkedin}`);
      if (contact.github) {
        contactParts.push(`GitHub: ${contact.github}`);
      }
      if (contact.booking?.enabled && contact.booking?.link) {
        contactParts.push(`Schedule a chat: ${contact.booking.link}`);
      }
      if (contact.email) {
        contactParts.push(`Email: ${contact.email}`);
      }
      contactInfo = contactParts.join('\n');
    } catch (error) {
      console.warn('[Answer API] Failed to load contact info:', error);
      // Continue without contact info
    }

    // Build enhanced context with optional GitHub activity and contact info
    let enhancedContext = context;
    if (recentActivity) {
      enhancedContext += `\n\nRecent Development Activity:\n${recentActivity}`;
    }
    if (contactInfo) {
      enhancedContext += `\n\nContact Information:\n${contactInfo}`;
    }

    try {
      // Create streaming chat completion (OpenAI client already initialized)

      // Check if using o-series reasoning model (o1, o3, o4, etc.) or gpt-5+ models
      // These models have strict requirements: only temperature=1 (default), and require max_completion_tokens
      // Note: gpt-5-nano and other gpt-5+ models use the new API format with max_completion_tokens
      const isReasoningModel = /^o[0-9]/.test(config.models.chat.toLowerCase()) ||
        /^gpt-5/.test(config.models.chat.toLowerCase()) ||
        /^gpt-6/.test(config.models.chat.toLowerCase());

      // Build system prompt with anti-hallucination instructions
      const systemPrompt = `You are **Iris**, the on-site assistant on mikeveson.com. You know you are Iris. Your job is to help simplify, help, and anticipate the needs of visitors to experience Mike's work, skills, projects, and writing using ONLY the context you're given. Be warm, concise, and useful.

# Voice & Length
- Tone: friendly, human, no corporate jargon
- Length: 2–3 short paragraphs max (or fewer when a list is clearer)
- Never pad with filler; prioritize signal over breadth
- Avoid phrases like "from the details provided" or "based on the information" - just state facts directly

# Truth & Safety (Zero Hallucinations)
- Use ONLY facts in the context. Do NOT invent projects, roles, dates, skills, links, people, or claims.
- If context is insufficient, say so plainly, offer 1–2 focused follow-ups you can answer.
- If you mention links, they MUST match the exact URLs shown in context.

# Answering Rules
- Answer the user's question directly first.
- If context spans multiple items, synthesize across them (group by theme, timeline, or impact).
- Prefer concrete outcomes, metrics, technologies, and Mike's role when present.
- When dates exist, state them; otherwise avoid implying timeframes.
- If user asks for comparisons or summaries, give a tight, structured overview first, then a short suggestion for where to dig deeper.

# Evaluative & Comparative Queries
When asked for "best", "strongest", "unique", "what makes…", "top", "most", or "why X should…", synthesize across the evidence. Prefer concrete signals: (1) frequency across items, (2) measurable outcomes (metrics), (3) scale/complexity, (4) recency, and (5) unique combinations. Cite supporting items by title inline, concisely. If evidence is thin or uncertain, say so briefly and consider adding a single <ui:contact ... /> directive per the UI directive policy.

# Contact Information
- Contact info (LinkedIn, GitHub, email, booking link) is available in the context
- You can naturally reference these when relevant (e.g., "You can find more on his GitHub" or "Feel free to reach out on LinkedIn")
- Include contact info when it directly answers the question or when suggesting collaboration/connection

# Contact vs Explore (UI Directive Contract)
Only suggest contacting Mike when one of these is true:
  1) Personal opinions/preferences/background not in context
  2) Collaboration / hiring / partnership / speaking requests
  3) Future plans or non-public roadmaps
  4) Context truly insufficient after a suggested follow-up
  5) User explicitly wants to write/send a message to Mike (e.g., "write a message", "send a message", "message Mike about X")

**IMPORTANT: When user wants to write/send a message:**
- DO NOT write the message text in your response
- Instead, immediately add: <ui:contact reason="user_request" draft="[user's message topic/request]" />
- The draft should be a short summary of what the user wants to message about (from the USER's perspective, using "you")
- Example: If user says "write a message to mike about insanitary water systems", use draft="I want to discuss insanitary water systems and how you can help fix them"

When suggesting contact, you can:
- Naturally mention contact methods from the context (LinkedIn, GitHub, email, booking link)
- Add a <ui:contact ... /> directive with an appropriate draft message when deeper conversation is needed
- Draft messages should be from the USER to Mike (use "you", never third person)

Otherwise, guide exploration: propose 1–3 precise follow-ups Iris can answer from context (e.g., "Ask about Iris details" or "Want the HiLiTe sports analytics project stack?").
# Today
Today's date: ${new Date().toISOString().split('T')[0]}

# Context (authoritative; may include multiple items)
${enhancedContext}`;

      // Build base request parameters
      // Using Record for type safety while allowing dynamic properties
      const requestParams: Record<string, unknown> = {
        model: config.models.chat,
        stream: true,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: query
          }
        ]
      };

      // Log the complete prompt for debugging

      // Apply model-specific parameters
      // O-series reasoning models and gpt-5+ models have different parameter requirements:
      // - They don't support custom temperature (must be 1, which is the default)
      // - They use max_completion_tokens instead of max_tokens
      if (isReasoningModel) {
        // Reasoning models (o1, o3, o4, etc.) and gpt-5+ models
        // Do NOT set temperature - it must remain at default (1)
        requestParams.max_completion_tokens = config.chatSettings.maxTokens;
      } else {
        // Regular chat models (gpt-3.5, gpt-4, etc.)
        requestParams.temperature = config.chatSettings.temperature;
        requestParams.max_tokens = config.chatSettings.maxTokens;
      }

      // Create timeout promise for chat completion
      const chatTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Chat completion timed out.')), config.openaiTimeoutMs);
      });

      // Create the streaming completion with timeout
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stream: any = await Promise.race([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        openai.chat.completions.create(requestParams as any),
        chatTimeoutPromise
      ]);

      // Stream response back to client using Server-Sent Events format
      // CRITICAL: Start consuming immediately in the background and write to stream
      // This ensures chunks flow through as they arrive from OpenAI
      const encoder = new TextEncoder();
      let fullAnswer = ''; // Collect full answer for caching


      const readable = new ReadableStream({
        async start(controller) {
          try {
            // Consume the OpenAI stream and immediately pipe chunks to the controller
            // This pattern ensures chunks are sent as soon as they arrive
            for await (const chunk of stream) {
              const text = chunk.choices?.[0]?.delta?.content ?? '';
              if (text) {
                fullAnswer += text;
                const sseData = `data: ${JSON.stringify({ text })}\n\n`;
                controller.enqueue(encoder.encode(sseData));
              }
            }


            // Build evidence signals for UI directive evaluation
            let evidenceSignals: EvidenceSignals;
            if (isEvaluative && results.length > 0) {
              const evidencePacks = buildEvidencePacks(results, skillMap);
              evidenceSignals = buildEvidenceSignals(evidencePacks);
              
              // Update signals with planner risk if available
              if (planner?.risk) {
                evidenceSignals.entityLinkScore = planner.risk.entityLinkScore;
                evidenceSignals.coverageRatio = planner.risk.coverageRatio;
              }
            } else {
              // Default signals for non-evaluative queries
              evidenceSignals = {
                evidenceCount: results.length,
                hasMetrics: results.some(r => {
                  const text = ('summary' in r.doc ? r.doc.summary : '') + 
                               ('specifics' in r.doc && Array.isArray(r.doc.specifics) ? r.doc.specifics.join(' ') : '');
                  return /\d+%|\$\d+|metrics|measure|impact/i.test(text);
                }),
                entityLinkScore: planner?.risk?.entityLinkScore ?? 1.0,
                freshnessMonths: 0, // Default - could be improved
                coverageRatio: planner?.risk?.coverageRatio ?? 1.0
              };
            }

            // Remove self-check comment from answer (no longer needed)
            fullAnswer = fullAnswer.replace(/<!--selfcheck:[\d.]+-->/, '');

            // Send completion marker
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();

            // Cache the complete answer for future requests
            try {
              const result = {
                answer: fullAnswer,
                sources: results.map(r => {
                  // Extract id or title depending on item type
                  if (r.doc.id) return r.doc.id;
                  if ('title' in r.doc && r.doc.title) return r.doc.title;
                  return 'unknown';
                }),
                timing: Date.now()
              };
              await irisCache.set(cacheKey, JSON.stringify(result), 3600); // 1 hour TTL
            } catch (cacheError) {
              console.warn('[Answer API] Failed to cache response:', cacheError);
              // Non-critical error, continue
            }
          } catch (error) {
            console.error('[Answer API] Stream error:', error);
            controller.error(error);
          }
        },

        // Cleanup when stream is cancelled
        cancel() {
        }
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    } catch (error) {
      console.error('[Answer API] ChatGPT generation failed:', error);
      console.error('[Answer API] Error details:', error instanceof Error ? error.message : String(error));
      console.error('[Answer API] Error stack:', error instanceof Error ? error.stack : 'No stack trace');

      // Check if it's a timeout error
      let errorMessage = 'I encountered an error while generating a response.';
      if (error instanceof Error && error.message.includes('timed out')) {
        errorMessage = '⏱️ Your request timed out due to slow internet connection. Please check your WiFi and try again.';
      } else if (error instanceof Error && error.message.includes('Request timed out')) {
        errorMessage = '🌐 Network timeout: The request took too long to complete. Please try again.';
      }

      // Return user-friendly error message
      return NextResponse.json({
        answer: errorMessage,
        sources: [],
        cached: false,
        error: true,
        errorType: 'generation',
        timing: Date.now()
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[Answer API] Request error:', error);

    // Check if it's a timeout error
    let errorMessage = 'Internal server error';
    if (error instanceof Error && error.message.includes('timed out')) {
      errorMessage = '⏱️ Request timed out due to slow internet connection. Please check your WiFi and try again.';
    } else if (error instanceof Error && error.message.includes('Request timed out')) {
      errorMessage = '🌐 Network timeout: The request took too long to complete. Please try again.';
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/iris/answer
 * Support GET requests by extracting query from URL parameters
 * and forwarding to POST handler
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || searchParams.get('query') || '';
    const signals = searchParams.get('signals') || '{}';

    // Create a new Request object with POST method and JSON body
    const postRequest = new NextRequest(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({ query, signals })
    });

    // Forward to POST handler
    return POST(postRequest);
  } catch (error) {
    console.error('[Answer API] GET request error:', error);
    return NextResponse.json(
      { error: 'Failed to process GET request' },
      { status: 500 }
    );
  }
}