// scripts/verify_kb.ts
import { loadAll } from "@/lib/iris/load"

;(async () => {
  const all = await loadAll()
  const ids = new Set<string>()
  for (const it of all.items) {
    if (ids.has(it.id)) throw new Error(`Duplicate id: ${it.id}`)
    ids.add(it.id)
  }
  console.log(`KB OK → items: ${all.items.length}, skills: ${all.skills.length}`)
})()
