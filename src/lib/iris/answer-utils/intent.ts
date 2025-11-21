/**
 * Intent detection utilities for query classification
 */

import { OpenAI } from 'openai';
import { type PlannerResult } from '@/lib/iris/schema';
import { config } from '@/lib/iris/config';
import { type Intent, type IntentResult } from './types';
import { preRoute } from './planning';

/**
 * Detects the user's intent using LLM-based classification with structured output
 * Returns both intent and optional filters for precise queries
 * Uses OpenAI's function calling for reliable structured responses
 *
 * Professional comment: Now includes pre-routing for fast pattern matching before
 * expensive LLM classification, improving latency for common query patterns.
 *
 * @param query - The user's query
 * @param openaiClient - OpenAI client instance
 * @returns Intent result with optional filters
 */
export async function detectIntent(query: string, openaiClient: OpenAI): Promise<IntentResult> {
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
**CRITICAL: Also use CONTACT for availability queries about FUTURE opportunities:**
- "is mike available for X", "is mike available", "is mike open to", "is mike looking for", "is mike seeking"
- "available for internships/jobs/work" → CONTACT (about future availability)
- "what internships has mike done" → FILTER_QUERY (about past work)

## 2. SPECIFIC_ITEM Intent
Use when query asks about a SINGLE, SPECIFIC item by name/title.
Patterns: "tell me about [ITEM]", "how was [ITEM] built?", "when did [ITEM] happen?", "what is [ITEM]?"
Examples: "HiLiTe", "APCS A", "Veson internship", "IMOS laytime"
ALWAYS include title_match filter with the item name/title extracted from the query.

## 3. FILTER_QUERY Intent
Use when query asks for MULTIPLE items or a LIST of items matching certain criteria.
Key indicators: "list", "show me", "see", "view", "what [items]", "all [items]", "find", "search for", "discover", "tell me about [items]" (plural)

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
- If query asks for "all", "every", "list", "show me", "see", "view" → show_all: true
- If query asks "what" or "which" (multiple items expected) → show_all: true
- If query asks "has [Mike] done X" or "used X" → show_all: true
- For queries about skills/classes/projects that expect comprehensive lists (e.g., "see Mike's skills") → show_all: true
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

1. Does the query explicitly ask for contact info OR ask about future availability (e.g., "is mike available for X")? → CONTACT
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

# Scope Guardrail
- Set "about_mike" to false when the query is unrelated to Mike (generic trivia, other people, off-topic asks)
- Set "about_mike" to true when the user references Mike, Iris, "you", or clearly intends to discuss his work/life

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
  Reason: "Built" without explicit type should include both categories

**Example 7: Skills/Technologies overview**
- Query: "see Mike's skills" or "view Mike's technologies" → filter_query with type: ["skill"], show_all: true
  Reason: Skills queries typically expect comprehensive listings, not just top 5 results
  
**Example 8: Classes overview**
- Query: "what classes has Mike taken?" → filter_query with type: ["class"], show_all: true
  Reason: Academic history queries expect full course list`
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
                about_mike: {
                  type: 'boolean',
                  description: 'True when the query is about Mike, his work, story, or contacting him. False for unrelated questions (general trivia, other people, etc.).'
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
 *
 * @param query - The user's query
 * @param openaiClient - OpenAI client instance
 * @param aliasIndex - Alias index for entity matching
 * @param preRoutedIntent - Pre-routed intent if available
 * @returns Planner result or null if skipped
 */
export async function runMicroPlanner(
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
