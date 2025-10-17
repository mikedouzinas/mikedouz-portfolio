// scripts/build_embeddings.ts
// Load environment variables from .env.local before anything else
import dotenv from "dotenv"
import path from "path"
dotenv.config({ path: path.join(process.cwd(), ".env.local") })

import fs from "fs/promises"
import { loadKBItems } from "@/lib/iris/load"
import { embed } from "@/lib/iris/embedding"

// Write to src/data/iris/derived to match where retrieval.ts reads from
const OUT = path.join(process.cwd(), "src/data/iris/derived/embeddings.json")

function docText(d: any) {
  // pack only what’s useful for semantic meaning
  const parts = [
    `[${d.kind?.toUpperCase() ?? "ITEM"}] ${d.title}`,
    d.summary ?? "",
    ...(d.specifics ?? []),
    d.architecture ?? "",
    Array.isArray(d.skills) ? d.skills.join(", ") : "",
    Array.isArray(d.tags) ? d.tags.join(", ") : "",
  ].filter(Boolean)
  return parts.join("\n")
}

;(async () => {
  const items = await loadKBItems()
  const out: { id: string; kind?: string; vector: number[] }[] = []

  for (const it of items) {
    const text = docText(it)
    const vector = await embed(text)
    out.push({ id: it.id, kind: it.kind, vector })
    console.log(`• embedded ${it.kind}:${it.id}`)
  }

  await fs.mkdir(path.dirname(OUT), { recursive: true })
  await fs.writeFile(OUT, JSON.stringify(out))
  console.log(`Wrote ${OUT} (${out.length} vectors)`)
})().catch(err => {
  console.error(err)
  process.exit(1)
})
