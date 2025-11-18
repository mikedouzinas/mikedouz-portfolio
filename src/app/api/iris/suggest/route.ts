import { NextRequest } from "next/server";
import { suggest, suggestV2, getDefaultSuggestions } from "@/lib/iris/typeahead";
import { config } from "@/lib/iris/config";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const limit = Number(searchParams.get("limit") ?? "5");
  const useV2 = searchParams.get("v2") === "true" || config.features?.typeaheadV2;

  let items = [];
  
  if (!q) {
    // Return default suggestions when no query
    const defaults = getDefaultSuggestions();
    items = defaults.slice(0, limit).map((text, idx) => ({
      id: `default_${idx}`,
      title: text,
      kind: "question"
    }));
  } else if (useV2) {
    // Use enhanced typeahead v2
    items = await suggestV2(q, limit - 1);
  } else {
    // Use original typeahead
    items = suggest(q, limit - 1);
  }
  
  const result = [];

  // Only add raw query if there's a query and it's not already in suggestions
  if (q && !items.some(item => item.title.toLowerCase() === q.toLowerCase())) {
    result.push({ id: "__raw__", title: q, kind: "query" });
  }
  
  for (const it of items) result.push(it);
  
  return new Response(JSON.stringify(result.slice(0, limit)), {
    headers: { "Content-Type": "application/json" }
  });
}
