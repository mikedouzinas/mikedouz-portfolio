# Automation backlog enrichment — THE HARLEQUIN

Feasibility notes for six board tickets. Grounded in the current code as of 2026-06-18.

## Shared infrastructure baseline (read first)

Everything below builds on the same primitives, so they're stated once here:

- **GitHub data layer** — `src/lib/dev/github.ts`. Issues are plain GitHub Issues; labels encode `p1..p5`, `status: todo|in progress`, `size: S|M|L`; Done = a closed issue. Helpers: `listRepos()` (cached 10m, `affiliation=owner` = the security boundary), `listIssues(repos, state, since)`, `listBoardIssues(repos, days=7)`, `createIssue`, `updateIssue`, `isOwnedRepo`. **There is NO PR/commit/events API helper yet** — no calls to `/pulls`, `/commits`, `/events`, or `search/issues`. Any ticket needing "merged PR" or "commit activity" signals must add those fetchers here.
- **Auth boundary** — `src/middleware.ts` gates all `/api/dev/*` behind the `dev_session` JWT cookie (`src/lib/dev/session.ts`). **Cron jobs cannot call `/api/dev/*` routes** — they have no session cookie. Cron must either call the `github.ts` lib functions directly from a `/api/cron/*` route, or use a separate `CRON_SECRET` bearer check (the established pattern).
- **Scheduling** — Vercel cron already wired in `vercel.json` (`/api/cron/keep-alive`, `/api/cron/spotify-refresh`). Existing cron routes live in `src/app/api/cron/*/route.ts` and self-authenticate with `Authorization: Bearer ${CRON_SECRET}` (see `keep-alive/route.ts`). This is the path of least resistance for #49, #57, and the trigger half of #70. `runtime = 'nodejs'`, `maxDuration` set per-route. No GitHub Actions and no Supabase pg_cron are configured today.
- **Supabase** — service-role client `getSupabaseAdmin()` (`src/lib/supabaseAdmin.ts`), migrations in `supabase/migrations/` (timestamped `YYYYMMDDNNNNNN_name.sql`). RLS-on + service-role-only is the convention (`dev_hidden_repos`). `src/lib/dev/hidden.ts` is the canonical pattern for a small dev-board Supabase table.
- **Email/delivery** — Resend wired via `src/lib/notifySubscribers.ts` + `src/lib/emailTemplates.ts`, env `RESEND_API_KEY` (`src/lib/env.ts`). Cere (the board's Claude filer) lives in `src/lib/dev/cere.ts` + `/api/dev/iris/route.ts` + `src/components/dev/CerePanel.tsx`.
- **Claude** — `@anthropic-ai/sdk`, model id `claude-sonnet-4-6` (`CERE_MODEL` in `cere.ts`), `ANTHROPIC_API_KEY`. Cere already does tool-calling with `CREATE_ISSUE_TOOL` / `UPDATE_ISSUE_TOOL` but **deliberately never executes** — it returns proposed actions and the client confirms. That preview-then-confirm pattern is the template for any agentic guardrail.

---

## #36 (M) — Smart sort / ranking

**What exists.** The board already has three sort modes — `SortBy = 'priority' | 'recent' | 'size'` in `src/components/dev/IssueList.tsx` (`sortIssues()` near line 624; `byPriority` helper ~619; `SIZE_RANK` ~70). The selector is in `src/app/dev/page.tsx` (`SORT_OPTS`, `sort` state, default `'priority'`). Adding a new mode is a one-line addition to the union, `SORT_OPTS`, and `sortIssues`. The reference scorer `src/lib/iris/rankings.ts` exists and is purely additive-weighted-then-normalized-to-0-100 (`computeSkillImportance`, `computeRecency` buckets) — easy to mirror.

**What to add / change.**
- New ranking module, e.g. `src/lib/dev/ranking.ts` — `computeIssueScore(issue, signals)` returning 0–100 from a weighted sum of: priority (p1=high), recency (`updatedAt`, reuse the bucket idea from `rankings.ts:computeRecency`), inverse size (S quick-win bonus or L deep-work bonus — a decision), and **live commit activity** (NEW — requires a GitHub fetcher).
- `SortBy` union + `SORT_OPTS` + `sortIssues()` in `IssueList.tsx`/`page.tsx` get a `'smart'` value. Keep it a **toggle**, not the default, per ticket.
- Commit-activity signal: add `listRecentCommitActivity(repos)` to `src/lib/dev/github.ts` (e.g. `GET /repos/{repo}/commits?since=` or the stats/participation endpoint). This is the only non-trivial dependency.

**Key decision for Mike.** Where does commit activity attach — per-repo (cheap, one fetch per repo, "this repo is hot") or per-issue (needs linking commits/PRs to issue numbers, much harder)? Per-repo is the pragmatic call. Also: client-side scoring (simplest, no API) vs. computing scores server-side in `/api/dev/issues`.

**Build outline.** (1) Add per-repo commit-activity fetcher to `github.ts`. (2) Write `computeIssueScore`. (3) Plumb the signal into the `/api/dev/issues` GET response or fetch separately. (4) Add `'smart'` sort mode + selector option. (5) Tune weights against the live board.

**Proposed ticket update**
- Sort scaffolding already exists in `IssueList.tsx` (`SortBy`, `sortIssues`) + selector in `dev/page.tsx` — adding a `'smart'` mode is a small extension, not new plumbing.
- New `src/lib/dev/ranking.ts` mirroring `rankings.ts` weighted-then-normalized approach; inputs = priority + recency(`updatedAt`) + size + commit activity.
- Blocker: no commit/PR fetcher exists in `github.ts` — add `listRecentCommitActivity()`; recommend **per-repo** activity, not per-issue (per-issue requires commit→issue linking).
- Decision needed: per-repo vs per-issue activity; does L get the bonus (deep work surfaced) or S (quick wins surfaced)?
- Keep it a toggle (default stays `priority`).

---

## #37 (M) — Launchpad (per-repo named links)

**What exists.** Repo selection state is `selected` in `src/app/dev/page.tsx`; repo chips render via `RepoChips` in `src/components/dev/RepoPicker.tsx` (also has `RepoManagePanel`). The Supabase mini-table + service-role-access pattern is fully demonstrated by `dev_hidden_repos` (migration `supabase/migrations/20260608000001_dev_hidden_repos.sql`) and `src/lib/dev/hidden.ts`. The repos API + owner-only write guard pattern is `src/app/api/dev/repos/route.ts` (uses `isOwnedRepo`). All the pieces exist; this is assembly.

**What to add / change.**
- Migration `supabase/migrations/<ts>_dev_links.sql` — `dev_links(id, repo_slug text, label text, url text, sort int default 0, created_at)`, RLS on, service-role-only (copy the `dev_hidden_repos` header comment + RLS lines). Index on `repo_slug`.
- Lib `src/lib/dev/links.ts` — `getLinks(repoSlug)`, `addLink`, `updateLink`, `deleteLink`, `reorderLinks` (mirror `hidden.ts`).
- API `src/app/api/dev/links/route.ts` — GET `?repo=`, POST/PATCH/DELETE guarded by `isOwnedRepo(repo)` exactly like `repos/route.ts`. Lives under the middleware-gated `/api/dev/*` so writes are already session-protected; keep the `isOwnedRepo` check as defense-in-depth.
- UI: a `LinkStrip` component rendered in `dev/page.tsx` above `IssueList` and **only when `selected !== null`** (per the ticket — per-repo, shown on repo select). Edit UI fits the existing `RepoManagePanel` idiom (gear menu → "Manage repos" pattern in `GearMenu.tsx`); add an owner-only edit affordance.
- **Discoverability affordance on repo chips** (ticket explicitly asks): e.g. a small link-count badge or icon on chips in `RepoChips` when a repo has links.

**Key decision for Mike.** Strip is per-repo only, so the "All" view shows no strip — confirm that's intended (vs. a global/pinned links section). Also: inline edit on the board vs. tucked in the gear menu like repo management.

**Build outline.** (1) Migration. (2) `links.ts`. (3) `/api/dev/links` route. (4) `LinkStrip` + wire into `dev/page.tsx` under the repo bar. (5) Edit panel + chip affordance.

**Proposed ticket update**
- Clone the `dev_hidden_repos` stack end-to-end: migration `dev_links(repo_slug,label,url,sort)` (RLS-on, service-role), lib `src/lib/dev/links.ts`, route `src/app/api/dev/links/route.ts` guarded by `isOwnedRepo` (mirror `repos/route.ts`).
- Render a `LinkStrip` in `dev/page.tsx` above `IssueList`, shown only when `selected !== null`; add a has-links badge to chips in `RepoPicker.tsx`.
- Writes are already session-protected by middleware on `/api/dev/*`; keep `isOwnedRepo` as the owner-write check.
- Decision: no strip on the "All" view (per-repo only) — confirm; and inline-edit vs. gear-menu edit.
- This is the dependency for #11 — ship #37 first.

---

## #11 (S) — Seed Launchpad with service links

**What exists.** Nothing yet — pure data seeding. **Hard-depends on #37** (the `dev_links` table + write API must exist first).

**What to add / change.** No new code if #37 ships the write path. Seed via either: a one-off SQL `INSERT` migration `supabase/migrations/<ts>_seed_dev_links.sql`, or POSTs to `/api/dev/links`. Per-product link set from the ticket: Vercel, Supabase, Upstash, Resend, Google Analytics, GoDaddy, Anthropic console, GitHub repo, App Store Connect. These map to specific repo slugs (e.g. the portfolio repo gets all of them; `apollo` / iris-mobile get App Store Connect; etc.).

**Key decision for Mike.** Which repo slug gets which links (the mapping is the actual work). Whether to seed by SQL migration (versioned, reproducible) or by hand through the future edit UI (faster, not in git). Some links are account-global, not repo-specific (Anthropic console, GA) — decide whether to attach them to the portfolio repo or wait for a "global links" concept (ties back to the #37 "All view" decision).

**Build outline.** (1) Finish #37. (2) Build the slug→links mapping. (3) Seed migration or scripted POSTs.

**Proposed ticket update**
- Blocked on #37 (`dev_links` table + API). No new code — data only.
- Deliverable = a slug→links mapping for the 9 services; seed via a `<ts>_seed_dev_links.sql` migration (versioned) or scripted POSTs to `/api/dev/links`.
- Decision: account-global links (Anthropic console, Google Analytics, GoDaddy) — pin to the portfolio repo, or hold for a global-links concept from #37.
- Per-product specifics: App Store Connect → apollo/iris-mobile; Vercel/Supabase/Upstash/Resend → portfolio.

---

## #49 (M) — Auto-reconcile ticket status on schedule

**What exists.** `updateIssue()` already flips status/state (closes issues, sets labels) in `github.ts`. Cron + `CRON_SECRET` auth pattern exists (`/api/cron/keep-alive`). **Missing: the GitHub-native signal source** — no PR fetcher, and GitHub Issues have no built-in "closed by merged PR #N" link in the current `GhIssue` shape (no `timeline`/`events` fetch). The "merged PR → Done" signal requires new GitHub reads.

**What to add / change.**
- New cron route `src/app/api/cron/reconcile/route.ts` (copy `keep-alive`'s `CRON_SECRET` guard, `runtime='nodejs'`). Add `vercel.json` cron entry.
- New GitHub reads in `github.ts`: a way to detect "this issue's linked PR merged." Cheapest reliable signals: (a) `GET /repos/{repo}/issues/{n}/timeline` (cross-referenced/closed events with a merged PR), or (b) scan recently-merged PRs (`GET /repos/{repo}/pulls?state=closed`) for `Fixes #N` / `Closes #N` in the body. GitHub already auto-closes issues on merge when the PR uses closing keywords on the default branch — so often the issue is **already closed** and #49's real job is just normalizing labels (e.g. drop `status: in progress` when closed) and catching the cases GitHub didn't auto-close.
- Guard against fighting manual edits: store last-reconciled state, or only act on issues not touched by a human recently — `updatedAt` vs a stored `reconciled_at` (small Supabase table `dev_reconcile_state`, or skip persistence and only act on clear signals). This is the load-bearing safety concern.

**Key decision for Mike.** How aggressive: (a) only normalize labels on already-closed issues (safe, low value), vs. (b) actively close issues whose linked PR merged (higher value, higher risk of fighting Mike). And the anti-flapping mechanism: timestamp comparison vs. a "don't touch issues edited in the last N hours" rule.

**Build outline.** (1) Add PR/timeline reader to `github.ts`. (2) `cron/reconcile` route + `vercel.json` entry. (3) Reconcile logic with a manual-edit guard. (4) Log actions (console, like keep-alive) before letting it mutate.

**Proposed ticket update**
- Runner: a `/api/cron/reconcile` route with the existing `CRON_SECRET` guard (cron can't hit `/api/dev/*` — no session); add a `vercel.json` cron entry. `updateIssue()` already does the mutation.
- Need new GitHub reads in `github.ts` (no PR/timeline fetcher today): detect merged-PR-closes-issue via issue timeline or scanning closed PRs for `Closes #N`.
- Note: GitHub already auto-closes issues from PR closing-keywords on default branch — so much of #49 is label normalization on already-closed issues + catching the misses.
- Guard against fighting manual edits is the key risk: compare `updatedAt` to a stored `reconciled_at` or skip issues edited in the last N hours.
- Decision: normalize-only (safe) vs. actively close on merge (riskier).

---

## #57 (L) — Weekly productivity digest

**What exists.** `listBoardIssues(repos, days)` already pulls open + recently-closed via the GitHub `since` filter — directly reusable for "completed in past 7d." `listIssues(repos, 'all', since)` gives created/updated windows. Cron pattern exists. Delivery surfaces both exist: Resend (`notifySubscribers.ts` / `emailTemplates.ts`) and Cere/Iris (`/api/dev/iris/route.ts`, `CerePanel.tsx`). "Size-less / no-status" health signals are trivially computable from `DevIssue.size === null` / `status === null`.

**What to add / change.**
- New module `src/lib/dev/digest.ts` — `buildWeeklyDigest(repos, nowMs)` computing: created in 7d, completed (closed) in 7d, still-open ("leftover"), and health flags (stale = `updatedAt` older than N days while open; `size === null`; `status === null`; no priority). Created-vs-closed windows: GitHub Issues list `since` is `updated_at`, not `created_at` — to count **created** accurately, filter by `created_at` from `GET /repos/{repo}/issues?since=` results, or use `search/issues?q=created:>=DATE` (NEW fetcher). Flag this: `listIssues` does not currently expose `created_at` (the `GhIssue` mapping drops it) — add `createdAt` to `DevIssue`.
- New cron route `src/app/api/cron/digest/route.ts` (`CRON_SECRET` guard) + weekly `vercel.json` entry (e.g. `0 9 * * 1`).
- Delivery: **decision below**. If email, reuse Resend + a new template in `emailTemplates.ts`. If Cere, optionally have Claude write the prose summary (`claude-sonnet-4-6`) and store/surface it.

**Key decision for Mike.** Delivery channel — (a) Resend email (passive, no need to open the board; reuses subscriber infra but to a single recipient), or (b) surfaced in Cere/Iris on next board visit (no email, but only seen if he visits). The ticket lists both; pick one (email is the better "weekly" fit). Secondary: does Claude write the narrative summary, or is it a plain templated list?

**Build outline.** (1) Add `createdAt` to `DevIssue` + a created-window fetch in `github.ts`. (2) `digest.ts` aggregator + health signals. (3) `cron/digest` route + `vercel.json` weekly entry. (4) Delivery (Resend template or Cere surface). (5) Optionally Claude-write the summary.

**Proposed ticket update**
- Most data is already available: `listBoardIssues(days=7)` gives recently-closed; `size===null`/`status===null` give health flags. Add stale detection from `updatedAt`.
- Gap: `DevIssue` drops `created_at` — to count tickets *created* in 7d, add `createdAt` to the mapping in `github.ts` (or use `search/issues?q=created:>=`). GitHub `since` filters `updated_at`, not created.
- Runner: `/api/cron/digest` with `CRON_SECRET`, weekly `vercel.json` entry (e.g. Monday 9am).
- Decision: deliver via Resend email (recommended for a weekly cadence — reuses `notifySubscribers`/`emailTemplates`) vs. surface in Cere on next visit. Optional: Claude writes the narrative.
- New `src/lib/dev/digest.ts` for the aggregation + health computation.

---

## #70 (L) — Agentic workflow (autonomous agent works tickets, opens PRs)

**What exists.** The planning half is largely prototyped by **Cere** (`src/lib/dev/cere.ts`): Claude tool-calling over the full board context (`buildCereSystem(repos, issues)`), with a deliberate **propose-then-confirm** safety model (it never executes — the client runs confirmed actions through `/api/dev/issues`). That is exactly the guardrail philosophy #70 needs. Cron trigger pattern exists. `listBoardIssues` + the ranking work from #36 give ticket selection. **Everything for actually writing code + opening PRs is missing** — there is no Claude-Code/codegen runner, no git/branch automation, no `/pulls` write helper in `github.ts`, and crucially **Vercel serverless functions are the wrong host for a long-running coding agent** (max 60s `maxDuration` on the Iris routes; a real agent run takes minutes and needs a checkout + filesystem).

**What to add / change (this is genuinely large).**
- **Runner host decision (biggest):** a Vercel cron route can only *trigger*; it cannot run a multi-minute coding agent with a repo checkout. Realistic options: (a) **GitHub Actions** workflow (NEW `.github/workflows/agent.yml`) running Claude Code / the Agent SDK in CI with repo write + PR scope — best fit, native git + PR, runs minutes-long, none configured today; (b) a separate long-running worker / external service the cron pings; (c) Vercel cron only files/annotates tickets (planning) and a human/Claude-Code finishes. The repo's "related projects" (Apollo, Iris Mobile) show Mike already uses Claude Code as the coding engine — Actions invoking Claude Code is the natural path.
- **Ticket selection:** reuse #36 ranking + a filter (e.g. only `size: S`, `status: todo`, has a checklist) to pick a safe candidate.
- **PR flow:** add PR creation to `github.ts` (`POST /repos/{repo}/pulls` + branch creation), or let the Actions runner handle git/PR directly. Open as **draft PR for review**, never auto-merge — mirrors Cere's confirm-before-apply.
- **Guardrails:** allow-list of repos (reuse `isOwnedRepo` / owned-repo boundary), size cap (only S/M), one-PR-at-a-time, draft-only, a kill switch (Supabase flag or env), and a label like `agent: working` to prevent double-picking. Cere's "plan, don't execute without confirm" is the model — but for code, "execute into a draft PR a human reviews" is the equivalent.

**Key decision for Mike.** Where the agent runs — **GitHub Actions + Claude Code (recommended)** vs. an external worker vs. Vercel-only "planning agent that just files subtasks." This single choice determines all the rest. Secondary: autonomy ceiling (S-only, draft-PR-only, repo allow-list) and the trigger (scheduled vs. on-label like `agent: take-this`).

**Build outline.** (1) Decide runner host (gate everything on this). (2) Candidate-picker (ranking + safety filter). (3) Agent execution (Claude Code in Actions: checkout → work ticket → branch → draft PR). (4) PR/branch helpers (in Actions or `github.ts`). (5) Guardrails: repo allow-list, size cap, `agent: working` label, kill switch. (6) Loop back: PR review = human; on merge, #49 reconciles the ticket to Done.

**Proposed ticket update**
- Planning is already prototyped by Cere (`cere.ts`): Claude tool-calling over board context with propose-then-confirm — reuse that guardrail model (for code: "execute into a draft PR a human reviews").
- Biggest decision/blocker: the runner host. Vercel cron/functions can only *trigger* (60s cap, no checkout). Recommend **GitHub Actions running Claude Code** (native git + PR, minutes-long, repo write scope) — Mike already uses Claude Code on Apollo/iris-mobile. No `.github/workflows` exists today.
- Need NEW PR/branch write helpers (in the Actions runner or `github.ts`); none exist. Open **draft PRs only, never auto-merge**.
- Ticket selection: reuse #36 ranking + a safety filter (e.g. `size: S` + `status: todo` + has checklist); add an `agent: working` label to prevent double-pick.
- Guardrails: owned-repo allow-list (`isOwnedRepo`), size cap, one-PR-at-a-time, kill switch. On merge, #49 auto-reconciles to Done — so #49 is a useful companion.
- Sequencing: depends conceptually on #36 (selection) and pairs with #49 (close-out); #70 is the large terminal piece.
