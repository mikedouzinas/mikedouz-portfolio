// lib/iris/embedding.ts
import OpenAI from "openai"

// Lazy-load the OpenAI client to allow environment variables to be loaded first
// This ensures .env.local is loaded before the client is instantiated in scripts
let client: OpenAI | null = null
function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return client
}

export async function embed(text: string): Promise<number[]> {
  const res = await getClient().embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  })
  return res.data[0].embedding
}

/** cosine similarity (unit-agnostic) */
export function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i]
    dot += x * y; na += x * x; nb += y * y
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}
