// src/lib/iris/retrieval.ts
import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { loadKBItems } from "@/lib/iris/load";
import { type KBItem } from "@/lib/iris/schema";

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
  types?: Array<'project' | 'experience' | 'class' | 'blog' | 'story' | 'value' | 'interest'>;
  debug?: boolean;
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
  // Always include id/title if present to keep results identifiable
  if ("id" in doc) (out as Record<string, unknown>).id = doc.id;
  if ("title" in doc) (out as Record<string, unknown>).title = doc.title;
  return out;
}

/** Main retrieval entry. Keep this function name stable for callers. */
export async function retrieve(query: string, options: Options = {}): Promise<{ results: Retrieved[]; debug?: Array<{ id: string; title?: string; score: number }> }> {
  const topK = options.topK ?? 5;

  const [{ data: qEmb }, vecRaw, kb] = await Promise.all([
    getClient().embeddings.create({ model: "text-embedding-3-small", input: query }),
    fs.readFile(EMB_PATH, "utf8"),
    loadKBItems()
  ]);

  const q = qEmb[0].embedding;
  const vecs: EmbRow[] = JSON.parse(vecRaw);

  // Filter KB items by type if specified
  // This ensures we only retrieve documents of relevant types for the query intent
  let filteredKb = kb;
  if (options.types && options.types.length > 0) {
    filteredKb = kb.filter(item => options.types!.includes(item.kind));
    console.log(`[Retrieval] Filtering to types: ${options.types.join(', ')} (${filteredKb.length}/${kb.length} items)`);
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
