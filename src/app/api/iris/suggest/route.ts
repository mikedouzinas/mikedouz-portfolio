import { NextRequest } from "next/server";
import { suggest } from "@/lib/iris/typeahead";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const limit = Number(searchParams.get("limit") ?? "5");

  const items = q ? suggest(q, limit - 1) : []; // we’ll reserve slot 0 for raw input
  const result = [];

  if (q) result.push({ id: "__raw__", title: q, kind: "query" });
  for (const it of items) result.push(it);
  return new Response(JSON.stringify(result.slice(0, limit)), {
    headers: { "Content-Type": "application/json" }
  });
}
