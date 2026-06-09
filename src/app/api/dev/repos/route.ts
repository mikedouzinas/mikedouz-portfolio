import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { listRepos, isOwnedRepo } from '@/lib/dev/github';
import { getHiddenRepos, hideRepo, unhideRepo } from '@/lib/dev/hidden';

export const runtime = 'nodejs';

/** GET → { repos: visible[], hidden: hidden[] } */
export async function GET() {
  try {
    const [all, hidden] = await Promise.all([listRepos(), getHiddenRepos()]);
    const hiddenSet = new Set(hidden);
    return NextResponse.json({
      repos: all.filter((r) => !hiddenSet.has(r.slug)),
      hidden: all.filter((r) => hiddenSet.has(r.slug)),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

const RepoSchema = z.object({ repo: z.string() });

/** POST { repo } → hide it. */
export async function POST(req: NextRequest) {
  const parsed = RepoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  if (!(await isOwnedRepo(parsed.data.repo))) {
    return NextResponse.json({ error: 'repo not allowed' }, { status: 400 });
  }
  try {
    await hideRepo(parsed.data.repo);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

/** DELETE { repo } → unhide it. */
export async function DELETE(req: NextRequest) {
  const parsed = RepoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  try {
    await unhideRepo(parsed.data.repo);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
