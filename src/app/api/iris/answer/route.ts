import { NextRequest, NextResponse } from 'next/server';
import { retrieve } from '@/lib/iris/retrieval';
import { loadContact } from '@/lib/iris/load';
import { type SignalSummary } from '@/lib/iris/signals';
import { irisCache } from '@/lib/iris/cache';
import { type KBItem } from '@/lib/iris/schema';
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
 * Detects the user's intent using LLM-based classification with structured output
 * Returns both intent and optional filters for precise queries
 * Uses OpenAI's function calling for reliable structured responses
 */
async function detectIntent(query: string, openaiClient: OpenAI): Promise<IntentResult> {
  try {
    // Use function calling for structured output
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an intent classifier for queries about Mike (a software engineer/entrepreneur).

Analyze queries and extract:
1. The primary intent
2. Any specific filters the user wants

Examples:
- "what projects has mike worked on?" → filter_query with type: ["project"], show_all: true
- "list all projects" → filter_query with type: ["project"], show_all: true
- "show me mike's work experience" → filter_query with type: ["experience"], show_all: true
- "what classes has mike taken?" → filter_query with type: ["class"], show_all: true
- "show me all Python projects" → filter_query with type: ["project"], skills: ["Python"]
- "what classes involved ML?" → filter_query with type: ["class"], skills: ["ML"]
- "list experiences from 2024" → filter_query with type: ["experience"], year: [2024]
- "what have I done in 2025?" → filter_query with year: [2025], all types
- "projects using React" → filter_query with type: ["project"], skills: ["React"]
- "how was HiLiTe built?" → specific_item with title_match: "HiLiTe"
- "when did I take APCS A?" → specific_item with title_match: "APCS A"
- "tell me about Veson internship" → specific_item with title_match: "Veson"
- "how can I contact Mike?" → contact (fast-path, no filters)
- "what are Mike's values?" → personal (searches stories/values/interests)
- "where does Mike go to school?" → personal (education info)
- "what's Mike's headline?" → personal (bio/headline)
- "tell me Mike's story" → personal (family background)
- "why is Mike's name Douzinas?" → personal (family info)
- "what does Mike like to do?" → personal (interests)
- "what are Mike's skills?" → filter_query with type: ["skill"], show_all: true
- "what technologies does Mike know?" → filter_query with type: ["skill"], show_all: true
- "what technical work has Mike done?" → general (semantic search across all work)`
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
          description: 'Classify the query intent and extract filters',
          parameters: {
            type: 'object',
            properties: {
              intent: {
                type: 'string',
                enum: ['contact', 'filter_query', 'specific_item', 'personal', 'general'],
                description: 'The primary intent of the query'
              },
              filters: {
                type: 'object',
                properties: {
                  type: {
                    type: 'array',
                    items: { type: 'string', enum: ['project', 'experience', 'class', 'blog', 'story', 'value', 'interest', 'skill'] },
                    description: 'Document types to filter'
                  },
                  skills: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Skills to filter by (e.g., Python, ML, React, NLP)'
                  },
                  company: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Company names to filter'
                  },
                  year: {
                    type: 'array',
                    items: { type: 'number' },
                    description: 'Years to filter (e.g., 2024)'
                  },
                  tags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Tags to filter by'
                  },
                  title_match: {
                    type: 'string',
                    description: 'Title to match for specific item queries'
                  },
                  operation: {
                    type: 'string',
                    enum: ['contains', 'exact', 'any'],
                    default: 'contains'
                  },
                  show_all: {
                    type: 'boolean',
                    description: 'Whether to show all results (not just top 5)'
                  }
                },
                description: 'Optional filters for the query'
              }
            },
            required: ['intent']
          }
        }
      }],
      tool_choice: { type: 'function', function: { name: 'classify_intent' } }
    });
    
    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (toolCall && 'function' in toolCall && toolCall.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments) as IntentResult;
      console.log(`[Answer API] LLM-detected intent:`, JSON.stringify(result, null, 2));
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
 * Applies structured filters to KB items
 * Enables precise queries like "all Python projects" or "2024 experiences"
 * 
 * @param items - All KB items to filter
 * @param filters - Structured filters from intent detection
 * @returns Filtered items matching all criteria
 */
function applyFilters(items: KBItem[], filters: QueryFilter): KBItem[] {
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
  if (filters.skills && filters.skills.length > 0) {
    filtered = filtered.filter(item => {
      if (!('skills' in item) || !Array.isArray(item.skills)) return false;
      
      const itemSkills = item.skills.map(s => s.toLowerCase());
      const searchSkills = filters.skills!.map(s => s.toLowerCase());
      
      if (filters.operation === 'exact') {
        return searchSkills.every(s => itemSkills.includes(s));
      } else if (filters.operation === 'any') {
        return searchSkills.some(s => itemSkills.includes(s));
      } else { // 'contains'
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
  
  console.log(`[Answer API] Filter engine: ${items.length} items → ${filtered.length} after filtering`);
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
 * Formats retrieved documents into a clean, structured context string
 * This structured format helps the LLM extract relevant information accurately
 * Handles different KBItem types (Project, Experience, Class, Blog, Story) with varying schemas
 * 
 * @param docs - Array of KB items to format
 * @param includeDetails - If false, only includes title/summary (for list queries)
 * @param detailLevel - 'minimal' = name + summary only, 'standard' = + skills, 'full' = everything
 */
function formatContext(docs: Array<Partial<KBItem>>, includeDetails: boolean = true, detailLevel: 'minimal' | 'standard' | 'full' = 'full'): string {
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
        parts.push(`  - Skills: ${d.skills.join(', ')}`);
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
  console.log('[Answer API] No relevant context found, returning fallback response');
  
  try {
    // Load contact information for the fallback message
    const contact = await loadContact();
    
    const fallbackMessage = `I don't have specific information about that in my knowledge base. However, you can reach out to Mike directly for more details:\n\n` +
      `📧 Email: ${contact.email}\n` +
      `💼 LinkedIn: ${contact.linkedin}\n` +
      (contact.github ? `💻 GitHub: ${contact.github}\n` : '') +
      (contact.booking?.enabled && contact.booking?.link ? `📅 Schedule a chat: ${contact.booking.link}\n` : '') +
      `\nFeel free to ask me about Mike's projects, work experience, education, or technical skills!`;
    
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
    const minimalFallback = `I don't have specific information about that in my knowledge base. Feel free to reach out to Mike directly through the contact section of this website for more details!`;
    
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

    console.log(`[Answer API] Processing query: "${query}"`);
    
    // Parse user signals for future RAG personalization
    let signals: SignalSummary | undefined;
    try {
      const parsedSignals = typeof signalsParam === 'string' ? JSON.parse(signalsParam) : signalsParam;
      signals = parsedSignals;
      // TODO: Use signals for personalized RAG retrieval and ranking
      console.log('[Answer API] User signals:', signals);
    } catch (e) {
      console.warn('[Answer API] Failed to parse signals:', e);
    }

    // Initialize OpenAI client for intent detection and answer generation
    console.log('[Answer API] Initializing OpenAI client');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    // Detect intent for optimized field filtering using LLM-based classification
    const intentResult = await detectIntent(query, openai);
    const { intent, filters } = intentResult;
    const fields = FIELD_MAP[intent];
    console.log(`[Answer API] Detected intent: ${intent}`, filters ? `with filters: ${JSON.stringify(filters)}` : '');

    // Special fast-path for contact queries - no LLM needed
    // This saves API costs and provides instant responses for simple contact info
    // Returns as SSE stream for frontend consistency
    if (intent === 'contact') {
      try {
        const contactData = await loadContact();
        
        // Build structured contact response
        const text = [
          "Here's how to reach Mike:",
          contactData?.email ? `• Email: ${contactData.email}` : null,
          contactData?.linkedin ? `• LinkedIn: ${contactData.linkedin}` : null,
          contactData?.github ? `• GitHub: ${contactData.github}` : null,
          contactData?.booking?.enabled && contactData?.booking?.link ? `• Book a time: ${contactData.booking.link}` : null
        ].filter(Boolean).join('\n');
        
        console.log('[Answer API] Returning contact info (fast-path):', text);
        
        // Return as SSE stream for consistency with other endpoints
        const encoder = new TextEncoder();
        const readable = new ReadableStream({
          start(controller) {
            // Send the complete message as a single chunk
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
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
        console.error('[Answer API] Failed to load contact info:', error);
        // Fall through to normal retrieval as fallback
      }
    }

    // Check cache for previously answered queries (1 hour TTL)
    const cacheKey = `answer:${query}:${intent}`;
    const cached = await irisCache.get(cacheKey);
    
    if (cached) {
      console.log(`[Answer API] Cache hit for: "${query}"`);
      
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

    let context: string;
    let results: Array<{ score: number; doc: Partial<KBItem> }> = [];
    
    // Handle filter queries and specific item queries - use structured filtering instead of semantic search
    if ((intent === 'filter_query' || intent === 'specific_item') && filters) {
      console.log(`[Answer API] Using filter engine for structured query`);
      
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
      
      console.log(`[Answer API] Filter query returned ${results.length} results (show_all: ${filters.show_all})`);
      
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
        context = formatContext(results.map(r => r.doc), true, 'full');
      } else {
        // For filter queries with multiple results, use standard detail (summary + skills, no specifics)
        // This prevents the LLM from getting overwhelmed and focusing on one item
        context = formatContext(results.map(r => r.doc), true, 'standard');
      }
    } else {
      // Standard semantic retrieval for other intents
      const typeFilter = TYPE_FILTERS[intent];
      const retrievalOptions: { topK: number; fields: string[]; types?: Array<'project' | 'experience' | 'class' | 'blog' | 'story' | 'value' | 'interest' | 'education' | 'bio' | 'skill'> } = {
        topK: 5,
        fields
      };
      
      // Add type filtering if specified for this intent
      if (typeFilter && typeFilter.length > 0) {
        retrievalOptions.types = typeFilter;
      }
      
      console.log(`[Answer API] Retrieving documents with fields: ${fields.join(', ')}, types: ${typeFilter ? typeFilter.join(', ') : 'all'}`);
      const startTime = Date.now();
      
      const retrievalResults = await retrieve(query, retrievalOptions);
      results = retrievalResults.results;
      const retrievalTime = Date.now() - startTime;
      
      console.log(`[Answer API] Retrieved ${results.length} documents in ${retrievalTime}ms`);
      
      // If we have no results, use fallback response with contact info
      // The anti-hallucination instructions in the system prompt are strong enough to prevent
      // making things up when context quality is low, so we only fall back on truly empty results
      if (results.length === 0) {
        console.log('[Answer API] No results from semantic search, using fallback');
        return await createNoContextResponse();
      }
      
      // Rerank results to prioritize technically complex experiences for technical queries
      // This ensures IMOS laytime, Parsons, VesselsValue appear first for tech questions
      results = reranktechnical(results, query);
      console.log(`[Answer API] After technical reranking: ${results.map(r => r.doc.id).join(', ')}`);
      
      // Format documents into structured context with full details
      // The LLM will decide what level of detail to include in its response
      context = formatContext(results.map(r => r.doc), true, 'full');
    }
    
    console.log(`[Answer API] Formatted context:\n${context}`);
    
    // Get recent GitHub activity for additional context (production only)
    let recentActivity: string | null = null;
    if (process.env.NODE_ENV === 'production') {
      try {
        recentActivity = await getRecentActivityContext();
        console.log('[Answer API] Successfully fetched GitHub activity');
      } catch (error) {
        console.warn('[Answer API] GitHub activity fetch failed:', error);
        // Continue without GitHub context
      }
    }
    
    // Build enhanced context with optional GitHub activity
    let enhancedContext = context;
    if (recentActivity) {
      enhancedContext += `\n\nRecent Development Activity:\n${recentActivity}`;
    }
    
    try {
      // Create streaming chat completion (OpenAI client already initialized)
      console.log('[Answer API] Creating chat completion stream with model:', config.models.chat);
      
      // Check if using o-series reasoning model (o1, o3, o4, etc.) or gpt-5+ models
      // These models have strict requirements: only temperature=1 (default), and require max_completion_tokens
      // Note: gpt-5-nano and other gpt-5+ models use the new API format with max_completion_tokens
      const isReasoningModel = /^o[0-9]/.test(config.models.chat.toLowerCase()) || 
                               /^gpt-5/.test(config.models.chat.toLowerCase()) ||
                               /^gpt-6/.test(config.models.chat.toLowerCase());
      
      // Build system prompt with anti-hallucination instructions
      const systemPrompt = `You are Iris, Mike's friendly AI assistant living within his personal portfolio website. Named after the Greek messenger goddess, you bridge Mike's structured knowledge and the visitor's curiosity — guiding them through his work, experience, and ideas in a warm, conversational way. You're also part of a larger vision alongside Hermes, a future physical counterpart that will bring interaction into the real world. While Mike's full long-term plans for Iris and Hermes remain private, visitors are welcome to message him directly if they'd like to learn more.

Core principles:
- Be genuinely helpful and approachable - like a knowledgeable friend
- Use natural language, avoid jargon and corporate speak
- Keep answers concise but complete (aim for 2-3 short paragraphs)
- If you mention contact info, URLs, or blog links, ALWAYS use the exact links provided in the context

**CRITICAL ANTI-HALLUCINATION RULES**:
1. ONLY use information explicitly provided in the context below - never make up details
2. If the context doesn't contain enough information to answer fully, be honest about it
3. NEVER invent: projects, skills, companies, dates, URLs, people's names, or technical details
4. When unsure or lacking context, say something like: "I don't have specific information about that in my knowledge base. Feel free to reach out to Mike directly for more details!"
5. If you mention ANY links (contact, projects, blogs), they MUST be exactly as shown in the context

**Context Guidelines**:
- Answer questions directly using the information provided in the context
- When the context has MULTIPLE items, synthesize them into a cohesive summary (don't just describe one item in detail)
- You can infer reasonable connections (e.g., if context shows 2025 items, you CAN say "in 2025, Mike did X, Y, and Z")
- Synthesize across ALL items in the context to give a complete picture

Context about Mike:
${enhancedContext}

Remember: If you're not confident in your answer based on the context, acknowledge the limitation and suggest contacting Mike directly. Being accurate is more important than being comprehensive.`;

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
      console.log('[Answer API] ========== COMPLETE PROMPT ==========');
      console.log('[Answer API] System Prompt:', systemPrompt);
      console.log('[Answer API] User Query:', query);
      console.log('[Answer API] =======================================');
      
      // Apply model-specific parameters
      // O-series reasoning models and gpt-5+ models have different parameter requirements:
      // - They don't support custom temperature (must be 1, which is the default)
      // - They use max_completion_tokens instead of max_tokens
      if (isReasoningModel) {
        // Reasoning models (o1, o3, o4, etc.) and gpt-5+ models
        // Do NOT set temperature - it must remain at default (1)
        requestParams.max_completion_tokens = config.chatSettings.maxTokens;
        console.log(`[Answer API] Using reasoning model parameters: max_completion_tokens=${config.chatSettings.maxTokens}`);
      } else {
        // Regular chat models (gpt-3.5, gpt-4, etc.)
        requestParams.temperature = config.chatSettings.temperature;
        requestParams.max_tokens = config.chatSettings.maxTokens;
        console.log(`[Answer API] Using regular model parameters: max_tokens=${config.chatSettings.maxTokens}, temperature=${config.chatSettings.temperature}`);
      }
      
      // Create the streaming completion
      // TypeScript needs explicit typing for streaming responses
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stream: any = await openai.chat.completions.create(requestParams as any);
      
      // Stream response back to client using Server-Sent Events format
      // CRITICAL: Start consuming immediately in the background and write to stream
      // This ensures chunks flow through as they arrive from OpenAI
      const encoder = new TextEncoder();
      let fullAnswer = ''; // Collect full answer for caching
      
      console.log('[Answer API] Setting up ReadableStream with immediate consumption');
      
      const readable = new ReadableStream({
        async start(controller) {
          console.log('[Answer API] Stream started, consuming OpenAI stream');
          try {
            // Consume the OpenAI stream and immediately pipe chunks to the controller
            // This pattern ensures chunks are sent as soon as they arrive
            let chunkCount = 0;
            for await (const chunk of stream) {
              const text = chunk.choices?.[0]?.delta?.content ?? '';
              if (text) {
                chunkCount++;
                fullAnswer += text;
                const sseData = `data: ${JSON.stringify({ text })}\n\n`;
                controller.enqueue(encoder.encode(sseData));
              }
            }
            
            console.log(`[Answer API] Stream complete: ${chunkCount} chunks, ${fullAnswer.length} characters`);
            
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
              console.log(`[Answer API] Cached response for: "${query}"`);
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
          console.log('[Answer API] Stream cancelled by client');
        }
      });
      
      console.log('[Answer API] Stream created successfully, sending to client');
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
      
      // Return user-friendly error message
      return NextResponse.json({
        answer: `I encountered an error while generating a response. This might be due to API configuration issues. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        sources: [],
        cached: false,
        error: true,
        errorType: 'generation',
        timing: Date.now()
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[Answer API] Request error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
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