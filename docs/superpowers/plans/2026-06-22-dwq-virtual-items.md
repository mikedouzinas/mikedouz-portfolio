# Harlequin Virtual Items (DWQ core slice) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Supabase-backed layer of virtual (non-code) projects and their items to THE HARLEQUIN, so Claude (from the vault or a cloud session) can create projects + add/fetch items, and the board renders them alongside the code-repo lanes.

**Architecture:** Two new Supabase tables (`dev_projects`, `dev_items`) with RLS deny-by-default — reachable only via the service-role key. A server lib (`src/lib/dev/items.ts`) wraps CRUD (mirroring `src/lib/dev/hidden.ts`). Two owner-gated API routes (`/api/dev/projects` GET, `/api/dev/items/[id]` PATCH) serve the board, which the existing edge middleware already guards. A new, self-contained `VirtualProjectBoard` component renders virtual projects on `/dev` — it does NOT reuse the GitHub-specific `IssueList`. The vault is a *separate* access point: it talks to Supabase directly with the service-role key (no website API), documented as a contract.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript (strict), `@supabase/supabase-js` (service-role admin client), Zod, `tsx` assertion scripts for verification.

> **REVISION (2026-06-22, post-review):** Task 4's separate `VirtualProjectBoard`
> component was the wrong call — per Mike, a virtual project must appear as *just
> another project on the board*, its items rendered as **normal tickets** in the
> same lanes/repo-sections, distinguished only by name + a `vault` tag. The build
> was reworked: `dev_items` reconcile to the GitHub ticket model (priority, status
> `todo|in progress|awaiting review`, size, **done = closed_at**); items map to
> `DevIssue` (with `source:'virtual'`/`itemId`) and render through the existing
> `IssueCard`/`IssueList`; the card's single `onPatch` routes virtual items to
> `/api/dev/items/[id]` by source; `page.tsx` merges virtual projects into `repos`
> + `issues`. `VirtualProjectBoard` was deleted. Verified live (status + repo
> grouping, full PATCH parity incl. complete/reopen, 400 on bad status). The task
> bodies below describe the original separate-section design; the shipped code
> follows this revision.

## Global Constraints

- **TypeScript strict mode, no `any`.** Zod validation at every API boundary. (CLAUDE.md)
- **No unit-test framework in repo.** Verification = `tsx` assertion scripts run via npm, plus curl / Playwright against a running dev server. Mirror `scripts/test_dev_console.ts` (node:assert, dynamic imports, dotenv `.env.local`).
- **Run the dev server on PORT 3001** — a parallel session owns 3000. `PORT=3001 npm run dev`.
- **Default private.** `iris_visible` defaults `false`; RLS is deny-by-default so the public anon key has zero access. Only the service-role key (site server + vault) can read/write.
- **Never edit existing migration files.** Add a new timestamped file under `supabase/migrations/`.
- **Do NOT touch the GitHub-Issues code board.** No changes to `github.ts`, `/api/dev/issues`, `IssueList.tsx` behavior. This work is purely additive.
- **Env vars:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (read via `@/lib/env` → `getSupabaseAdmin()`). Worktree needs `.env.local` (copy from the main checkout) to run Supabase scripts + the server.
- **Out of scope (defer; name in PR, don't silently add):** artifacts / Supabase Storage (Vol 3 cover); public exposure (`iris_visible: true` → Iris public KB, `page_id` → `projects.json`); editing item *bodies* from the board (status changes only); migrating code tickets off GitHub Issues.
- **`dev_items` status enum is `todo | in_progress | done`** — its own enum, intentionally distinct from the GitHub board's `todo | in progress | awaiting review` + closed=Done.

## File Structure

- Create `supabase/migrations/20260622000001_dev_projects_items.sql` — the two tables + RLS.
- Create `src/lib/dev/items.ts` — types, Zod schemas, service-role CRUD. One responsibility: virtual project/item data access.
- Create `src/app/api/dev/projects/route.ts` — `GET` projects-with-items for the board.
- Create `src/app/api/dev/items/[id]/route.ts` — `PATCH` item status.
- Create `src/components/dev/VirtualProjectBoard.tsx` — renders virtual projects + lanes + status dropdown + `iris_visible` badge.
- Modify `src/app/dev/page.tsx` — fetch `/api/dev/projects`, render `VirtualProjectBoard` above `IssueList`.
- Create `scripts/test_dev_items.ts` + npm script `test:dev:items` — CRUD round-trip against Supabase.
- Create `scripts/seed_dwq.ts` + npm script `seed:dwq` — create the Deep Work Queue project + sample items (proves create/fetch/add from a Node/cloud session; the end-to-end test).
- Create `docs/harlequin/vault-items-contract.md` — the vault's direct-Supabase contract (the vault-side CLAUDE.md/skill is a follow-up in the `the-mv-vault` repo, out of scope here).

---

### Task 1: Migration — `dev_projects` + `dev_items` tables

**Files:**
- Create: `supabase/migrations/20260622000001_dev_projects_items.sql`
- Test: `scripts/test_dev_items.ts` (added in Task 2 proves the tables are live; here we apply + smoke-check via the SQL editor)

**Interfaces:**
- Produces: tables `public.dev_projects` (PK `id text`) and `public.dev_items` (PK `id uuid`, FK `project_id → dev_projects.id`). Consumed by Task 2's lib.

- [ ] **Step 1: Write the migration SQL**

```sql
-- 20260622000001_dev_projects_items.sql
-- Virtual (non-code) projects + their items for THE HARLEQUIN.
-- Code projects keep using GitHub Issues; this is the Supabase-backed layer.

create table if not exists public.dev_projects (
  id           text primary key,                 -- slug, e.g. "deep-work-queue"
  name         text not null,
  kind         text not null default 'virtual'
                 check (kind in ('virtual', 'code')),
  vault_path   text,                             -- folder/file in the-mv-vault (nullable)
  iris_visible boolean not null default false,   -- gates any future flow to Iris/public
  created_at   timestamptz not null default now()
);

create table if not exists public.dev_items (
  id          uuid primary key default gen_random_uuid(),
  project_id  text not null references public.dev_projects(id) on delete cascade,
  title       text not null,
  body        text not null default '',          -- markdown, supports `- [ ]` subtasks
  status      text not null default 'todo'
                check (status in ('todo', 'in_progress', 'done')),
  size        text check (size in ('S', 'M', 'L')),
  vault_ref   text,                              -- relative path to originating vault note
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  closed_at   timestamptz
);

create index if not exists dev_items_project_id_idx on public.dev_items (project_id);

-- RLS deny-by-default: no policies => anon/public key gets ZERO access.
-- Reachable only via the SERVICE_ROLE key (site server + vault), which bypasses RLS.
alter table public.dev_projects enable row level security;
alter table public.dev_items    enable row level security;

comment on table public.dev_projects is 'Virtual (non-code) projects for the Harlequin board.';
comment on table public.dev_items    is 'Items belonging to a virtual project.';
```

- [ ] **Step 2: Apply the migration**

Apply against the project's Supabase DB using whichever path Mike uses for the existing migrations:
- Supabase Dashboard → SQL Editor → paste the file contents → Run, **or**
- `supabase db push` if the Supabase CLI is linked to the project.

Expected: both tables created, no error. (`create table if not exists` makes re-runs safe.)

- [ ] **Step 3: Smoke-check the tables exist**

In the SQL editor run:
```sql
select count(*) from public.dev_projects;
select count(*) from public.dev_items;
```
Expected: both return `0` (tables exist, empty). If you get "relation does not exist", the migration didn't apply.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260622000001_dev_projects_items.sql
git commit -m "feat(harlequin): dev_projects + dev_items tables (RLS deny-by-default)"
```

---

### Task 2: Data lib — `src/lib/dev/items.ts`

**Files:**
- Create: `src/lib/dev/items.ts`
- Create: `scripts/test_dev_items.ts`
- Modify: `package.json` (add `test:dev:items` script)

**Interfaces:**
- Consumes: `getSupabaseAdmin()` from `@/lib/supabaseAdmin`.
- Produces:
  - Types: `DevItemStatus = 'todo'|'in_progress'|'done'`, `DevItemSize = 'S'|'M'|'L'`, `DevProject`, `DevItem`, `DevProjectWithItems`.
  - Functions: `listProjectsWithItems(): Promise<DevProjectWithItems[]>`, `createProject(input): Promise<DevProject>`, `addItem(input): Promise<DevItem>`, `getItemsForProject(projectId: string): Promise<DevItem[]>`, `updateItemStatus(id: string, status: DevItemStatus): Promise<DevItem>`, `deleteProject(id: string): Promise<void>`.
  - Zod schemas: `createProjectSchema`, `addItemSchema`, `updateItemStatusSchema`.

- [ ] **Step 1: Write the lib**

```ts
/**
 * Virtual (non-code) projects + items for THE HARLEQUIN.
 * Stored in Supabase (dev_projects, dev_items), accessed via the service-role
 * client (RLS deny-by-default — only this key can read/write). The vault is a
 * SEPARATE access point that talks to the same tables directly.
 */
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export type DevItemStatus = 'todo' | 'in_progress' | 'done';
export type DevItemSize = 'S' | 'M' | 'L';

export interface DevProject {
  id: string;
  name: string;
  kind: 'virtual' | 'code';
  vaultPath: string | null;
  irisVisible: boolean;
  createdAt: string;
}

export interface DevItem {
  id: string;
  projectId: string;
  title: string;
  body: string;
  status: DevItemStatus;
  size: DevItemSize | null;
  vaultRef: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface DevProjectWithItems extends DevProject {
  items: DevItem[];
}

export const createProjectSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, 'id must be a kebab-case slug'),
  name: z.string().min(1),
  vaultPath: z.string().min(1).optional(),
  irisVisible: z.boolean().optional(),
});

export const addItemSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  body: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  size: z.enum(['S', 'M', 'L']).optional(),
  vaultRef: z.string().optional(),
});

export const updateItemStatusSchema = z.object({
  status: z.enum(['todo', 'in_progress', 'done']),
});

interface ProjectRow {
  id: string;
  name: string;
  kind: 'virtual' | 'code';
  vault_path: string | null;
  iris_visible: boolean;
  created_at: string;
}
interface ItemRow {
  id: string;
  project_id: string;
  title: string;
  body: string;
  status: DevItemStatus;
  size: DevItemSize | null;
  vault_ref: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

function toProject(r: ProjectRow): DevProject {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    vaultPath: r.vault_path,
    irisVisible: r.iris_visible,
    createdAt: r.created_at,
  };
}
function toItem(r: ItemRow): DevItem {
  return {
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    body: r.body,
    status: r.status,
    size: r.size,
    vaultRef: r.vault_ref,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    closedAt: r.closed_at,
  };
}

export async function listProjectsWithItems(): Promise<DevProjectWithItems[]> {
  const db = getSupabaseAdmin();
  const { data: projects, error: pErr } = await db
    .from('dev_projects')
    .select('*')
    .order('created_at', { ascending: true });
  if (pErr) throw new Error(pErr.message);

  const { data: items, error: iErr } = await db
    .from('dev_items')
    .select('*')
    .order('created_at', { ascending: true });
  if (iErr) throw new Error(iErr.message);

  const byProject = new Map<string, DevItem[]>();
  for (const row of (items ?? []) as ItemRow[]) {
    const it = toItem(row);
    const arr = byProject.get(it.projectId) ?? [];
    arr.push(it);
    byProject.set(it.projectId, arr);
  }
  return ((projects ?? []) as ProjectRow[]).map((p) => ({
    ...toProject(p),
    items: byProject.get(p.id) ?? [],
  }));
}

export async function createProject(
  input: z.infer<typeof createProjectSchema>,
): Promise<DevProject> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('dev_projects')
    .insert({
      id: input.id,
      name: input.name,
      kind: 'virtual',
      vault_path: input.vaultPath ?? null,
      iris_visible: input.irisVisible ?? false,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return toProject(data as ProjectRow);
}

export async function addItem(
  input: z.infer<typeof addItemSchema>,
): Promise<DevItem> {
  const db = getSupabaseAdmin();
  const status = input.status ?? 'todo';
  const { data, error } = await db
    .from('dev_items')
    .insert({
      project_id: input.projectId,
      title: input.title,
      body: input.body ?? '',
      status,
      size: input.size ?? null,
      vault_ref: input.vaultRef ?? null,
      closed_at: status === 'done' ? new Date().toISOString() : null,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return toItem(data as ItemRow);
}

export async function getItemsForProject(projectId: string): Promise<DevItem[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('dev_items')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ItemRow[]).map(toItem);
}

export async function updateItemStatus(
  id: string,
  status: DevItemStatus,
): Promise<DevItem> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('dev_items')
    .update({
      status,
      updated_at: new Date().toISOString(),
      closed_at: status === 'done' ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return toItem(data as ItemRow);
}

export async function deleteProject(id: string): Promise<void> {
  const db = getSupabaseAdmin();
  // dev_items cascade-delete via FK.
  const { error } = await db.from('dev_projects').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 2: Write the failing test script**

```ts
// scripts/test_dev_items.ts — CRUD round-trip against the real Supabase tables.
import assert from 'node:assert';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('SKIP: Supabase env not configured (.env.local missing).');
    return;
  }
  const {
    createProject,
    addItem,
    getItemsForProject,
    updateItemStatus,
    listProjectsWithItems,
    deleteProject,
  } = await import('../src/lib/dev/items');

  const id = 'zzz-test-' + Math.floor(Date.now() / 1000); // unique-ish, no Math.random needed
  try {
    const proj = await createProject({ id, name: 'Test Project', vaultPath: 'x/y.md' });
    assert.equal(proj.id, id, 'project created with id');
    assert.equal(proj.irisVisible, false, 'iris_visible defaults false');

    const a = await addItem({ projectId: id, title: 'item A', size: 'M' });
    assert.equal(a.status, 'todo', 'item defaults to todo');
    assert.equal(a.closedAt, null, 'non-done item has null closed_at');

    const b = await addItem({ projectId: id, title: 'item B', status: 'done' });
    assert.ok(b.closedAt, 'done item gets closed_at on insert');

    const items = await getItemsForProject(id);
    assert.equal(items.length, 2, 'two items fetched for project');

    const updated = await updateItemStatus(a.id, 'done');
    assert.equal(updated.status, 'done', 'status updated to done');
    assert.ok(updated.closedAt, 'closed_at set when moved to done');
    const reopened = await updateItemStatus(a.id, 'todo');
    assert.equal(reopened.closedAt, null, 'closed_at cleared when leaving done');

    const all = await listProjectsWithItems();
    const mine = all.find((p) => p.id === id);
    assert.ok(mine, 'project appears in listProjectsWithItems');
    assert.equal(mine!.items.length, 2, 'project carries its items');

    console.log('PASS: dev_items CRUD round-trip');
  } finally {
    await deleteProject(id); // cleanup (cascades items)
  }
}

main().catch((e) => {
  console.error('FAIL:', e);
  process.exit(1);
});
```

- [ ] **Step 3: Add the npm script**

In `package.json` scripts, after the `test:dev` line add:
```json
    "test:dev:items": "tsx scripts/test_dev_items.ts",
```

- [ ] **Step 4: Run the test**

Run: `npm run test:dev:items`
Expected: `PASS: dev_items CRUD round-trip` (or `SKIP` if `.env.local` is absent — copy it from the main checkout first). If it fails with "relation does not exist", Task 1's migration wasn't applied.

- [ ] **Step 5: Typecheck + lint the new lib**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors in `src/lib/dev/items.ts` or `scripts/test_dev_items.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dev/items.ts scripts/test_dev_items.ts package.json
git commit -m "feat(harlequin): dev items data lib + CRUD round-trip test"
```

---

### Task 3: API routes — board read + item status write

**Files:**
- Create: `src/app/api/dev/projects/route.ts`
- Create: `src/app/api/dev/items/[id]/route.ts`

**Interfaces:**
- Consumes: `listProjectsWithItems`, `updateItemStatus`, `updateItemStatusSchema` from `@/lib/dev/items`.
- Produces:
  - `GET /api/dev/projects` → `{ projects: DevProjectWithItems[] }`
  - `PATCH /api/dev/items/[id]` with body `{ status: DevItemStatus }` → `{ item: DevItem }`
- Auth: both paths match the edge middleware matcher `/api/dev/:path*` (`src/middleware.ts`), so an invalid session is already 401'd before the handler runs. No extra in-handler guard needed (consistent with `/api/dev/issues`).

- [ ] **Step 1: Write the projects GET route**

```ts
// src/app/api/dev/projects/route.ts
import { NextResponse } from 'next/server';
import { listProjectsWithItems } from '@/lib/dev/items';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const projects = await listProjectsWithItems();
    return NextResponse.json({ projects });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write the item PATCH route**

```ts
// src/app/api/dev/items/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { updateItemStatus, updateItemStatusSchema } from '@/lib/dev/items';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const parsed = updateItemStatusSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  try {
    const item = await updateItemStatus(id, parsed.data.status);
    return NextResponse.json({ item });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. (Note Next 16 route handler param typing: `params` is a `Promise` — awaited above.)

- [ ] **Step 4: Verify the routes live against the dev server**

Start the server: `PORT=3001 npm run dev` (separate terminal).
Mint a dev session cookie and hit the routes (the routes are middleware-gated, so an unauthenticated call must 404/401, an authenticated one must 200):

```bash
# Unauthenticated → blocked by middleware
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/dev/projects
# Expected: 401

# Authenticated: mint a token from DEV_SESSION_SECRET (same trick as Playwright testing),
# then call with the dev_session cookie.
TOKEN=$(npx tsx -e "import('dotenv').then(d=>{d.config({path:'.env.local'});import('./src/lib/dev/session').then(s=>s.signSession(Date.now()).then(t=>console.log(t)))})")
curl -s -H "Cookie: dev_session=$TOKEN" http://localhost:3001/api/dev/projects
# Expected: {"projects":[...]} including any project seeded in Task 5 (or [] if none yet)
```
Expected: 401 unauthenticated; `{"projects":[...]}` authenticated.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/dev/projects/route.ts src/app/api/dev/items
git commit -m "feat(harlequin): /api/dev/projects (GET) + /api/dev/items/[id] (PATCH)"
```

---

### Task 4: Board UI — `VirtualProjectBoard` + page wiring

**Files:**
- Create: `src/components/dev/VirtualProjectBoard.tsx`
- Modify: `src/app/dev/page.tsx`

**Interfaces:**
- Consumes: `DevProjectWithItems`, `DevItem`, `DevItemStatus` from `@/lib/dev/items`; `Dropdown` from `@/components/ui/Dropdown`.
- Produces: `<VirtualProjectBoard projects={...} onStatusChange={(itemId, status) => void} />`.

- [ ] **Step 1: Write the component**

```tsx
// src/components/dev/VirtualProjectBoard.tsx
'use client';

import { useState } from 'react';
import { Dropdown } from '@/components/ui/Dropdown';
import type { DevItem, DevItemStatus, DevProjectWithItems } from '@/lib/dev/items';

const LANES: { key: DevItemStatus; label: string; dot: string }[] = [
  { key: 'todo', label: 'Todo', dot: '#4285F4' },
  { key: 'in_progress', label: 'In Progress', dot: '#d4a72c' },
  { key: 'done', label: 'Done', dot: '#1DB954' },
];

const STATUS_OPTS = LANES.map((l) => ({ value: l.key, label: l.label, color: l.dot }));

function ItemCard({
  item,
  onStatusChange,
}: {
  item: DevItem;
  onStatusChange: (itemId: string, status: DevItemStatus) => void;
}) {
  return (
    <div className="rounded-lg border border-[#e7e2d4]/12 bg-[#0e0c12]/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-white/90">{item.title}</p>
        {item.size && (
          <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/60 ring-1 ring-white/15">
            {item.size}
          </span>
        )}
      </div>
      {item.body && <p className="mt-1 line-clamp-3 text-xs text-white/50">{item.body}</p>}
      <div className="mt-2">
        <Dropdown
          ariaLabel="Status"
          value={item.status}
          options={STATUS_OPTS}
          onChange={(v) => onStatusChange(item.id, v as DevItemStatus)}
        />
      </div>
    </div>
  );
}

export function VirtualProjectBoard({
  projects,
  onStatusChange,
}: {
  projects: DevProjectWithItems[];
  onStatusChange: (itemId: string, status: DevItemStatus) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  if (projects.length === 0) return null;

  return (
    <section className="mb-8 space-y-6">
      {projects.map((p) => {
        const isCollapsed = collapsed[p.id];
        return (
          <div key={p.id} className="rounded-xl border border-[#e7e2d4]/12 p-4">
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [p.id]: !c[p.id] }))}
              className="flex w-full items-center gap-3 text-left"
            >
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#e7e2d4]/85">
                {p.name}
              </h2>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ring-1 ${
                  p.irisVisible
                    ? 'text-emerald-300 ring-emerald-400/40'
                    : 'text-white/40 ring-white/15'
                }`}
                title={p.irisVisible ? 'Visible to Iris' : 'Private (not visible to Iris)'}
              >
                {p.irisVisible ? 'iris' : 'private'}
              </span>
              <span className="ml-auto text-xs text-white/40">{p.items.length} items</span>
            </button>

            {!isCollapsed && (
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                {LANES.map((lane) => {
                  const laneItems = p.items.filter((i) => i.status === lane.key);
                  return (
                    <div key={lane.key} className="space-y-2">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/45">
                        <span className="h-2 w-2 rounded-full" style={{ background: lane.dot }} />
                        {lane.label}
                        <span className="text-white/30">{laneItems.length}</span>
                      </div>
                      {laneItems.map((item) => (
                        <ItemCard key={item.id} item={item} onStatusChange={onStatusChange} />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
```

- [ ] **Step 2: Wire into the dev page — imports + state + fetch**

In `src/app/dev/page.tsx`, add to the imports near the other `@/components/dev` imports:
```tsx
import { VirtualProjectBoard } from '@/components/dev/VirtualProjectBoard';
import type { DevProjectWithItems, DevItemStatus } from '@/lib/dev/items';
```
Add state next to the existing `useState` declarations (after the `issues` state):
```tsx
  const [projects, setProjects] = useState<DevProjectWithItems[]>([]);
```
Add a loader + status-change handler after `loadIssues`/`refreshIssues`:
```tsx
  const loadProjects = useCallback(async () => {
    const res = await fetch('/api/dev/projects', { cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as { projects: DevProjectWithItems[] };
      setProjects(data.projects);
    }
  }, []);

  const onItemStatusChange = useCallback(
    async (itemId: string, status: DevItemStatus) => {
      await fetch(`/api/dev/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await loadProjects();
    },
    [loadProjects],
  );
```
Add a mount effect next to the existing `loadRepos`/`loadIssues` effects:
```tsx
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- on-mount data fetch, not derived state
    loadProjects();
  }, [loadProjects]);
```

- [ ] **Step 3: Render the board above `IssueList`**

In `src/app/dev/page.tsx`, inside the `<main>`, immediately before the `<div className={`relative ${showLoader ...`}>` wrapper that holds the loader/IssueList, insert:
```tsx
        {!loading && (
          <VirtualProjectBoard projects={projects} onStatusChange={onItemStatusChange} />
        )}
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 5: Verify on the running board (Playwright or manual)**

With `PORT=3001 npm run dev` running and a project seeded (Task 5), and a minted `dev_session` cookie injected (do NOT clear Mike's cookies — only `addCookies` to overwrite `dev_session`), load `http://localhost:3001/dev`.
Expected: the Deep Work Queue project renders above the repo board, with Todo / In Progress / Done lanes, a `private` badge, items in the right lanes, and changing an item's status dropdown moves it to the new lane after refresh.

- [ ] **Step 6: Commit**

```bash
git add src/components/dev/VirtualProjectBoard.tsx src/app/dev/page.tsx
git commit -m "feat(harlequin): render virtual projects + items on the board"
```

---

### Task 5: DWQ end-to-end seed + vault contract doc

**Files:**
- Create: `scripts/seed_dwq.ts`
- Modify: `package.json` (add `seed:dwq` script)
- Create: `docs/harlequin/vault-items-contract.md`

**Interfaces:**
- Consumes: `createProject`, `addItem`, `getItemsForProject` from `@/lib/dev/items`.
- Produces: the `deep-work-queue` project + sample items in Supabase; documentation of the vault's direct-Supabase access.

- [ ] **Step 1: Write the seed/e2e script**

This proves the brief's first end-to-end test: a Node/cloud session can create a virtual project, add items, and fetch them back. Idempotent (safe to re-run).

```ts
// scripts/seed_dwq.ts — create the Deep Work Queue project + sample items.
// Proves create + add + fetch from a non-browser session (the vault/cloud path).
import assert from 'node:assert';
import { config } from 'dotenv';
config({ path: '.env.local' });

const PROJECT_ID = 'deep-work-queue';

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('SKIP: Supabase env not configured (.env.local missing).');
    return;
  }
  const { createProject, addItem, getItemsForProject, deleteProject } = await import(
    '../src/lib/dev/items'
  );

  // Idempotent: clear any prior seed so re-runs are clean.
  await deleteProject(PROJECT_ID).catch(() => {});

  await createProject({
    id: PROJECT_ID,
    name: 'Deep Work Queue',
    vaultPath: 'Deep Work Queue.md',
    irisVisible: false,
  });

  // Sample entries — the vault replaces these with real Deep Work Queue.md rows.
  await addItem({ projectId: PROJECT_ID, title: 'Design Lantern Vol 3 cover', size: 'L', vaultRef: 'Deep Work Queue.md' });
  await addItem({ projectId: PROJECT_ID, title: 'Draft the next blog post', size: 'M', status: 'in_progress', vaultRef: 'Deep Work Queue.md' });
  await addItem({ projectId: PROJECT_ID, title: 'Ship awaiting-review board state', size: 'M', status: 'done', vaultRef: 'Deep Work Queue.md' });

  const items = await getItemsForProject(PROJECT_ID);
  assert.equal(items.length, 3, 'three DWQ items seeded + fetched');
  console.log(`PASS: seeded Deep Work Queue with ${items.length} items (fetch confirmed).`);
}

main().catch((e) => {
  console.error('FAIL:', e);
  process.exit(1);
});
```

- [ ] **Step 2: Add the npm script**

In `package.json` scripts, after `test:dev:items` add:
```json
    "seed:dwq": "tsx scripts/seed_dwq.ts",
```

- [ ] **Step 3: Run the seed (the end-to-end proof)**

Run: `npm run seed:dwq`
Expected: `PASS: seeded Deep Work Queue with 3 items (fetch confirmed).`
This satisfies the brief's done-criterion that a non-browser session can create a project + add + fetch items.

- [ ] **Step 4: Write the vault contract doc**

```markdown
# Vault → Harlequin items contract

The vault (`the-mv-vault`) and cloud Claude sessions are a SEPARATE access point
from the website. They talk to Supabase DIRECTLY with the service-role key — they
do NOT call the website's `/api/dev/*` endpoints and do NOT need `DEV_SESSION_SECRET`.

## Tables
- `dev_projects` — one row per virtual project. **Created only from the vault.**
  Columns: `id` (kebab slug), `name`, `kind` ('virtual'), `vault_path`,
  `iris_visible` (default false), `created_at`.
- `dev_items` — items under a project. Addable from the vault OR the board.
  Columns: `id` (uuid), `project_id` (FK), `title`, `body` (markdown, `- [ ]`
  subtasks), `status` ('todo'|'in_progress'|'done'), `size` ('S'|'M'|'L'),
  `vault_ref`, `created_at`, `updated_at`, `closed_at`.

## Access
Connect with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (service-role bypasses
RLS; RLS is deny-by-default so the anon key sees nothing). Example:

\`\`\`ts
import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
// create a project (vault-only):
await db.from('dev_projects').insert({ id: 'deep-work-queue', name: 'Deep Work Queue', vault_path: 'Deep Work Queue.md' });
// add an item:
await db.from('dev_items').insert({ project_id: 'deep-work-queue', title: '...', size: 'M', vault_ref: 'Deep Work Queue.md' });
// fetch items:
const { data } = await db.from('dev_items').select('*').eq('project_id', 'deep-work-queue');
\`\`\`

## Rules
- **Projects: vault-only.** Never create projects from the board UI.
- **Items: either side.** Write `vault_ref` back so the note ↔ item point at each other.
- **iris_visible defaults false.** Flipping it to expose a project to Iris/public is a
  later, out-of-scope step.

## Follow-up (separate repo)
The vault-side CLAUDE.md note + skill that wraps the above live in the `the-mv-vault`
repo, not here.
```

- [ ] **Step 5: Verify the seeded board renders (ties Tasks 4 + 5 together)**

With the seed applied and `PORT=3001 npm run dev` running, reload `/dev` (authenticated). Confirm Deep Work Queue shows 3 items across Todo (1) / In Progress (1) / Done (1), and a status change persists after reload.

- [ ] **Step 6: Commit**

```bash
git add scripts/seed_dwq.ts package.json docs/harlequin/vault-items-contract.md
git commit -m "feat(harlequin): DWQ seed/e2e script + vault items contract doc"
```

---

## Self-Review

**Spec coverage (against the 6/22 brief "In scope" + "Done criteria"):**
1. `dev_projects` table → Task 1. ✓
2. `dev_items` table → Task 1. ✓
3. Vault ↔ site API — *reinterpreted per Mike's 6/22 clarification*: the vault uses **direct Supabase access** (Task 5 doc + proven by `seed_dwq.ts`), not website endpoints. The website's own board needs read + status-write, delivered as `/api/dev/projects` GET + `/api/dev/items/[id]` PATCH (Task 3). ✓
4. Board read side renders virtual projects + items with an `iris_visible` badge → Task 4. ✓
5. Vault on-ramp → Task 5 contract doc; actual vault CLAUDE.md/skill flagged as out-of-repo follow-up. ✓
- Security: RLS deny-by-default (Task 1), `iris_visible` default false (Tasks 1–2), no whole-vault sync (only explicit inserts). ✓
- Done criteria: tables + owner-only API (middleware-gated) ✓; create/add/fetch from a non-browser session (`seed_dwq.ts`) ✓; board renders alongside code repos ✓; no regression to the GitHub board (purely additive, code board untouched) ✓.

**Placeholder scan:** No TBD/TODO; every code step has complete code. Sample DWQ items are explicitly labeled as vault-replaceable, not placeholders in the plan sense.

**Type consistency:** `DevItemStatus`/`DevItemSize`/`DevProject`/`DevItem`/`DevProjectWithItems` defined in Task 2 and consumed verbatim in Tasks 3–5. Function names (`listProjectsWithItems`, `createProject`, `addItem`, `getItemsForProject`, `updateItemStatus`, `deleteProject`) match across tasks. Status enum `todo|in_progress|done` consistent in SQL CHECK, Zod, types, and UI lanes.

**Deferred (named, not built):** Supabase Storage / artifacts; `iris_visible: true` → Iris public KB + `page_id` → `projects.json`; board-side body editing; code-ticket migration.
