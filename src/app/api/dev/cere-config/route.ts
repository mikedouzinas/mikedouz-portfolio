import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCereConfig, updateCereConfig } from '@/lib/dev/cereConfig';
import { getDevSession } from '@/lib/dev/session';

// Middleware already gates /api/dev/* behind the session cookie; Cere's
// notes are admin-only either way (visitor sessions must not read them).
export const runtime = 'nodejs';

const Patch = z.object({
  notes: z.string().max(8000).optional(),
  addAliases: z.record(z.string().min(1), z.string().min(1)).optional(),
});

async function assertAdmin(req: NextRequest): Promise<NextResponse | null> {
  const session = await getDevSession(req);
  return session?.role === 'admin'
    ? null
    : NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}

export async function GET(req: NextRequest) {
  const denied = await assertAdmin(req);
  if (denied) return denied;
  const config = await getCereConfig();
  return NextResponse.json({ config });
}

export async function POST(req: NextRequest) {
  const denied = await assertAdmin(req);
  if (denied) return denied;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  try {
    const config = await updateCereConfig(parsed.data);
    return NextResponse.json({ config });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
