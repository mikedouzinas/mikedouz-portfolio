import fs from "node:fs/promises";
import path from "node:path";
import { loadKBItems } from "@/lib/iris/load"

const OUT = path.join(process.cwd(), "src/data/iris/derived/typeahead.json");

// minimal fields the client needs for suggestions
type Lite = { id: string; kind?: string; title: string; summary?: string; tags?: string[] };

(async () => {
  const kb = await loadKBItems();
  const lite: Lite[] = kb.map((d: any) => ({
    id: d.id,
    kind: d.kind ?? undefined,
    title: d.title,
    summary: d.summary,
    tags: d.tags ?? []
  }));

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(lite));
  console.log(`Typeahead index: ${lite.length} items → ${OUT}`);
})();

