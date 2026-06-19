# Cere capability enrichment — implementation notes

Enrichment notes for three Cere feature tickets. Cere is THE HARLEQUIN's conversational ticket filer (GitHub Issues at `/dev`). These are implementation-grounded notes, **not** implementations. No code in `src/` has been changed.

## How Cere works today (baseline — read this first)

The flow is **plan → preview → confirm**, and the planner deliberately executes nothing:

1. **System prompt is built fresh on every request** by `buildCereSystem(repos, issues)` in `src/lib/dev/cere.ts` (lines 134–168). It is a single template literal containing:
   - a fixed persona/instructions block (who Cere is, sizing rules, subtask rules),
   - a live `repoLines` list (`- owner/name (name)`),
   - a live `issueLines` list of every **open** issue with its indented body,
   - a hardcoded default-repo line: `When Mike doesn't name a repo, default to ${repos[0]?.slug}`.
2. The route `src/app/api/dev/iris/route.ts` (POST handler) fetches `listRepos()` + `getHiddenRepos()` + `listBoardIssues()`, calls `anthropic.messages.create` with model `CERE_MODEL` (`claude-sonnet-4-6`), the system prompt wrapped in a single `cache_control: ephemeral` block, the two tools, and the message history.
3. **Tools** are `CREATE_ISSUE_TOOL` and `UPDATE_ISSUE_TOOL` (cere.ts lines 28–84) — JSON-schema tool definitions. Claude's tool-use blocks are turned into validated, normalized `CereAction[]` by `parseActions()` (lines 175–233), then repo strings are resolved to real owned slugs by `resolveActionRepos()` (lines 239–261). The route returns `{ reply, actions, warnings }` — **it never writes to GitHub.**
4. **Confirm/apply** lives client-side in `src/components/dev/useCere.ts`. `send()` posts to `/api/dev/iris` and stashes the proposed `actions`. `CerePanel.tsx` renders each action (`ActionRow`) with a Confirm/Discard footer. `confirm()` loops the actions and POST/PATCHes each through `/api/dev/issues` — **that route is the security boundary** (`isOwnedRepo` gate, Zod schemas, then `createIssue`/`updateIssue` in `src/lib/dev/github.ts`).

Key consequences for these tickets:
- There is **no persisted Cere config today** — the persona text is a literal in `buildCereSystem`. Changing Cere's behavior currently *requires a code change + redeploy*. (#73 part 1 directly attacks this.)
- Repo matching today is exact-slug or exact-`name`-lowercase (`resolveActionRepos`). There is **no alias layer** — "The Web" or "the portfolio" would not resolve. (#73 part 2.)
- `github.ts` can list repos/issues and create/update issues, but has **no "read file contents / README / tree" capability**. (#55 needs new fetch helpers; #15 needs README + code-comment reading.)
- Supabase service-role access is already wired (`getSupabaseAdmin()` in `src/lib/supabaseAdmin.ts`), and `src/lib/dev/hidden.ts` is the existing template for "small persisted dev-board config table." Reuse this pattern.

---

## #73 (M) — Self-updating prompting + repo alias context

Two distinct sub-features bundled in one ticket. Recommend implementing them as two commits (matches the repo's feature-scoped commit rule).

### Part 1 — Self-editable prompt/context (no code change to tune Cere)

**Problem.** The persona/instructions block is hardcoded in `buildCereSystem`. Mike can't tune Cere's tone, sizing heuristics, or standing instructions without editing `cere.ts` and redeploying.

**Recommended mechanism: a single-row Supabase config table, edited *through Cere herself* via a new tool.** This reuses the exact pattern in `hidden.ts` (service-role table + thin accessor module) and keeps the propose-then-confirm safety model.

- **Storage.** New table `dev_cere_config` (one row, or key/value rows). New module `src/lib/dev/cereConfig.ts` mirroring `hidden.ts`:
  - `getCereConfig(): Promise<CereConfig>` — returns `{ persona, instructions, defaultRepo, updatedAt }`, falling back to a hardcoded default if the row is missing (so Cere always works even with no DB).
  - `setCereConfig(patch): Promise<void>` — upsert.
- **Prompt injection.** Split `buildCereSystem` so the *editable* portion comes from config: `buildCereSystem(repos, issues, config)`. The persona paragraph + sizing/subtask guidance + default-repo line are sourced from `config`; the live repo/issue context stays computed. Update the route to `await getCereConfig()` and pass it in.
- **Self-update path (the interesting decision).** Add a third tool `update_cere_config` to `cere.ts` (alongside CREATE/UPDATE_ISSUE_TOOL), with inputs like `{ persona?, instructions?, defaultRepo? }`. `parseActions` gains a new `CereAction` variant `{ kind: 'config'; patch: {...}; before: {...} }` so `CerePanel`'s `ActionRow` can render a **diff of the prompt change** (reuse `BodyDiff.tsx`, already used for ticket bodies). On confirm, `useCere.confirm()` PATCHes a new `/api/dev/cere-config` route (Zod + same nodejs runtime) that calls `setCereConfig`. **This keeps the human-in-the-loop confirm gate on prompt self-edits — Cere proposes, Mike confirms.**

**Key decision for Mike.** Should prompt self-edits go through the same confirm-then-apply gate as tickets (safe, consistent, recommended), or auto-apply when Cere is confident (faster, but Cere editing her own brain unsupervised)? Recommendation: confirm-gated, with `BodyDiff` preview. Secondary decision: single freeform `instructions` blob vs. structured fields (persona / sizing / standing-instructions) — structured is easier to render and diff.

**Build outline.**
1. Migration: `dev_cere_config` table (mirror `dev_hidden_repos`).
2. `src/lib/dev/cereConfig.ts` — getter/setter + default fallback + Zod `CereConfig` type.
3. Refactor `buildCereSystem` to accept `config`; thread `getCereConfig()` through `iris/route.ts`.
4. Add `UPDATE_CERE_CONFIG_TOOL` + `config` action variant + `parseActions` branch.
5. New route `src/app/api/dev/cere-config/route.ts` (GET for current config, PATCH to set).
6. `CerePanel` `ActionRow` + `useCere.confirm` handle the `config` action kind (diff render + PATCH).

**Dependencies.** Supabase service-role (already configured). No new env vars. Couples to Part 2 only in that both edit the prompt builder — do Part 2's data shape first so the prompt builder is touched once.

### Part 2 — Repo alias layer

**Problem.** `resolveActionRepos` (cere.ts 239–261) only matches exact slug or exact lowercased `name`. Natural names ("mikeveson.com", "The Harlequin", "The Web", "the portfolio") never resolve → action dropped with a "couldn't match repo" warning.

**Concrete data shape.** Aliases are a many-to-one map of human names → canonical slug. Store them in the same `dev_cere_config` row (or a sibling `dev_repo_aliases` table for extensibility/UI editing later):

```ts
// src/lib/dev/cereConfig.ts (or aliases.ts)
export interface RepoAlias {
  slug: string;        // canonical "owner/name", e.g. "mikedouzinas/mikedouz-portfolio"
  aliases: string[];   // ["mikeveson.com", "the harlequin", "the web", "the portfolio"]
}
export type RepoAliasMap = RepoAlias[];

// Seed default (lives in code as fallback, overridable via config):
const DEFAULT_ALIASES: RepoAliasMap = [
  {
    slug: 'mikedouzinas/mikedouz-portfolio',
    aliases: ['mikeveson.com', 'mikeveson', 'the harlequin', 'harlequin',
              'the web', 'the portfolio', 'portfolio', 'iris'],
  },
];
```

Normalize on lookup: lowercase, strip surrounding articles ("the "), trim. Build a flat `Map<normalizedAlias, slug>` once per request.

**Two injection points (do both):**
1. **Prompt context** — so Claude emits the right slug in the first place. In `buildCereSystem`, render aliases next to each repo line:
   `- mikedouzinas/mikedouz-portfolio (mikedouz-portfolio) — also called: mikeveson.com, The Harlequin, The Web, the portfolio`
   This is the highest-leverage fix; Claude will usually then pass the correct slug directly.
2. **Resolution fallback** — extend `resolveActionRepos` so when an action's `repo` matches neither slug nor `name`, it consults the alias map before giving up. This catches the cases where Claude echoes the alias verbatim.

**Key decision for Mike.** Where aliases live: (a) bundled into `dev_cere_config` (simplest, ships with Part 1), or (b) own `dev_repo_aliases` table with its own admin UI in `GearMenu`/`RepoPicker` (more work, but lets Mike manage aliases visually). "Extensible" in the ticket points to (b) eventually; recommend shipping (a) now with the type shaped so a table migration is a drop-in later.

**Build outline.**
1. Define `RepoAliasMap` + default seed + `normalizeAlias()` in `cereConfig.ts`.
2. `buildCereSystem`: append `— also called: …` to each repo line from the alias map.
3. `resolveActionRepos`: add alias-map fallback as a third match tier (signature gains an `aliases` arg, or read from config).
4. Thread the alias map from the route (`await getCereConfig()` already loaded for Part 1).

**Dependencies.** Shares the `dev_cere_config` storage and the `buildCereSystem` refactor with Part 1. Touches `resolveActionRepos` (currently has its own unit-testable shape — good).

### Proposed ticket update — #73

> **Self-updating prompting + repo alias context** (M)
>
> Two sub-features; ship as two commits.
>
> **(1) Self-editable prompt.** Today Cere's persona/sizing/standing-instructions are a hardcoded literal in `buildCereSystem` (`src/lib/dev/cere.ts`); tuning her requires a code change + deploy. Move the editable portion into a one-row Supabase table (`dev_cere_config`, mirror `dev_hidden_repos`/`src/lib/dev/hidden.ts`) read via a new `src/lib/dev/cereConfig.ts` with a hardcoded fallback. Add an `update_cere_config` tool so Cere proposes prompt edits through the **existing confirm gate** — new `config` `CereAction` variant rendered as a `BodyDiff` in `CerePanel`, applied via a new `/api/dev/cere-config` PATCH route. Refactor `buildCereSystem(repos, issues, config)`.
> **(2) Repo alias layer.** `resolveActionRepos` only matches exact slug/name. Add a `RepoAliasMap` (`[{ slug, aliases[] }]`, normalize lowercase + strip "the ") seeded with mikedouz-portfolio → ["mikeveson.com","the harlequin","the web","the portfolio"]. Inject two ways: (a) render `— also called: …` on each repo line in `buildCereSystem` so Claude emits the right slug; (b) alias-map fallback tier in `resolveActionRepos`.
>
> **Decisions:** confirm-gate vs auto-apply prompt self-edits (rec: confirm-gate w/ diff); structured config fields vs freeform blob (rec: structured); aliases in `dev_cere_config` now vs own table+UI later (rec: now, shape for later migration).
> **Files:** `src/lib/dev/cere.ts`, `src/lib/dev/cereConfig.ts` (new), `src/app/api/dev/iris/route.ts`, `src/app/api/dev/cere-config/route.ts` (new), `src/components/dev/useCere.ts`, `src/components/dev/CerePanel.tsx`. Supabase migration. No new env vars.

---

## #15 (M) — Scan TODO/FIXME comments + README checkboxes → propose tickets

**Goal.** A Cere *capability* (not a standalone script — ticket states this preference) that scans a repo for `// TODO` / `FIXME` comments and unchecked README `- [ ]` items, then proposes filing them as tickets through the **existing propose-then-confirm flow**, deduped against open tickets.

**Why it fits Cere cleanly.** The propose→preview→confirm machinery already exists end-to-end (`create_issue` tool → `CereAction[]` → `CerePanel` → `/api/dev/issues`). #15 is mostly: (a) a new way to *gather candidate work items*, (b) feeding them to the planner, (c) dedup. The output side is free.

**Mechanism — a tool Cere can call, scanning via GitHub API (no local clone).**

- **Scanning.** Add helpers to `src/lib/dev/github.ts`:
  - `getRepoTree(slug)` — `GET /repos/{slug}/git/trees/{branch}?recursive=1` to enumerate files (filter to source extensions; skip `node_modules`, lockfiles, build dirs).
  - `getFileContent(slug, path)` — `GET /repos/{slug}/contents/{path}` (base64 decode) or raw. Cap total bytes scanned.
  - `getReadme(slug)` — `GET /repos/{slug}/readme`.
  - A code-side scanner that regexes `//\s*(TODO|FIXME)[:\s]` (plus `#`/`/* */` variants) and README `^\s*-\s*\[ \]\s+`, returning `{ file, line, kind: 'todo'|'fixme'|'checkbox', text }[]`.
- **Surfacing to Cere.** Add a tool `scan_repo_todos` (input `{ repo }`). When Cere calls it, the route runs the scanner and returns the candidate list as a `tool_result` back into a **second** Claude turn (this requires the route to support the tool-use → tool-result loop — see dependency below), so Cere can phrase each candidate as a well-formed `create_issue` proposal (good titles, inferred size, grouping). Alternatively (simpler, less smart): the route runs the scanner directly and synthesizes `create` actions without a second LLM turn.
- **Dedup against open tickets.** The open-issue list is already in context (`buildCereSystem`'s `issueLines`). For deterministic dedup, also filter candidates in code: normalize candidate text + existing open-issue titles (lowercase, collapse whitespace), drop candidates whose normalized text is a near-match (substring or token-overlap threshold) to an existing open title. Surface skipped-as-duplicate count in `warnings`.

**Key decision for Mike.** **Single-turn vs two-turn (agentic) tool loop.** The current route is one-shot: it does *not* feed tool results back to Claude. #15 (and #55) benefit from a tool-use→tool-result→continue loop so Cere can scan *then* reason about what to file. Recommendation: invest in the agentic loop once (it unlocks #15 and #55 both); see dependency note. If Mike wants minimal scope, do the deterministic single-turn version (route scans, synthesizes `create` actions, code-dedups) — less clever titles but no architecture change.

Secondary decision: scan default branch only, or accept a path/dir scope. Recommend default branch, source-dir filtered, byte-capped.

**Build outline.**
1. `github.ts`: `getRepoTree`, `getFileContent`, `getReadme` (+ extension/dir allowlist, byte cap).
2. `src/lib/dev/scanTodos.ts`: regex scanners + `{file,line,kind,text}` shape + dedup helper.
3. `cere.ts`: `SCAN_REPO_TODOS_TOOL`; (if agentic) handle its `tool_use` and feed `tool_result`.
4. `iris/route.ts`: run scanner on the tool call; either loop back to Claude or synthesize `create` actions directly; attach dedup warnings.
5. No UI change needed — proposals render through existing `ActionRow`/confirm. (Optional: a "Scan repo for TODOs" quick-action button in `CerePanel`.)

**Dependencies.** Needs the new `github.ts` read helpers (shared with #55). Best paired with the agentic tool loop (shared with #55). Rate-limit awareness: tree+contents fan-out hits GitHub API — reuse `ghHeaders()`; consider the existing `rateLimit.ts`.

### Proposed ticket update — #15

> **Cere: scan repo TODO/FIXME + README checkboxes → propose tickets** (M)
>
> A capability *inside Cere* (not a standalone script). Add GitHub read helpers to `src/lib/dev/github.ts` (`getRepoTree` via recursive git-tree, `getFileContent`, `getReadme`; source-ext/dir allowlist + byte cap). New `src/lib/dev/scanTodos.ts` regexes `// TODO`/`FIXME` (+ `#`,`/* */` variants) and README `- [ ]` items → `{file,line,kind,text}[]`, with a dedup helper that drops candidates matching existing **open** issue titles (normalized token-overlap). Expose as a `scan_repo_todos` tool; candidates feed the existing `create_issue` → `CereAction` → confirm → `/api/dev/issues` flow. Surface dedup-skip count in `warnings`.
>
> **Decision:** single-turn (route scans + synthesizes `create` actions deterministically) vs two-turn agentic loop (Cere scans, then composes smarter proposals) — the latter shares the tool-result loop with #55; rec: build the loop once. Scope: default branch, source dirs, byte-capped.
> **Files:** `src/lib/dev/github.ts`, `src/lib/dev/scanTodos.ts` (new), `src/lib/dev/cere.ts`, `src/app/api/dev/iris/route.ts`; optional scan button in `CerePanel.tsx`. Depends on #55's read helpers + agentic loop.

---

## #55 (L) — Repo-awareness layer (let Cere reference specific files/components)

**Goal.** Give Cere access to repo contents so she can reference concrete files/components when filing or enriching tickets ("the header overlap is in `DevPortal.tsx`"). The ticket explicitly asks to **evaluate whether this beats Claude's native code awareness**, and to decide **scope** and **how content is surfaced**.

**Does it add value over Claude's native code awareness?** Yes, with a caveat. The Cere API call (`anthropic.messages.create` in `iris/route.ts`) is a plain server-side call — it has **no filesystem, no repo context, no MCP**. Claude's "native" code awareness only exists inside coding-agent harnesses (Claude Code, etc.), not in a bare API call. So in *this* deployment Cere genuinely cannot see code today; #55 is the only way she gets it. The caveat: don't dump the whole repo into the prompt — that's expensive and dilutes attention. Value comes from **targeted, on-demand retrieval**, not bulk context.

**Recommended approach — retrieval tool, not bulk context (agentic).** Add tools Cere calls only when she needs them:
- `list_repo_files(repo)` → returns the tree (reuse `getRepoTree` from #15).
- `read_repo_file(repo, path)` → returns a (length-capped) file body (reuse `getFileContent`).

Cere calls these mid-conversation when a ticket would benefit from a concrete file reference, then continues. This is the **two-turn agentic loop** again — the single biggest architectural dependency shared with #15.

**Scope (the key decision).** Three options:
1. **Full repo on demand** via tree + read tools (recommended). Cere pulls only what she needs; cost scales with use, not repo size. Best fit for "L / conversation-heavy."
2. **Relevant dirs only** — pre-filter the tree to `src/` (and key configs), skip vendored/build dirs. Cheaper, slightly blinder. Good middle ground; can layer on top of (1) as the allowlist.
3. **Bulk preload** of a file manifest/READMEs into `buildCereSystem`. Simplest, but bloats the cached prompt and doesn't scale across many repos. Not recommended beyond a lightweight file-*list* (paths only, no bodies) for orientation.

Recommendation: option 1 (on-demand read tools) with option 2's allowlist as the default filter. Optionally seed `buildCereSystem` with a *paths-only* tree of the default repo so Cere knows what's available to ask for without a round-trip.

**How content is surfaced.** Read-file results return as `tool_result` blocks in the agentic loop; Cere uses them to (a) write better ticket bodies and (b) cite files in her plain-language summary. **Link policy note:** the repo-wide rule forbids Iris emitting raw URLs — Cere should reference files by **path/name**, not GitHub blob URLs, to stay consistent with that policy.

**Key decision for Mike.** (1) Scope (full-on-demand vs dir-allowlist vs bulk) — rec: on-demand + allowlist. (2) Whether this is worth the L effort *before* #15 — since both need the same read helpers + agentic loop, **build #55's infrastructure first and let #15 ride on it** (or build the shared loop as its own prerequisite commit). (3) Cost/latency ceiling: cap bytes per read, files per turn, and total tool round-trips (`max_tokens`/`maxDuration` already at 1500/60s — multi-turn will need a budget and possibly higher `maxDuration`).

**Build outline.**
1. `github.ts`: `getRepoTree`, `getFileContent` (shared with #15) + caps.
2. `cere.ts`: `LIST_REPO_FILES_TOOL`, `READ_REPO_FILE_TOOL`.
3. `iris/route.ts`: **convert one-shot call into a bounded tool-use loop** — while the response contains tool_use blocks for the read tools, execute them, append `tool_result`, re-call; stop at create/update proposals or a max-iteration cap. This is the load-bearing change.
4. Allowlist/byte caps in a small `src/lib/dev/repoRead.ts` (or in `github.ts`).
5. Optional: paths-only tree of default repo seeded into `buildCereSystem`.

**Dependencies.** This ticket *is* the home for the agentic tool loop and the GitHub read helpers that #15 also needs. Sequence: **#55 infra (read helpers + loop) → #15 rides it → both lighter.** Watch GitHub API rate limits (`rateLimit.ts`) and the Vercel `maxDuration` ceiling.

### Proposed ticket update — #55

> **Repo-awareness layer for Cere** (L)
>
> The Cere API call (`src/app/api/dev/iris/route.ts`) is a bare server-side `anthropic.messages.create` with **no code context** — "native" Claude code awareness only exists in coding-agent harnesses, so this layer is genuinely additive here. Build as **on-demand retrieval tools**, not bulk context: `list_repo_files` + `read_repo_file` (new helpers in `src/lib/dev/github.ts`: recursive git-tree, base64 contents, with a `src/`-dir allowlist + per-file/total byte caps). Convert the route's one-shot call into a **bounded tool-use → tool-result loop** (the load-bearing change; shared with #15) so Cere pulls only the files she needs, then cites them by **path/name** (never raw URLs — repo link policy) in ticket bodies and summaries. Optionally seed a paths-only tree of the default repo into `buildCereSystem` for orientation.
>
> **Decisions:** scope = full-on-demand (rec) vs dir-allowlist vs bulk preload; build this infra **before** #15 since both need the read helpers + loop; cap bytes/files/round-trips and likely raise `maxDuration`.
> **Files:** `src/lib/dev/github.ts`, `src/lib/dev/repoRead.ts` (new, caps/allowlist), `src/lib/dev/cere.ts`, `src/app/api/dev/iris/route.ts`. Watch `rateLimit.ts` + Vercel timeout.

---

## Cross-cutting note

All three tickets converge on **two shared pieces of infrastructure**:
1. **GitHub read helpers** in `github.ts` (`getRepoTree`, `getFileContent`, `getReadme`) — needed by #15 and #55.
2. **An agentic tool-use → tool-result loop** in `iris/route.ts` — currently one-shot; needed by #15 (scan-then-propose) and #55 (read-then-reference), optionally by #73's self-edit.

And **#73's `dev_cere_config` Supabase table** is the natural home for both the editable prompt *and* the repo alias map.

Suggested sequencing: **#73 part 2 (aliases, cheapest, high value) → #55 infra (read helpers + loop) → #15 (rides #55) → #73 part 1 (self-editable prompt)**.
