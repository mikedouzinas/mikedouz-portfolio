import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createShareToken } from '@/lib/dev/share';
import { isOwnedRepo } from '@/lib/dev/github';
import { getDevSession } from '@/lib/dev/session';

export const runtime = 'nodejs';

const Body = z.object({
  repo: z.string().min(3),
  ttlDays: z.number().int().min(1).max(90).optional(),
});

/** POST { repo } → mint a guest link for one repo's read-only board (#6). */
export async function POST(req: NextRequest) {
  // Middleware already blocks visitors from non-GET /api/dev/*; re-assert here
  // so this route can never mint access with anything less than admin.
  const session = await getDevSession(req);
  if (session?.role !== 'admin') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  const { repo, ttlDays } = parsed.data;
  if (!(await isOwnedRepo(repo))) {
    return NextResponse.json({ error: 'unknown repo' }, { status: 400 });
  }

  try {
    const { token, expiresAt } = await createShareToken(repo, ttlDays);
    const url = `${req.nextUrl.origin}/dev/guest/${token}`;
    return NextResponse.json({ url, expiresAt });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
