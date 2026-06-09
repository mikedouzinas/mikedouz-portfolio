import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { listIssues, listBoardIssues, createIssue, updateIssue, listRepos, isOwnedRepo } from '@/lib/dev/github';
import { getHiddenRepos } from '@/lib/dev/hidden';

export const runtime = 'nodejs';

const PRIORITY = z.enum(['p1', 'p2', 'p3', 'p4', 'p5']);
const STATUS = z.enum(['todo', 'in progress']);
const SIZE = z.enum(['S', 'M', 'L']);

async function visibleRepoSlugs(): Promise<string[]> {
  const [all, hidden] = await Promise.all([listRepos(), getHiddenRepos()]);
  const hiddenSet = new Set(hidden);
  return all.filter((r) => !hiddenSet.has(r.slug)).map((r) => r.slug);
}

export async function GET(req: NextRequest) {
  const stateParam = req.nextUrl.searchParams.get('state') ?? 'open';
  const state = (['open', 'closed', 'all'] as const).includes(stateParam as never)
    ? (stateParam as 'open' | 'closed' | 'all')
    : 'open';
  const repoParam = req.nextUrl.searchParams.get('repo');

  try {
    let repos: string[];
    if (repoParam) {
      if (!(await isOwnedRepo(repoParam))) {
        return NextResponse.json({ error: 'repo not allowed' }, { status: 400 });
      }
      repos = [repoParam];
    } else {
      repos = await visibleRepoSlugs();
    }
    // The default board view (state=open) also includes recently-closed issues
    // so the Kanban's Done column has content; explicit closed/all bypass that.
    const issues = state === 'open' ? await listBoardIssues(repos) : await listIssues(repos, state);
    return NextResponse.json({ issues });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

const CreateSchema = z.object({
  repo: z.string(),
  title: z.string().min(1),
  body: z.string().default(''),
  priority: PRIORITY.default('p3'),
  status: STATUS.default('todo'),
  size: SIZE.default('M'),
});

export async function POST(req: NextRequest) {
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  if (!(await isOwnedRepo(parsed.data.repo))) {
    return NextResponse.json({ error: 'repo not allowed' }, { status: 400 });
  }
  try {
    const issue = await createIssue(
      parsed.data.repo,
      parsed.data.title,
      parsed.data.body,
      parsed.data.priority,
      parsed.data.status,
      parsed.data.size,
    );
    return NextResponse.json({ issue });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

const PatchSchema = z.object({
  repo: z.string(),
  number: z.number().int().positive(),
  priority: PRIORITY.optional(),
  status: STATUS.optional(),
  size: SIZE.optional(),
  state: z.enum(['open', 'closed']).optional(),
  body: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  if (!(await isOwnedRepo(parsed.data.repo))) {
    return NextResponse.json({ error: 'repo not allowed' }, { status: 400 });
  }
  try {
    await updateIssue(parsed.data.repo, parsed.data.number, {
      priority: parsed.data.priority,
      status: parsed.data.status,
      size: parsed.data.size,
      state: parsed.data.state,
      body: parsed.data.body,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
