export const runtime = "nodejs";

export async function GET() {
  const ok =
    !!process.env.OPENAI_API_KEY &&
    process.env.NODE_ENV !== undefined;

  const body = {
    ok,
    env: {
      node: process.version,
      mode: process.env.NODE_ENV ?? "unknown"
    }
  };
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: ok ? 200 : 500
  });
}
