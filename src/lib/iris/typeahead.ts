// src/lib/iris/typeahead.ts
import Fuse from "fuse.js";
import lite from "@/data/iris/derived/typeahead.json";

type Item = {
  id: string;
  kind?: string;
  title: string;
  summary?: string;
  tags?: string[];
};

const fuse = new Fuse(lite as Item[], {
  includeScore: true,
  threshold: 0.35,
  keys: ["title", "summary", "tags"]
});

/** Keep this function name stable for the ⌘K palette. */
export function suggest(query: string, limit = 6): Item[] {
  const q = query.trim();
  if (!q) return [];
  return fuse.search(q).slice(0, limit).map(r => r.item);
}
