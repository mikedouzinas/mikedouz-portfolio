# Awaiting Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Awaiting Review" board status with a pinned review section where Mike clicks a live per-feature Vercel preview link, sees what to test, and approves (→Done) or sends back with in-app feedback.

**Architecture:** Extend the existing GitHub-Issues-as-board model with a third status label (`status: awaiting review`). A new marker-delimited block in the issue body carries the preview URL + "what to test" + last feedback. Agents flip status + write the block via a new `board handoff` CLI step (the automation). The board UI pulls awaiting-review items into a pinned section with Test/Approve/Send-back; send-back posts a GitHub comment and mirrors the latest feedback into the body block.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript (strict, no `any`), Zod at boundaries, Tailwind, Framer Motion, GitHub REST via `src/lib/dev/github.ts`, CLI via `tsx scripts/board.ts`.

## Global Constraints

- **No lint regressions:** `npm run lint` must stay exit 0 (it is currently clean).
- **Type-clean + builds:** `npx tsc --noEmit` and `npm run build` must pass (exit 0) at every commit.
- **No `any`** (TS strict); **Zod at every API boundary**.
- **No unit-test framework exists** in this repo. Pure logic gets a `tsx` assertion script under `scripts/`; API/UI/network code is verified by `tsc` + `npm run build` + a stated manual check.
- **Status is a literal union, not a lookup** — adding a value means editing it in lockstep across: `github.ts` (type/regex/label-def/label-map), `uiMeta.ts` (STATUS_META), `route.ts` (zod), `cere.ts` (zod + tool schemas), `IssueList.tsx` (dropdown/lanes). Miss one → type error or runtime drop.
- **Theme (the `/dev` board):** champagne duotone, Limelight display font, the grid, Google-rainbow as flicker only, **no Marcellus**.
- **Vercel preview-alias pattern is the one real unknown** — Task 2 verifies it before anything relies on it.
- **Frequent commits:** one per task minimum.

---

### Task 1: Add `awaiting review` to the status model (lockstep type change)

**Files:**
- Modify: `src/lib/dev/github.ts` (type line 12, `STATUS_RE` line 16, `STATUS_LABEL` line 18, `LABEL_DEFS` lines 29-40)
- Modify: `src/lib/dev/uiMeta.ts` (`STATUS_META` lines 19-22)
- Modify: `src/app/api/dev/issues/route.ts` (`STATUS` zod line 9)
- Modify: `src/lib/dev/cere.ts` (`STATUS` zod ~line 25 and the create/update tool input schemas ~lines 40, 68)
- Modify: `src/components/dev/IssueList.tsx` (`STATUS_OPTS` line 38)

**Interfaces:**
- Produces: `type Status = 'todo' | 'in progress' | 'awaiting review'` (github.ts) — every later task relies on this.
- Produces: label string `'status: awaiting review'` and `STATUS_META['awaiting review'] = { label: 'Awaiting review', color: '#e7b34a' }` (champagne-amber, distinct from in-progress amber).

- [ ] **Step 1: Extend the `Status` type and label plumbing in `github.ts`**

```ts
// line 12
export type Status = 'todo' | 'in progress' | 'awaiting review';

// line 16 — widen the regex
const STATUS_RE = /^status:\s*(todo|in progress|awaiting review)$/i;

// lines 18-21 — add to the label map
const STATUS_LABEL: Record<Status, string> = {
  todo: 'status: todo',
  'in progress': 'status: in progress',
  'awaiting review': 'status: awaiting review',
};

// in LABEL_DEFS (after the 'status: in progress' entry, ~line 36)
  { name: 'status: awaiting review', color: 'e7b34a' }, // champagne-amber
```

- [ ] **Step 2: Add the UI metadata in `uiMeta.ts`**

```ts
// STATUS_META (lines 19-22)
export const STATUS_META: Record<Status, { label: string; color: string }> = {
  todo: { label: 'Todo', color: '#4285F4' },
  'in progress': { label: 'In progress', color: '#FBBC05' },
  'awaiting review': { label: 'Awaiting review', color: '#E7B34A' },
};
```

- [ ] **Step 3: Widen the Zod enums (boundaries)**

```ts
// src/app/api/dev/issues/route.ts line 9
const STATUS = z.enum(['todo', 'in progress', 'awaiting review']);
```
```ts
// src/lib/dev/cere.ts — the STATUS z.enum (~line 25) AND every status enum inside the
// create_issue / update_issue tool input schemas (~lines 40, 68). Use the same 3-value list.
z.enum(['todo', 'in progress', 'awaiting review'])
```

- [ ] **Step 4: Add the dropdown option in `IssueList.tsx`**

```ts
// STATUS_OPTS (line 38) — include awaiting review so the status dropdown can set it
const STATUS_OPTS = (['todo', 'in progress', 'awaiting review'] as Status[]).map((s) => ({
  value: s,
  label: STATUS_META[s].label,
  color: STATUS_META[s].color,
}));
```

- [ ] **Step 5: Verify type + build**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit 0. (tsc surfaces any status switch/lookup that became non-exhaustive — fix those before moving on.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/dev/github.ts src/lib/dev/uiMeta.ts src/app/api/dev/issues/route.ts src/lib/dev/cere.ts src/components/dev/IssueList.tsx
git commit -m "feat(board): add 'awaiting review' status across the type/label/zod/ui chain (#79)"
```

---

### Task 2: Pure helpers — review-block upsert/parse + preview-URL derivation

**Files:**
- Modify: `src/lib/dev/github.ts` (add exported pure helpers near the top-level helpers)
- Create: `scripts/test_awaiting_review.ts` (tsx assertion script)

**Interfaces:**
- Produces: `interface ReviewBlock { preview?: string; test?: string; feedback?: string }`
- Produces: `function upsertReviewBlock(body: string, fields: ReviewBlock): string` — idempotent; inserts or replaces the marker block, preserving the rest of the body.
- Produces: `function parseReviewBlock(body: string): ReviewBlock | null`
- Produces: `function previewUrlForBranch(branch: string): string` — Vercel branch-alias URL.

- [ ] **Step 1: Confirm the Vercel preview-alias pattern (the one unknown)**

Run: `cat vercel.json` and check the Vercel project (dashboard → Settings → Git) for the project name + team slug, and confirm "Preview Deployments" are on for branches.
Expected: you can state the exact alias format. Vercel's branch alias is `<project>-git-<branch-slug>-<team>.vercel.app`, where the branch slug lowercases, replaces non-alphanumerics with `-`, and the whole alias is truncated to 63 chars. Record the real `<project>` and `<team>` values; put them in `previewUrlForBranch` in Step 3. If branch previews are OFF or the team alias differs, note it and use the deployment-status fallback (Task 3, Step 4) as primary instead.

- [ ] **Step 2: Write the failing assertion script**

```ts
// scripts/test_awaiting_review.ts
import { upsertReviewBlock, parseReviewBlock, previewUrlForBranch } from '../src/lib/dev/github';

function assert(cond: boolean, msg: string) { if (!cond) { console.error('FAIL:', msg); process.exit(1); } }

// upsert into empty body
const a = upsertReviewBlock('Original body.', { preview: 'https://x.test', test: 'open /dev' });
assert(a.includes('Original body.'), 'preserves body');
assert(a.includes('<!-- awaiting-review:start -->') && a.includes('<!-- awaiting-review:end -->'), 'has markers');
assert((a.match(/awaiting-review:start/g) ?? []).length === 1, 'single block');

// upsert is idempotent (replace, not append)
const b = upsertReviewBlock(a, { preview: 'https://y.test', test: 'open /dev', feedback: 'looks off' });
assert((b.match(/awaiting-review:start/g) ?? []).length === 1, 'still single block after re-upsert');
assert(b.includes('https://y.test') && !b.includes('https://x.test'), 'replaced preview');
assert(b.includes('looks off'), 'feedback written');

// parse round-trips
const parsed = parseReviewBlock(b);
assert(parsed?.preview === 'https://y.test' && parsed?.test === 'open /dev' && parsed?.feedback === 'looks off', 'parse round-trip');
assert(parseReviewBlock('no block here') === null, 'null when absent');

// slug derivation
const url = previewUrlForBranch('feat/Awaiting_Review #79');
assert(url.startsWith('https://') && /^[a-z0-9.-]+$/.test(url.replace('https://','')), 'url is a clean host');
assert(!url.includes('_') && !url.includes('#') && !url.includes(' '), 'branch sanitized');

console.log('ALL PASS');
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx tsx scripts/test_awaiting_review.ts`
Expected: FAIL (the three functions are not exported yet).

- [ ] **Step 4: Implement the helpers in `github.ts`**

```ts
export interface ReviewBlock { preview?: string; test?: string; feedback?: string }

const REVIEW_START = '<!-- awaiting-review:start -->';
const REVIEW_END = '<!-- awaiting-review:end -->';
const REVIEW_RE = /<!-- awaiting-review:start -->[\s\S]*?<!-- awaiting-review:end -->/;

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

// Replace <project> and <team> with the verified values from Step 1.
export function previewUrlForBranch(branch: string): string {
  const slug = branch
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const host = `mikedouz-portfolio-git-${slug}-mikedouzinas.vercel.app`.slice(0, 63);
  return `https://${host.replace(/-+$/,'')}`;
}
```

- [ ] **Step 5: Run the script to verify it passes**

Run: `npx tsx scripts/test_awaiting_review.ts`
Expected: `ALL PASS`. Then `npx tsc --noEmit` → exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dev/github.ts scripts/test_awaiting_review.ts
git commit -m "feat(board): review-block upsert/parse + Vercel branch-preview URL helpers (#79)"
```

---

### Task 3: github.ts comment helpers + `board handoff` CLI command

**Files:**
- Modify: `src/lib/dev/github.ts` (add `postComment`, `getLatestComment`)
- Modify: `scripts/board.ts` (add `handoff` to dispatch ~line 198-213; add `cmdHandoff`; extend `HELP`)

**Interfaces:**
- Consumes: `updateIssue`, `upsertReviewBlock`, `previewUrlForBranch`, `listIssues` (Tasks 1-2 + existing).
- Produces: `async function postComment(repo: string, number: number, body: string): Promise<void>`
- Produces: `async function getLatestComment(repo: string, number: number): Promise<string | null>`
- Produces: CLI `npm run board -- handoff --repo <r> --number <n> (--preview <url> | --auto --branch <b>) --test "<what to test>"`

- [ ] **Step 1: Add comment helpers in `github.ts`** (use the existing `GH`, `ghHeaders()` helpers seen at lines 169-190)

```ts
export async function postComment(repo: string, number: number, body: string): Promise<void> {
  const res = await fetch(`${GH}/repos/${repo}/issues/${number}/comments`, {
    method: 'POST',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(`GitHub comment ${repo}#${number}: ${res.status}`);
}

export async function getLatestComment(repo: string, number: number): Promise<string | null> {
  const res = await fetch(`${GH}/repos/${repo}/issues/${number}/comments?per_page=100`, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`GitHub comments ${repo}#${number}: ${res.status}`);
  const arr = (await res.json()) as { body: string }[];
  return arr.length ? arr[arr.length - 1].body : null;
}
```

- [ ] **Step 2: Add `cmdHandoff` in `board.ts`** (mirror the existing `cmdUpdate` shape, lines 140-170; reuse `requireRepo`, `str`)

```ts
async function cmdHandoff(flags: Flags): Promise<void> {
  const repo = await requireRepo(flags);
  const number = Number(str(flags, 'number'));
  if (!Number.isInteger(number) || number <= 0) fail('--number <N> is required.');
  const test = str(flags, 'test');
  if (!test) fail('--test "<what to test>" is required.');

  let preview = str(flags, 'preview');
  if (!preview && flags['auto']) {
    const branch = str(flags, 'branch');
    if (!branch) fail('--auto needs --branch <name> (or pass --preview <url>).');
    const { previewUrlForBranch } = await import('../src/lib/dev/github');
    preview = previewUrlForBranch(branch);
  }
  if (!preview) fail('Provide --preview <url> or --auto --branch <name>.');

  const { listIssues, updateIssue, upsertReviewBlock } = await import('../src/lib/dev/github');
  const [issue] = await listIssues([repo], 'all').then((all) => all.filter((i) => i.number === number));
  if (!issue) fail(`#${number} not found in ${repo}.`);
  const body = upsertReviewBlock(issue.body, { preview, test });
  await updateIssue(repo, number, { status: 'awaiting review', body });
  console.log(`✓ handoff #${number} → awaiting review\n  Test: ${preview}`);
}
```

- [ ] **Step 3: Wire dispatch + HELP** (add to the `switch (cmd)` at lines 198-213)

```ts
    case 'handoff':
      return cmdHandoff(flags);
```
Add a HELP line: `board handoff --repo <r> --number <N> (--preview <url> | --auto --branch <b>) --test "<what to test>"`.

- [ ] **Step 4: Manual verification against a throwaway state**

Run: `npm run board -- handoff --repo mikedouzinas/mikedouz-portfolio --number 78 --preview https://example.test --test "run npm run lint, expect exit 0"`
Then: `npm run board -- list --repo mikedouzinas/mikedouz-portfolio --state all --json | grep -A2 '"number": 78'`
Expected: #78 shows `status: awaiting review`; `gh issue view 78 --repo mikedouzinas/mikedouz-portfolio --json body -q .body` shows the marker block with the preview + what-to-test. (Then reset #78 with `--status "in progress"` if desired.)

- [ ] **Step 5: tsc + commit**

Run: `npx tsc --noEmit` → exit 0.
```bash
git add src/lib/dev/github.ts scripts/board.ts
git commit -m "feat(board): board handoff command + issue comment helpers (#79)"
```

---

### Task 4: API — send-back (comment + feedback mirror) and approve

**Files:**
- Modify: `src/app/api/dev/issues/route.ts` (extend `PatchSchema` lines 76-85 + handler 87-106)

**Interfaces:**
- Consumes: `updateIssue`, `postComment`, `getLatestComment`, `upsertReviewBlock`, `parseReviewBlock`, `listIssues`.
- Produces: PATCH accepts optional `feedback?: string`. When present: post a GitHub comment with the feedback, set `status: 'in progress'`, and mirror `feedback` into the body's review block (so the board renders it without fetching comments). Approve uses the existing `state: 'closed'`.

- [ ] **Step 1: Extend the Zod schema**

```ts
const PatchSchema = z.object({
  repo: z.string(),
  number: z.number().int().positive(),
  priority: PRIORITY.optional(),
  status: STATUS.optional(),
  size: SIZE.optional(),
  state: z.enum(['open', 'closed']).optional(),
  title: z.string().min(1).optional(),
  body: z.string().optional(),
  feedback: z.string().min(1).optional(), // send-back review feedback
});
```

- [ ] **Step 2: Handle feedback in the PATCH handler** (insert before the existing `updateIssue` call, lines 93-101)

```ts
  const { repo, number, feedback } = parsed.data;
  if (feedback) {
    await postComment(repo, number, `**Review feedback (sent back):**\n\n${feedback}`);
    const [issue] = (await listIssues([repo], 'all')).filter((i) => i.number === number);
    const body = issue ? upsertReviewBlock(issue.body, { feedback }) : undefined;
    await updateIssue(repo, number, { status: 'in progress', body });
    return NextResponse.json({ ok: true });
  }
  // ...existing updateIssue(...) path for non-feedback patches (status/state/etc.)
```
Add the imports for `postComment`, `listIssues`, `upsertReviewBlock` at the top of the route.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: exit 0. Manual: after the UI task, sending back an item posts a comment (`gh issue view <n> --json comments`) and flips it to In progress.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/dev/issues/route.ts
git commit -m "feat(board): send-back posts review feedback as a comment + mirrors it on the ticket (#79)"
```

---

### Task 5: Board UI — pinned Awaiting Review section with Test / Approve / Send back

**Files:**
- Modify: `src/components/dev/IssueList.tsx` (new `AwaitingReviewSection` + a `ReviewActions` sub-component; exclude awaiting-review items from the normal grouping; render the section above both group views, lines ~745+)
- Modify: `src/app/dev/page.tsx` (add `onApprove`/`onSendBack` handlers calling PATCH; pass to IssueList)

**Interfaces:**
- Consumes: `parseReviewBlock` (Task 2), `DevIssue`, `onChanged`/`refreshIssues` (page.tsx lines 38-69), PATCH `/api/dev/issues`.
- Produces (page.tsx): `onApprove(issue: DevIssue): Promise<void>` (PATCH `{ state: 'closed' }` then `refreshIssues()`); `onSendBack(issue: DevIssue, feedback: string): Promise<void>` (PATCH `{ feedback }` then `refreshIssues()`).

- [ ] **Step 1: Add the handlers in `page.tsx`** (near `onCereApplied`, lines 74-86)

```tsx
const patchIssue = useCallback(async (repo: string, number: number, patch: Record<string, unknown>) => {
  await fetch('/api/dev/issues', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo, number, ...patch }),
  });
  await loadIssues(true);
}, [loadIssues]);

const onApprove = useCallback((i: DevIssue) => patchIssue(i.repo, i.number, { state: 'closed' }), [patchIssue]);
const onSendBack = useCallback((i: DevIssue, feedback: string) => patchIssue(i.repo, i.number, { feedback }), [patchIssue]);
```
Pass `onApprove={onApprove} onSendBack={onSendBack}` into `<IssueList ... />` (line ~226). Add both to IssueList's props type.

- [ ] **Step 2: Add `ReviewActions` to `IssueList.tsx`** (a card footer for awaiting-review items)

```tsx
function ReviewActions({ issue, onApprove, onSendBack }: {
  issue: DevIssue;
  onApprove: (i: DevIssue) => void;
  onSendBack: (i: DevIssue, feedback: string) => void;
}) {
  const review = parseReviewBlock(issue.body);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  return (
    <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] p-2 text-xs">
      {review?.test && <p className="mb-2 text-white/70"><span className="text-white/40">Test: </span>{review.test}</p>}
      {review?.feedback && <p className="mb-2 text-amber-300/80">↩ {review.feedback}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {review?.preview && (
          <a href={review.preview} target="_blank" rel="noreferrer"
             className="rounded bg-white/10 px-2 py-1 hover:bg-white/20">Test ↗</a>
        )}
        <button onClick={() => onApprove(issue)} className="rounded bg-emerald-600/80 px-2 py-1 hover:bg-emerald-600">Approve → Done</button>
        <button onClick={() => setOpen((v) => !v)} className="rounded bg-white/10 px-2 py-1 hover:bg-white/20">Send back</button>
      </div>
      {open && (
        <div className="mt-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2}
            placeholder="What needs fixing?"
            className="w-full rounded bg-black/30 p-2 text-white outline-none" />
          <button disabled={!text.trim()} onClick={() => { onSendBack(issue, text.trim()); setOpen(false); setText(''); }}
            className="mt-1 rounded bg-amber-600/80 px-2 py-1 disabled:opacity-40">Send back to In progress</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Render the pinned section + exclude awaiting-review from lanes**

```tsx
// helper near laneOf (line 681)
const isAwaiting = (i: DevIssue) => i.state === 'open' && i.status === 'awaiting review';

// At the top of the IssueList return (before the groupBy branches), render:
const awaiting = sortIssues(issues.filter(isAwaiting), sort);
// ...
{awaiting.length > 0 && (
  <div className="mb-5 rounded-xl border border-[#e7b34a]/30 bg-[#e7b34a]/[0.06] p-3">
    <LaneHeader color="#E7B34A" label="Awaiting review" count={awaiting.length} />
    <div className="flex flex-col gap-3">
      {awaiting.map((i) => (
        <div key={`${i.repo}#${i.number}`}>
          {card(i)}
          <ReviewActions issue={i} onApprove={onApprove} onSendBack={onSendBack} />
        </div>
      ))}
    </div>
  </div>
)}
```
Then exclude awaiting items from the normal views: in the status kanban filter (line 746) change `issues.filter((i) => laneOf(i) === lane.key)` to also require `!isAwaiting(i)`, and in the repo grouping do the same, so awaiting items appear only in the pinned section.

- [ ] **Step 4: Verify build + manual**

Run: `npx tsc --noEmit && npm run lint && npm run build` → all exit 0.
Manual: with #78 in awaiting review (from Task 3), load `/dev` → the pinned "Awaiting review" section shows it with Test ↗ (opens the preview URL), the "what to test" line, Approve, and Send back (textarea → posts comment + returns to In progress). Confirm it's NOT duplicated in the lanes below.

- [ ] **Step 5: Commit**

```bash
git add src/components/dev/IssueList.tsx src/app/dev/page.tsx
git commit -m "feat(board): pinned Awaiting Review section with Test/Approve/Send-back (#79)"
```

---

### Task 6: Document the status + mandatory handoff in the board skill

**Files:**
- Modify: `.claude/skills/harlequin-board/SKILL.md`

**Interfaces:** Consumes the `handoff` CLI from Task 3.

- [ ] **Step 1: Add the status to the conventions table + a handoff rule**

In the status row, document the third value `status: awaiting review`. Add a "When you finish work tied to a ticket" rule:
> After finishing a ticket's work, push your feature branch and run `npm run board -- handoff --repo <r> --number <N> --auto --branch <branch> --test "<what Mike should test>"`. This flips the ticket to **Awaiting review** and attaches the live preview link + what-to-test. Do this instead of leaving it In progress. (Closing/Done stays gated — Mike approves from the board.)

- [ ] **Step 2: Verify + commit**

Read the file back to confirm the table and rule are consistent with Task 1's label name and Task 3's command.
```bash
git add .claude/skills/harlequin-board/SKILL.md
git commit -m "docs(skill): document awaiting-review status + mandatory handoff step (#79)"
```

---

## Self-Review

**Spec coverage:** §1 status model → Task 1. §2 review link/note on issue body → Tasks 2 (block) + 3 (handoff writes it). §3 preview URL → Task 2 Step 1 + `previewUrlForBranch`. §4 board UI (section, Test, Approve, Send-back) → Task 5; in-app feedback → Tasks 4 + 5. §5 automation hook (handoff) → Tasks 3 + 6. §6 later GitHub-native layer → out of scope (designed-for; no task, intentional). All covered.

**Placeholder scan:** Real code in every code step; the only deliberate "verify against reality" is the Vercel alias (Task 2 Step 1) — flagged, not hand-waved, with a concrete fallback.

**Type consistency:** `Status` 3-value union (Task 1) used identically in zod (Task 1), `ReviewBlock`/`upsertReviewBlock`/`parseReviewBlock`/`previewUrlForBranch` (Task 2) consumed verbatim in Tasks 3-5; `onApprove(i)` / `onSendBack(i, feedback)` defined in Task 5 Step 1 and used in Step 2; `postComment`/`getLatestComment` (Task 3) used in Task 4. Consistent.

**Risk:** If Vercel branch previews are off or the alias differs, Task 2 Step 1 catches it and Task 3's `--preview <url>` (explicit) still works while `--auto` is fixed — the feature ships either way.
