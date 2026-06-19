import fs from "node:fs/promises";
import path from "node:path";
import { loadKBItems } from "@/lib/iris/load"

const OUT = path.join(process.cwd(), "src/data/iris/derived/typeahead.json");

// minimal fields the client needs for suggestions
type Lite = { id: string; kind?: string; title: string; summary?: string; tags?: string[]; aliases?: string[] };

(async () => {
  const kb = await loadKBItems();
  const lite: Lite[] = kb.map((item) => {
    // KBItem is a discriminated union; not every member declares every typeahead
    // field, so read through a narrowed structural view of the optional fields.
    const d = item as {
      id: string;
      kind?: string;
      title?: string;
      summary?: string;
      tags?: string[];
      aliases?: string[];
    };
    return {
      id: d.id,
      kind: d.kind ?? undefined,
      title: d.title ?? '',
      summary: d.summary,
      tags: d.tags ?? [],
      aliases: Array.isArray(d.aliases) ? d.aliases : [], // Include aliases for typeahead matching
    };
  });

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(lite));
})();

