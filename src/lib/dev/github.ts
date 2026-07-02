/**
 * GitHub access for the dev-console board.
 * - Repos are DISCOVERED live (no hardcoded list); owned repos are the security boundary.
 * - Priority = label p1..p5. Status = label "status: todo" | "status: in progress" | "status: awaiting review".
 *   Size = label "size: S" | "size: M" | "size: L". Done = a closed issue (no Done label).
 * - Priority/status/size labels are ensured WITH COLORS (idempotent) per repo.
 * Uses GITHUB_TOKEN (server-only).
 */
const GH = 'https://api.github.com';

export type Priority = 'p1' | 'p2' | 'p3' | 'p4' | 'p5';
export type Status = 'todo' | 'in progress' | 'awaiting review';
export type Size = 'S' | 'M' | 'L';

const PRIORITY_RE = /^p[1-5]$/;
const STATUS_RE = /^status:\s*(todo|in progress|awaiting review)$/i;
const SIZE_RE = /^size:\s*([SML])$/i;
const STATUS_LABEL: Record<Status, string> = {
  todo: 'status: todo',
  'in progress': 'status: in progress',
  'awaiting review': 'status: awaiting review',
};
const SIZE_LABEL: Record<Size, string> = {
  S: 'size: S',
  M: 'size: M',
  L: 'size: L',
};

/** Label color definitions (hex, no #). */
const LABEL_DEFS: { name: string; color: string }[] = [
  { name: 'p1', color: 'b60205' }, // red — highest
  { name: 'p2', color: 'd93f0b' }, // orange
  { name: 'p3', color: 'fbca04' }, // yellow
  { name: 'p4', color: '0e8a16' }, // green
  { name: 'p5', color: 'c5def5' }, // light blue — lowest
  { name: 'status: todo', color: 'ededed' }, // gray
  { name: 'status: in progress', color: 'd4a72c' }, // amber
  { name: 'status: awaiting review', color: 'e7b34a' }, // champagne-amber
  { name: 'size: S', color: '4285f4' }, // blue — small / quick
  { name: 'size: M', color: 'fbca04' }, // yellow — medium
  { name: 'size: L', color: 'fb923c' }, // orange — large / deep
];

const ACCENTS = [
  '147, 197, 253', '52, 211, 153', '168, 85, 247', '251, 146, 60',
  '244, 114, 182', '45, 212, 191', '250, 204, 21', '129, 140, 248',
];

export interface DevRepo {
  slug: string; // "owner/name"
  name: string;
  accent: string; // "R, G, B"
  pushedAt: string;
  archived: boolean;
  fork: boolean;
  private: boolean;
}

export interface DevIssue {
  repo: string;
  number: number;
  title: string;
  body: string;
  priority: Priority | null;
  status: Status | null;
  size: Size | null;
  state: 'open' | 'closed';
  url: string;
  createdAt: string;
  updatedAt: string;
  // Set for Supabase-backed virtual-project items so the board can route their
  // mutations to /api/dev/items/[itemId] instead of GitHub. Undefined === a real
  // GitHub issue. `number` is unused (0) for virtual items; `itemId` is the key.
  source?: 'github' | 'virtual';
  itemId?: string;
}

function ghHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN not configured');
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'mikeveson-dev-console',
  };
}

function accentFor(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

interface GhLabel { name: string }
interface GhRepo {
  full_name: string;
  name: string;
  pushed_at: string;
  archived: boolean;
  fork: boolean;
  private: boolean;
}
interface GhIssue {
  number: number;
  title: string;
  body: string | null;
  labels: GhLabel[];
  state: 'open' | 'closed';
  html_url: string;
  created_at: string;
  updated_at: string;
  pull_request?: unknown;
}

function priorityOf(labels: GhLabel[]): Priority | null {
  const hit = labels.map((l) => l.name).find((n) => PRIORITY_RE.test(n));
  return (hit as Priority) ?? null;
}
function statusOf(labels: GhLabel[]): Status | null {
  for (const l of labels) {
    const m = l.name.match(STATUS_RE);
    if (m) return m[1].toLowerCase() as Status;
  }
  return null;
}
function sizeOf(labels: GhLabel[]): Size | null {
  for (const l of labels) {
    const m = l.name.match(SIZE_RE);
    if (m) return m[1].toUpperCase() as Size;
  }
  return null;
}

// ---- Review-block helpers (pure, no network) ----

export interface ReviewBlock { preview?: string; test?: string; feedback?: string }

const REVIEW_START = '<!-- awaiting-review:start -->';
const REVIEW_END = '<!-- awaiting-review:end -->';
const REVIEW_RE = /<!-- awaiting-review:start -->[\s\S]*?<!-- awaiting-review:end -->/;

/** Idempotently insert or replace the awaiting-review marker block in an issue body. */
export function upsertReviewBlock(body: string, fields: ReviewBlock): string {
  const existing = parseReviewBlock(body) ?? {};
  const merged: ReviewBlock = { ...existing, ...fields };
  const lines = [REVIEW_START];
  if (merged.preview) lines.push(`**Preview:** ${merged.preview}`);
  if (merged.test) lines.push(`**What to test:** ${merged.test}`);
  if (merged.feedback) lines.push(`**Last feedback:** ${merged.feedback}`);
  lines.push(REVIEW_END);
  const block = lines.join('\n');
  if (REVIEW_RE.test(body)) return body.replace(REVIEW_RE, block);
  const sep = body.trim().length ? `${body.trimEnd()}\n\n` : '';
  return `${sep}${block}\n`;
}

/** Parse the review block out of an issue body; returns null when absent. */
export function parseReviewBlock(body: string): ReviewBlock | null {
  const m = body.match(REVIEW_RE);
  if (!m) return null;
  const seg = m[0];
  const pick = (label: string) => {
    const r = new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`);
    const hit = seg.match(r);
    return hit ? hit[1].trim() : undefined;
  };
  return { preview: pick('Preview'), test: pick('What to test'), feedback: pick('Last feedback') };
}

/**
 * Derive the Vercel branch-preview URL for a given branch name.
 * Pattern: <project>-git-<branch-slug>-<team>.vercel.app (max 63 chars).
 * Project: mikedouz-portfolio, team: mikedouzinas.
 *
 * IMPORTANT: verify this alias against the live Vercel project dashboard
 * (Settings → Git → Preview Deployments) before relying on --auto mode.
 * Use --preview <url> (Task 3) as the guaranteed fallback.
 */
export function previewUrlForBranch(branch: string): string {
  const slug = branch
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const host = `mikedouz-portfolio-git-${slug}-mikedouzinas.vercel.app`.slice(0, 63);
  return `https://${host.replace(/-+$/, '')}`;
}

// ---- Issue comment helpers ----

export async function postComment(repo: string, number: number, body: string): Promise<void> {
  const res = await fetch(`${GH}/repos/${repo}/issues/${number}/comments`, {
    method: 'POST',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(`GitHub comment ${repo}#${number}: ${res.status}`);
}

// ---- Repo discovery (cached) ----
interface RepoCache { data: DevRepo[]; expiry: number }
declare global {
  var __devRepoCache: RepoCache | undefined;
}
const REPO_TTL_MS = 10 * 60 * 1000;

export async function listRepos(nowMs = Date.now()): Promise<DevRepo[]> {
  const cache = globalThis.__devRepoCache;
  if (cache && nowMs < cache.expiry) return cache.data;

  const repos: DevRepo[] = [];
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(
      `${GH}/user/repos?per_page=100&page=${page}&affiliation=owner&sort=pushed`,
      { headers: ghHeaders() },
    );
    if (!res.ok) throw new Error(`GitHub repos: ${res.status}`);
    const arr = (await res.json()) as GhRepo[];
    for (const r of arr) {
      repos.push({
        slug: r.full_name,
        name: r.name,
        accent: accentFor(r.full_name),
        pushedAt: r.pushed_at,
        archived: r.archived,
        fork: r.fork,
        private: r.private,
      });
    }
    if (arr.length < 100) break;
  }
  globalThis.__devRepoCache = { data: repos, expiry: nowMs + REPO_TTL_MS };
  return repos;
}

/** Security boundary: a repo is writable only if Mike owns it. */
export async function isOwnedRepo(slug: string): Promise<boolean> {
  return (await listRepos()).some((r) => r.slug === slug);
}

// ---- Labels (idempotent ensure with colors) ----
const ensured = new Set<string>();

async function ensureLabels(repo: string): Promise<void> {
  if (ensured.has(repo)) return;
  await Promise.all(
    LABEL_DEFS.map(async (def) => {
      const create = await fetch(`${GH}/repos/${repo}/labels`, {
        method: 'POST',
        headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: def.name, color: def.color }),
      });
      if (create.status === 422) {
        // Already exists — sync its color.
        const patch = await fetch(`${GH}/repos/${repo}/labels/${encodeURIComponent(def.name)}`, {
          method: 'PATCH',
          headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ color: def.color }),
        });
        if (!patch.ok) throw new Error(`GitHub label sync ${repo}/${def.name}: ${patch.status}`);
      }
    }),
  );
  ensured.add(repo);
}

// ---- Issues ----
export async function listIssues(
  repos: string[],
  state: 'open' | 'closed' | 'all' = 'open',
  since?: string,
): Promise<DevIssue[]> {
  const sinceParam = since ? `&since=${encodeURIComponent(since)}` : '';
  const perRepo = await Promise.all(
    repos.map(async (repo) => {
      // >100 issues per repo isn't expected for this board; add pagination if it ever is.
      const res = await fetch(
        `${GH}/repos/${repo}/issues?state=${state}&per_page=100${sinceParam}`,
        { headers: ghHeaders() },
      );
      if (!res.ok) throw new Error(`GitHub list ${repo}: ${res.status}`);
      const arr = (await res.json()) as GhIssue[];
      return arr
        .filter((i) => !i.pull_request)
        .map<DevIssue>((i) => ({
          repo,
          number: i.number,
          title: i.title,
          body: i.body ?? '',
          priority: priorityOf(i.labels ?? []),
          status: statusOf(i.labels ?? []),
          size: sizeOf(i.labels ?? []),
          state: i.state,
          url: i.html_url,
          createdAt: i.created_at,
          updatedAt: i.updated_at,
        }));
    }),
  );
  return perRepo
    .flat()
    .sort(
      (a, b) =>
        (a.priority ?? 'p9').localeCompare(b.priority ?? 'p9') ||
        b.updatedAt.localeCompare(a.updatedAt),
    );
}

/**
 * Board view: every open issue plus issues closed within the last `days` so the
 * Kanban's "Done" column shows recent wins without dragging in years of history.
 * GitHub's `since` filters by updated_at; closing an issue bumps that, so it's a
 * good proxy for "recently closed".
 */
export async function listBoardIssues(
  repos: string[],
  days = 7,
  nowMs = Date.now(),
): Promise<DevIssue[]> {
  const since = new Date(nowMs - days * 24 * 60 * 60 * 1000).toISOString();
  const [open, closed] = await Promise.all([
    listIssues(repos, 'open'),
    listIssues(repos, 'closed', since),
  ]);
  return [...open, ...closed.filter((i) => i.state === 'closed')];
}

export async function createIssue(
  repo: string,
  title: string,
  body: string,
  priority: Priority,
  status: Status,
  size: Size,
): Promise<DevIssue> {
  await ensureLabels(repo);
  const res = await fetch(`${GH}/repos/${repo}/issues`, {
    method: 'POST',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body, labels: [priority, STATUS_LABEL[status], SIZE_LABEL[size]] }),
  });
  if (!res.ok) throw new Error(`GitHub create ${repo}: ${res.status} ${await res.text()}`);
  const i = (await res.json()) as GhIssue;
  return {
    repo,
    number: i.number,
    title: i.title,
    body: i.body ?? '',
    priority,
    status,
    size,
    state: i.state,
    url: i.html_url,
    createdAt: i.created_at,
    updatedAt: i.updated_at,
  };
}

export async function updateIssue(
  repo: string,
  number: number,
  patch: {
    priority?: Priority;
    status?: Status;
    size?: Size;
    state?: 'open' | 'closed';
    title?: string;
    body?: string;
  },
): Promise<void> {
  await ensureLabels(repo);
  const payload: Record<string, unknown> = {};

  if (patch.priority || patch.status || patch.size) {
    const cur = await fetch(`${GH}/repos/${repo}/issues/${number}`, { headers: ghHeaders() });
    if (!cur.ok) throw new Error(`GitHub get ${repo}#${number}: ${cur.status}`);
    const issue = (await cur.json()) as GhIssue;
    let names = (issue.labels ?? []).map((l) => l.name);
    if (patch.priority) names = names.filter((n) => !PRIORITY_RE.test(n)).concat(patch.priority);
    if (patch.status) names = names.filter((n) => !STATUS_RE.test(n)).concat(STATUS_LABEL[patch.status]);
    if (patch.size) names = names.filter((n) => !SIZE_RE.test(n)).concat(SIZE_LABEL[patch.size]);
    payload.labels = names;
  }
  if (patch.state) payload.state = patch.state;
  if (typeof patch.title === 'string') payload.title = patch.title;
  if (typeof patch.body === 'string') payload.body = patch.body;
  if (Object.keys(payload).length === 0) return;

  const res = await fetch(`${GH}/repos/${repo}/issues/${number}`, {
    method: 'PATCH',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`GitHub patch ${repo}#${number}: ${res.status}`);
}

// ---- PR / commit / timeline reads ----
// Read-only views over repo activity, for ranking (#36), reconciliation (#49),
// and digests (#57). Same auth/owned-repo model as the issue reads.

export interface DevCommit {
  repo: string;
  sha: string;
  /** First line of the commit message. */
  message: string;
  /** GitHub login when linked, else the raw commit author name. */
  author: string | null;
  date: string;
  url: string;
}

export interface DevPull {
  repo: string;
  number: number;
  title: string;
  state: 'open' | 'closed';
  draft: boolean;
  merged: boolean;
  headRef: string;
  baseRef: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
}

export interface DevTimelineEvent {
  /** GitHub timeline event name: commented, labeled, closed, cross-referenced, committed, … */
  event: string;
  actor: string | null;
  createdAt: string | null;
  /** Compact event-specific context: label name, commit headline, comment excerpt, cross-ref. */
  detail?: string;
}

interface GhCommit {
  sha: string;
  html_url: string;
  commit: { message: string; committer: { date: string } | null; author: { name?: string } | null };
  author: { login: string } | null;
}

interface GhPull {
  number: number;
  title: string;
  state: 'open' | 'closed';
  draft: boolean;
  html_url: string;
  head: { ref: string };
  base: { ref: string };
  created_at: string;
  updated_at: string;
  merged_at: string | null;
}

interface GhTimelineEvent {
  event?: string;
  actor?: { login: string } | null;
  created_at?: string;
  label?: { name: string };
  body?: string;
  sha?: string;
  message?: string;
  author?: { name?: string } | null;
  source?: { issue?: { number: number; title: string; pull_request?: unknown } };
}

/** Recent commits on the default branch, newest first. Empty repos yield []. */
export async function listCommits(
  repo: string,
  opts: { since?: string; perPage?: number } = {},
): Promise<DevCommit[]> {
  const params = new URLSearchParams({ per_page: String(opts.perPage ?? 30) });
  if (opts.since) params.set('since', opts.since);
  const res = await fetch(`${GH}/repos/${repo}/commits?${params}`, { headers: ghHeaders() });
  if (res.status === 409) return []; // GitHub's "Git Repository is empty"
  if (!res.ok) throw new Error(`GitHub commits ${repo}: ${res.status}`);
  const arr = (await res.json()) as GhCommit[];
  return arr.map((c) => ({
    repo,
    sha: c.sha,
    message: (c.commit.message ?? '').split('\n', 1)[0],
    author: c.author?.login ?? c.commit.author?.name ?? null,
    date: c.commit.committer?.date ?? '',
    url: c.html_url,
  }));
}

/** Pull requests for a repo, most recently updated first. */
export async function listPulls(
  repo: string,
  state: 'open' | 'closed' | 'all' = 'open',
  perPage = 30,
): Promise<DevPull[]> {
  const res = await fetch(
    `${GH}/repos/${repo}/pulls?state=${state}&per_page=${perPage}&sort=updated&direction=desc`,
    { headers: ghHeaders() },
  );
  if (!res.ok) throw new Error(`GitHub pulls ${repo}: ${res.status}`);
  const arr = (await res.json()) as GhPull[];
  return arr.map((p) => ({
    repo,
    number: p.number,
    title: p.title,
    state: p.state,
    draft: p.draft,
    merged: p.merged_at !== null,
    headRef: p.head.ref,
    baseRef: p.base.ref,
    url: p.html_url,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    mergedAt: p.merged_at,
  }));
}

/**
 * An issue's timeline (comments, label changes, close/reopen, cross-references,
 * linked commits), oldest first, mapped to a compact event list.
 */
export async function listIssueTimeline(
  repo: string,
  number: number,
  perPage = 100,
): Promise<DevTimelineEvent[]> {
  const res = await fetch(
    `${GH}/repos/${repo}/issues/${number}/timeline?per_page=${perPage}`,
    { headers: ghHeaders() },
  );
  if (!res.ok) throw new Error(`GitHub timeline ${repo}#${number}: ${res.status}`);
  const arr = (await res.json()) as GhTimelineEvent[];
  return arr.map((e) => {
    let detail: string | undefined;
    if (e.label?.name) detail = e.label.name;
    else if (e.event === 'committed') detail = (e.message ?? '').split('\n', 1)[0] || e.sha;
    else if (e.event === 'commented' && e.body) detail = e.body.length > 140 ? `${e.body.slice(0, 140)}…` : e.body;
    else if (e.event === 'cross-referenced' && e.source?.issue) {
      const kind = e.source.issue.pull_request ? 'PR' : 'issue';
      detail = `${kind} #${e.source.issue.number}: ${e.source.issue.title}`;
    }
    return {
      event: e.event ?? 'unknown',
      actor: e.actor?.login ?? e.author?.name ?? null,
      createdAt: e.created_at ?? null,
      detail,
    };
  });
}
