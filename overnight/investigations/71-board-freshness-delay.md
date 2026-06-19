# Ticket #71 (P2) — Newly filed tickets have significant delay before appearing on the board

**Investigation date:** 2026-06-18
**Scope:** read-only audit of THE HARLEQUIN board (`/dev`) data-fetching + the Cere create → display path.
**Verdict:** Not a caching bug in our code. The delay is GitHub REST list-endpoint replication lag, fully exposed because the board does a blind server round-trip refetch with **no optimistic insert**. Safe to auto-fix (client-only change, no schema/API change required).

---

## How fetching works today (file:line)

### Read path (board → GitHub)
1. **`src/app/dev/page.tsx:51-65`** — `loadIssues(silent)` is the only board read. It calls
   `fetch('/api/dev/issues?state=open[&repo=…]')` with **no fetch options** and writes the result into React state (`setIssues`).
   - `refreshIssues` (`page.tsx:67`) = `loadIssues(true)` — the "silent" in-place refresh used after every mutation.
   - Wired into `<IssueList onChanged={refreshIssues}>` (`page.tsx:198`) and `<CerePanel onApplied={refreshIssues}>` (`page.tsx:218`).
2. **`src/app/api/dev/issues/route.ts:18-42`** — `GET`. For `state=open` it calls `listBoardIssues(repos)` (`route.ts:37`). The handler reads `req.nextUrl.searchParams`, so the route is **dynamic** (not statically cached by Next).
3. **`src/lib/dev/github.ts:240-251`** — `listBoardIssues` = `listIssues(repos,'open')` + `listIssues(repos,'closed',since=7d)`.
4. **`src/lib/dev/github.ts:194-232`** — `listIssues` hits `GET ${GH}/repos/{repo}/issues?state=open&per_page=100` with `{ headers: ghHeaders() }` and **no `cache`/`next` option**. On Next 16 the default for server `fetch` is `no-store`, so this is uncached on every request.

### Caching inventory (what is NOT caching the issue list)
- **No Next route caching**: no `export const dynamic`/`revalidate`, no `force-cache`, no `next: { revalidate }` anywhere under `src/app/api/dev/` or `src/lib/dev/` (grep clean). Default Next 16 `fetch` = uncached.
- **No Upstash/Redis caching of issues**: the only Redis usage in the dev stack is `src/lib/dev/rateLimit.ts` (rate limiting + circuit breaker). The Iris 1h response cache (CLAUDE.md) does **not** touch the board.
- **Repo cache exists but is irrelevant to this bug**: `globalThis.__devRepoCache` (`github.ts:126-160`, 10-min TTL) caches the *repo list*, not issues. A new ticket in an already-known repo is unaffected by it. (Only edge case: filing in a brand-new repo created <10 min ago could be hidden by this cache — not the reported symptom.)
- **`ensured` label set** (`github.ts:168`) and label-ensure calls are write-side only; no effect on reads.
- **Browser HTTP cache**: `loadIssues` uses a plain `fetch(url)` GET with no `cache:'no-store'` and the route sets no `Cache-Control`. A GET with no validators *can* be served from the browser's memory/disk cache, which would compound staleness across reloads. This is a secondary contributor, not the primary cause (see below), but worth hardening.

### Create path (Cere → GitHub → refetch)
- **`src/components/dev/useCere.ts:82-140`** — `confirm()` loops the proposed actions; for a create it `POST`s `/api/dev/issues` (`useCere.ts:92-104`), then after the loop calls **`onApplied()` (`useCere.ts:125`)** = `refreshIssues` = a fresh `GET /api/dev/issues`.
- **`src/app/api/dev/issues/route.ts:53-72`** — `POST` calls `createIssue(...)` and returns the created issue: `NextResponse.json({ issue })`.
- **`src/lib/dev/github.ts:253-281`** — `createIssue` returns a **fully-formed `DevIssue`** (repo, number, title, body, priority, status, size, state, url, updatedAt) built from GitHub's create response.

**Key observation:** the create response already contains everything `IssueList` needs to render a card, but `useCere.confirm()` **throws that object away** (the `res` is only checked for `res.ok`, `useCere.ts:118`) and instead relies on a blind server refetch.

---

## Precise cause of the delay

The refetch logic is correct and runs immediately after create — there is no missing refetch and no stale cache in our code. The board issues a fresh, uncached `GET /repos/{repo}/issues?state=open` the moment `confirm()` finishes.

The delay is **GitHub's own eventual consistency**: a freshly `POST`ed issue is not always immediately returned by the `GET /repos/{owner}/{repo}/issues` list endpoint. There is a short propagation window (typically a few seconds, occasionally longer) between the issue existing (the POST 201 succeeds, the issue is visible at its `html_url`) and it appearing in the list response. Because the board's *only* way to learn about the new ticket is that list endpoint, the user sees "nothing happened," reloads, and the ticket only pops in once GitHub's list has caught up — exactly the "multiple reloads before it shows up" symptom.

Two amplifiers:
1. **No optimistic insert** — we already hold the new `DevIssue` from the POST response but never put it into state, so the UI is 100% at the mercy of GitHub's list lag.
2. **Possible browser GET caching** of `/api/dev/issues` (no `Cache-Control` / no `cache:'no-store'`), which can make even a *post-propagation* reload serve a stale list from the browser cache.

---

## Recommended fix

Two complementary changes; (A) is the real fix, (B) is cheap hardening.

### (A) Optimistic insert on create — primary fix
Thread the created issue back from `confirm()` and merge it into board state immediately, so the card appears the instant the POST returns, regardless of GitHub list lag. The subsequent silent refetch then reconciles (and is idempotent because cards are keyed by `repo#number`).

**Files / functions to change:**
- **`src/components/dev/useCere.ts` — `confirm()` (lines 82-140):**
  - Capture the create response: `const { issue } = await res.json()` for `a.kind === 'create'` (the POST returns `{ issue }`, `route.ts:68`).
  - Collect created issues into an array and hand them to the page. Simplest wiring: change `onApplied` from `() => void` to `(created?: DevIssue[]) => void`, and call `onApplied(createdIssues)` at line 125.
- **`src/app/dev/page.tsx`:**
  - Make `refreshIssues` accept the optimistic batch: before the silent refetch, `setIssues(prev => mergeByKey(prev, created))`, where merge dedupes on `${repo}#${number}` (matches the `IssueList` card key, `IssueList.tsx:700`). Then call `loadIssues(true)` to reconcile.
  - `<CerePanel onApplied={refreshIssues}>` (`page.tsx:218`) and `<IssueList onChanged={refreshIssues}>` (`page.tsx:198`) both keep working — `IssueList` just calls it with no arg (pure refetch), Cere calls it with the new issues.
- The dedupe is essential: when GitHub's list catches up, the refetch returns the same issue; keying by `repo#number` makes the optimistic card and the fetched card the same card (no duplicates, no flicker). `IssueList` already keys cards by `${issue.repo}#${issue.number}` and sorts by priority/updatedAt, so an inserted issue lands in the right lane/order automatically.

> Note: this code lives under `src/` so I did NOT implement it (read-only task). The above is the precise change set for whoever picks it up.

### (B) Disable browser caching of the issues GET — hardening
- In `src/app/dev/page.tsx` `loadIssues`, use `fetch(url, { cache: 'no-store' })` (line 57), and/or set `Cache-Control: no-store` on the GET response in `src/app/api/dev/issues/route.ts` (line 38). Prevents a post-propagation reload from being served a stale list by the browser.

### What is NOT worth doing
- Adding a Redis cache for the issue list would make freshness *worse*, not better — don't.
- Short-polling the list endpoint after create (e.g., retry every 2s for 10s) is a fallback if optimistic insert alone proves flaky, but with (A) it should be unnecessary because the card is already on screen and the next silent refresh reconciles state.

---

## Safe to auto-fix?

**Yes, with a caveat.** Change (B) is a trivial, low-risk one-liner. Change (A) is the correct fix and is purely client-side (no API/schema change), but it touches a shared callback signature (`onApplied`/`onChanged`) used by both `CerePanel` and `IssueList`, and the dedupe-merge must key exactly on `repo#number` to avoid duplicate cards. Because the task is explicitly read-only / no edits under `src/`, **I did not implement it** — flagging for human sign-off, but the design above is drop-in and low-risk.

---

## Proposed ticket update

> **#71 — Board freshness delay: root cause = GitHub list-endpoint lag, no optimistic insert (not our cache)**
>
> Investigated the full Cere create → board display path. The refetch is wired correctly (`useCere.confirm` → `onApplied` → `refreshIssues` → `GET /api/dev/issues`) and there is **no caching of the issue list** in our stack — no Next route/`fetch` cache, no Redis on the board (only `rateLimit.ts` uses Redis), and the repo cache (`__devRepoCache`, 10 min) only caches the repo list, not issues.
>
> Root cause: GitHub's `GET /repos/{repo}/issues` is eventually consistent — a just-`POST`ed issue isn't always in the list response for a few seconds. Since the board learns about new tickets *only* from that list, the user sees nothing until GitHub catches up → "multiple reloads."
>
> Fix: **optimistic insert.** The POST already returns the full new issue (`route.ts:68`, `createIssue` builds a complete `DevIssue`), but `useCere.confirm` discards it. Thread it back through `onApplied(created)`, merge into board state deduped on `repo#number` (the existing card key), then let the silent refetch reconcile. Secondary hardening: `cache: 'no-store'` on the `loadIssues` fetch + `Cache-Control: no-store` on the GET response so a post-propagation reload can't be served a stale browser-cached list.
>
> Effort: S. Client-only, no API/schema change. Card appears instantly on confirm; refetch becomes a silent reconcile rather than the sole source of truth.
