import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCereConfig, updateCereConfig } from '@/lib/dev/cereConfig';

// Middleware already gates /api/dev/* behind the session cookie.
export const runtime = 'nodejs';

const Patch = z.object({
  notes: z.string().max(8000).optional(),
  addAliases: z.record(z.string().min(1), z.string().min(1)).optional(),
});

export async function GET() {
  const config = await getCereConfig();
  return NextResponse.json({ config });
}

export async function POST(req: NextRequest) {
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  try {
    const config = await updateCereConfig(parsed.data);
    return NextResponse.json({ config });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
