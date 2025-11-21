// src/lib/iris/retrieval.ts
import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { loadKBItems } from "@/lib/iris/load";
import { type KBItem } from "@/lib/iris/schema";
import { config } from "@/lib/iris/config";

// Lazy-load the OpenAI client to allow environment variables to be loaded first
// This ensures .env.local is loaded before the client is instantiated
let client: OpenAI | null = null;
function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  }
  return client;
}

const EMB_PATH = path.join(process.cwd(), "src/data/iris/derived/embeddings.json");

type EmbRow = { id: string; vector: number[] };
type Retrieved = { score: number; doc: Partial<KBItem> };
type Options = { 
  topK?: number; 
  fields?: string[]; 
  types?: Array<'project' | 'experience' | 'class' | 'blog' | 'story' | 'value' | 'interest' | 'education' | 'bio' | 'skill'>;
  debug?: boolean;
  preFilteredItemIds?: Set<string>; // Optional set of item IDs to restrict retrieval to (for pre-filtered queries)
};

function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Filters document to only include specified fields
 * Always includes id/title for result identification
 */
function selectFields<T extends Record<string, unknown>>(doc: T, fields?: string[]): Partial<T> | T {
  if (!fields || fields.length === 0) return doc;
  const out: Partial<T> = {};
  for (const f of fields) {
    if (f in doc) {
      (out as Record<string, unknown>)[f] = doc[f];
    }
  }
  // Always include id/title/kind if present to keep results identifiable
  if ("id" in doc) (out as Record<string, unknown>).id = doc.id;
  if ("title" in doc) (out as Record<string, unknown>).title = doc.title;
  if ("kind" in doc) (out as Record<string, unknown>).kind = doc.kind;
  return out;
}

/** Main retrieval entry. Keep this function name stable for callers. */
export async function retrieve(query: string, options: Options = {}): Promise<{ results: Retrieved[]; debug?: Array<{ id: string; title?: string; score: number }> }> {
  const topK = options.topK ?? 5;

  // Create timeout promise for retrieval operations
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Request timed out.')), config.retrievalTimeoutMs);
  });

  const [{ data: qEmb }, vecRaw, kb] = await Promise.race([
    Promise.all([
      getClient().embeddings.create({ model: "text-embedding-3-small", input: query }),
      fs.readFile(EMB_PATH, "utf8"),
      loadKBItems()
    ]),
    timeoutPromise
  ]);

  const q = qEmb[0].embedding;
  const vecs: EmbRow[] = JSON.parse(vecRaw);

  // Filter KB items by type if specified
  // This ensures we only retrieve documents of relevant types for the query intent
  let filteredKb = kb;
  if (options.types && options.types.length > 0) {
    filteredKb = kb.filter(item => options.types!.includes(item.kind));
  }

  // Professional comment: Apply pre-filtered item IDs if provided (e.g., for year filters in general intent).
  // This ensures queries like "how has mike's work evolved from 2021 to 2025?" only search within
  // items matching those years, not just boost them in ranking after retrieval.
  if (options.preFilteredItemIds && options.preFilteredItemIds.size > 0) {
    filteredKb = filteredKb.filter(item => options.preFilteredItemIds!.has(item.id));
  }
  
  // Get IDs of filtered items for scoring
  const allowedIds = new Set(filteredKb.map(item => item.id));

  const scored = vecs
    .filter(v => allowedIds.has(v.id)) // Only score filtered items
    .map(v => ({ id: v.id, score: cosine(q, v.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  const docs = scored.map(s => {
    const d = filteredKb.find(k => k.id === s.id);
    if (!d) return null;
    return { score: s.score, doc: selectFields(d, options.fields) };
  }).filter(Boolean) as Retrieved[];

  const payload: { results: Retrieved[]; debug?: Array<{ id: string; title?: string; score: number }> } = { results: docs };

  if (options.debug) {
    payload.debug = scored.map(s => {
      const d = filteredKb.find(k => k.id === s.id);
      // Extract displayable name based on item type
      const title = d && 'title' in d ? d.title : undefined;
      return { id: s.id, title, score: s.score };
    });
  }

  return payload;
}

/** ---------- Synthesis Upgrade: Diversification & Evidence Packs ---------- */

/**
 * Diversifies retrieval results by type quotas
 * Ensures balanced representation across different item types for evaluative queries
 * 
 * Professional comment: This function distributes results across types to provide
 * comprehensive evidence for comparative queries like "best/strongest/what makes".
 * 
 * @param items - Retrieved items with type information
 * @param quotas - Target quotas per type (e.g., { project: 3, experience: 2 })
 * @returns Diversified items respecting quotas, filled up to generalTopK
 */
export function diversifyByType<T extends { type: string; doc?: Partial<KBItem> }>(
  items: T[],
  quotas: Record<string, number>
): T[] {
  const out: T[] = [];
  const buckets = new Map<string, T[]>();
  
  // Initialize buckets for each type in quotas
  for (const type of Object.keys(quotas)) {
    buckets.set(type, []);
  }

  // Distribute items into type buckets
  for (const item of items) {
    // Extract type from item (could be item.type or item.doc.kind)
    let itemType: string | null = null;
    if ('type' in item && typeof item.type === 'string') {
      itemType = item.type;
    } else if ('doc' in item) {
      const doc = item.doc as Partial<KBItem> | undefined;
      if (doc && 'kind' in doc && doc.kind && typeof doc.kind === 'string') {
        itemType = doc.kind;
      }
    }
    if (itemType && buckets.has(itemType)) {
      buckets.get(itemType)!.push(item);
    }
  }

  // Fill from each bucket up to quota
  for (const [type, quota] of Object.entries(quotas)) {
    const bucket = buckets.get(type) ?? [];
    const slice = bucket.slice(0, quota);
    out.push(...slice);
  }

  // Fill leftovers up to generalTopK
  const generalTopK = config.features?.generalTopK ?? 5;
  if (out.length < generalTopK) {
    const remaining = items.filter(item => !out.includes(item));
    const needed = generalTopK - out.length;
    out.push(...remaining.slice(0, needed));
  }

  return out.slice(0, generalTopK);
}

/**
 * Evidence pack format for evaluative/comparative queries
 * Compact representation focusing on key signals: title, summary, specifics, dates, skills, metrics
 */
export interface EvidencePack {
  id: string;
  type: string;
  title: string;
  summary: string;
  specifics: string[]; // max 3
  dates?: { start?: string; end?: string };
  skills?: string[];
  metrics?: string[];  // Pull bullets with % / $ / # if available
  recencyRank?: number;
}

/**
 * Builds evidence packs from retrieved items
 * Extracts key information for synthesis: title, summary, top 2-3 specifics, dates, skills, metrics
 * 
 * Professional comment: This creates compact evidence packs that provide enough
 * context for synthesis without overwhelming the generator with full item text.
 * 
 * @param items - Retrieved items with documents
 * @param skillMap - Optional map of skill ID to skill name for resolving skill IDs to names
 */
export function buildEvidencePacks(items: Array<{ doc: Partial<KBItem> }>, skillMap?: Map<string, string>): EvidencePack[] {
  return items.map((item, idx) => {
    const doc = item.doc;
    
    // Extract title/name
    let title = '';
    if ('title' in doc && doc.title) {
      title = doc.title;
    } else if ('name' in doc && doc.name) {
      title = doc.name;
    } else if ('company' in doc && doc.company && 'role' in doc && doc.role) {
      title = `${doc.role} at ${doc.company}`;
    } else if ('company' in doc && doc.company) {
      title = doc.company;
    } else if ('school' in doc && doc.school) {
      title = doc.school;
    } else {
      title = doc.id || 'Unknown';
    }

    // Extract summary
    let summary = '';
    if ('summary' in doc && doc.summary) {
      summary = doc.summary;
    } else if ('text' in doc && doc.text) {
      summary = doc.text.slice(0, 200); // Truncate long text
    } else if ('why' in doc && doc.why) {
      summary = doc.why;
    }

    // Extract specifics (max 3)
    let specifics: string[] = [];
    if ('specifics' in doc && Array.isArray(doc.specifics)) {
      specifics = doc.specifics.slice(0, 3).map(s => String(s).slice(0, 150)); // Truncate long bullets
    }

    // Extract dates
    let dates: { start?: string; end?: string } | undefined;
    if ('dates' in doc && doc.dates) {
      dates = {
        start: doc.dates.start,
        end: doc.dates.end
      };
    }

    // Extract skills and resolve IDs to names if skillMap provided
    let skills: string[] | undefined;
    if ('skills' in doc && Array.isArray(doc.skills)) {
      const skillIds = doc.skills.map(s => String(s));
      if (skillMap) {
        // Resolve skill IDs to names
        skills = skillIds.map(id => {
          const name = skillMap.get(id.toLowerCase());
          return name || id; // Fallback to ID if not found
        });
      } else {
        skills = skillIds;
      }
    }

    // Extract metrics (look for bullets with %, $, or numbers)
    const metrics: string[] = [];
    const allText = [summary, ...specifics].join(' ');
    
    // Look for patterns like "50%", "$100k", "1M users", "2x faster"
    const metricPatterns = [
      /\d+%[^\s]*/g,           // Percentages
      /\$\d+[kK]?[^\s]*/g,     // Currency
      /\d+[kKmMbB][^\s]*/g,    // Large numbers (1M, 500k)
      /\d+x\s+(faster|improvement|increase)/gi, // Multipliers
      /\d+\s+(users|records|items|projects|companies)/gi // Counts
    ];

    for (const pattern of metricPatterns) {
      const matches = allText.match(pattern);
      if (matches) {
        metrics.push(...matches.slice(0, 3)); // Limit to 3 metrics
      }
    }

    return {
      id: doc.id || `item_${idx}`,
      type: doc.kind || 'unknown',
      title,
      summary: summary.slice(0, 300), // Truncate long summaries
      specifics: specifics.slice(0, 3), // Max 3 specifics
      dates,
      skills,
      metrics: metrics.length > 0 ? metrics.slice(0, 3) : undefined,
      recencyRank: idx // Lower rank = more recent/relevant
    };
  });
}

/**
 * Computes evidence signals from evidence packs
 * Used to determine answer quality and trigger contact directive if needed
 * 
 * Professional comment: These signals assess the quality and completeness of
 * retrieved evidence, helping decide when to suggest contacting Mike for more details.
 */
export function buildEvidenceSignals(packs: EvidencePack[]): import('@/lib/iris/schema').EvidenceSignals {
  const evidenceCount = packs.length;
  const hasMetrics = packs.some(p => (p.metrics?.length ?? 0) > 0);

  // Calculate freshness (months since newest item)
  const newestYear = Math.max(
    ...packs
      .map(p => {
        if (p.dates?.end) {
          const year = parseInt(p.dates.end.slice(0, 4));
          if (!isNaN(year)) return year;
        }
        return 0;
      })
      .filter(Boolean)
  );

  const currentYear = new Date().getFullYear();
  const freshnessMonths = newestYear ? Math.max(0, (currentYear - newestYear) * 12) : 999;

  return {
    evidenceCount,
    hasMetrics,
    entityLinkScore: 1.0, // Default - planner or alias matching will update this
    freshnessMonths,
    coverageRatio: 1.0    // Default - planner will update this if used
  };
}
