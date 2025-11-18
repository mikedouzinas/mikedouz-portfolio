// src/lib/iris/typeahead.ts
import Fuse from "fuse.js";
import lite from "@/data/iris/derived/typeahead.json";
import { TypeaheadV2 } from './typeahead_v2';

type Item = {
  id: string;
  kind?: string;
  title: string;
  summary?: string;
  tags?: string[];
  aliases?: string[];
};

// Enhanced Fuse configuration that includes aliases
const fuse = new Fuse(lite as Item[], {
  includeScore: true,
  threshold: 0.35,
  keys: ["title", "summary", "tags", "aliases"] // Added aliases to search
});

// Lazy-loaded v2 instance
let typeaheadV2Instance: TypeaheadV2 | null = null;

async function getTypeaheadV2(): Promise<TypeaheadV2 | null> {
  if (typeaheadV2Instance) return typeaheadV2Instance;
  
  try {
    const { createTypeaheadV2 } = await import('./typeahead_v2');
    typeaheadV2Instance = await createTypeaheadV2();
    return typeaheadV2Instance;
  } catch (error) {
    console.warn('Failed to load typeahead v2:', error);
    return null;
  }
}

/** Enhanced suggest function that supports question/sentence completion */
export async function suggestV2(query: string, limit = 6): Promise<Item[]> {
  const v2 = await getTypeaheadV2();
  
  if (!v2) {
    // Fallback to v1 if v2 fails to load
    return suggest(query, limit);
  }

  const results = v2.suggest(query, limit);
  
  // Convert TypeaheadResult to Item format for compatibility
  return results.map(result => ({
    id: result.id,
    kind: result.kind,
    title: result.text,
    summary: result.displayText,
    tags: [],
  }));
}

/** Keep this function name stable for the ⌘K palette. */
export function suggest(query: string, limit = 6): Item[] {
  const q = query.trim();
  if (!q) return [];
  return fuse.search(q).slice(0, limit).map(r => r.item);
}

/** 
 * Get default suggestions when no query is provided
 * Returns common questions and starting points
 */
export function getDefaultSuggestions(): string[] {
  return [
    "What projects have you worked on?",
    "Tell me about your experience",
    "What technologies do you know?",
    "How can I contact you?",
    "What's your latest work?",
    "Machine learning projects",
  ];
}
