# Misc Feature Enrichment — Implementation Feasibility

Grounding notes for tickets #53, #6, #54, #7, #28 against the real mikeveson.com codebase
(Next.js 15 App Router, React 19, TS). Read-only investigation — no code was changed.

Key files referenced throughout:
- `src/components/dev/IssueList.tsx` — board UI; contains the `IssueCard` to extract
- `src/lib/dev/github.ts` — GitHub Issues access (`listBoardIssues`, `createIssue`, `updateIssue`, `isOwnedRepo`)
- `src/lib/dev/session.ts` — JWT dev session (`signSession`, `verifySession`)
- `src/lib/dev/password.ts` — scrypt password hashing
- `src/middleware.ts` — edge gate for `/dev`, `/api/dev/*`, `/admin/inbox`
- `src/app/api/dev/issues/route.ts` — GET/POST/PATCH issues
- `src/components/ui/Button.tsx` — the shared `<Button>` (migration target for #28)
- `src/lib/iris/schema.ts` — Zod KB schemas (`ProjectBase`)
- `src/data/iris/kb/projects.json` — project KB (entry `proj_portfolio`)
- `src/data/loaders.ts` — maps KB JSON → homepage `Project` UI type
- `src/app/projects/projects.tsx` + `src/app/projects/project_card.tsx` — homepage Projects card

---

## #53 (L) — THE HARLEQUIN read-only viewing mode, embeddable in Projects card

### Current structure (the #44 detach question, answered)
The detach-to-centered-panel mode from #44 is **already merged and live**. In `IssueList.tsx`,
`IssueCard` (lines 126–615) is a single component that renders both the inline collapsed card
and a portalled, centered "detached" panel via shared `layoutId` framer morphing. So #53's
"extract first" step lands on the *post-#44* structure — the extraction must carry the detach
behavior (portal, `layoutId`, body-scroll lock, Esc handler, placeholder slot) with it.

`IssueCard` is **not exported** today and is tightly coupled to:
- `onPatch(issue, body)` — the only mutation surface (all writes go through this one callback)
- `repoName` (display) and a `PatchBody` shape (lines 47–54)
- Subtask helpers from `@/lib/dev/subtasks`, `CopyForClaude`, `buildClaudePrompt`

All editing affordances already funnel through `onPatch`. That is the seam that makes a clean
`editable` toggle possible: **read-only mode = render the card without wiring `onPatch`.**

### Step 1 — extract `IssueCard` → `src/components/dev/TicketCard.tsx` (folds in #31)
- Move `IssueCard` (and its private helpers `IssueBodyMarkdown`, `SizeChip`, the `STATUS_EXPAND` /
  `DONE_GREEN` / `DETACHED_*` constants, and the `PatchBody` type) into `TicketCard.tsx`. Export
  `PatchBody` and a `TicketCard` component.
- Add an `editable?: boolean` prop (default `true`). When `false`:
  - Skip rendering the action row (Priority/Status/Size `Dropdown`s, Edit, Done/Reopen — lines 434–489).
  - Skip subtask checkboxes' toggle (`onPatch(... toggleSubtask ...)` at line 399) — render subtasks
    as static `<span>` rows; keep the per-subtask "copy for Claude" (read-only, clipboard-only).
  - Hide the "add subtask" form and the whole edit-mode draft branch (lines 297–378).
  - Make `onPatch` optional (`onPatch?`). View/detach/expand still work — they are local state, not mutations.
- `IssueList.tsx` imports `TicketCard` and passes `editable` through. Net behavior for the existing
  board is identical (editable defaults true).

### Step 2 — read-only route / flag
Two viable shapes; pick one:
- **(a) Prop drill** an `editable` (or `readOnly`) flag from `IssueList` → `TicketCard`, set by the
  page. The embedded Projects-card view and the guest-link view (#6) both pass `editable={false}`.
- **(b) Separate read-only render path** — a thin `BoardViewer` wrapper that reuses `IssueList`'s
  grouping/sorting (lines 617–761) but hard-codes `editable={false}` and uses a read-only data source.

Read-only must also mean the **server refuses writes** for unauthenticated callers — the client flag
is cosmetic. Today every `/dev` + `/api/dev/*` path is gated by `middleware.ts` (401/404 if no
session). An embeddable/guest read view needs a **public read endpoint** that does not ride the dev
session (see #6) and that only ever calls `listBoardIssues` (read), never `createIssue`/`updateIssue`.

### Embedding in the Projects card
The homepage Projects card (`project_card.tsx`) is a server-data-driven static card today. Embedding
the live board means a client component fetching from a public read endpoint. Because the board is a
3-column Kanban with portalled detached panels, embedding inline in a small card is awkward — more
realistic is a compact "preview" (open count + a few top tickets via `TicketCard editable={false}`)
that links to a full read-only board view.

### Key decision for Mike
**What does "read-only board" expose, and to whom?** Three levels: (1) embed in the *authenticated*
Projects card only (no new auth) — easiest; (2) a public read endpoint scoped to a single repo (this
is #6); (3) full public board. The data model and endpoint differ a lot between these. #53 should
ship level (1) + the `editable` extraction, and explicitly defer the public/guest surface to #6.

### Build outline
1. Extract `IssueCard` → `TicketCard.tsx` with `editable` prop; export `TicketCard` + `PatchBody`. (#31)
2. Thread `editable` through `IssueList`; default `true` (zero behavior change to current board).
3. Add read-only branches inside `TicketCard` (no action row, static subtasks, no edit draft).
4. Decide embed surface (preview vs full). For an authenticated embed, reuse the existing
   `/api/dev/issues` GET. For a guest embed, block on #6's public endpoint.
5. Update `proj_portfolio` specifics in `projects.json` once shipped (per CLAUDE.md rule).

### Proposed ticket update (#53)
> **Depends on #31** (extract `IssueCard` → `src/components/dev/TicketCard.tsx`, props-driven,
> `editable` toggle). #44 detach mode is already merged, so the extraction must carry the detach
> portal/`layoutId`/scroll-lock with it. Step 1: extract + `editable` prop (default true), thread
> through `IssueList`, no behavior change. Step 2: read-only branches (hide action row, static
> subtasks, no edit draft). The client flag is cosmetic — read-only safety lives at the API layer.
> Decision needed: does this ship as an *authenticated* embed (reuse `/api/dev/issues` GET, no new
> auth) or wait for #6's public guest endpoint? Recommend shipping authenticated embed + extraction
> here and deferring the guest surface to #6. Relates to #6 and #54.

---

## #6 (M/L) — Shareable scoped guest link to ONE repo's board (read-only)

### How auth works today (and why a guest token is a clean fit)
- `session.ts` mints an **HS256 JWT** (`signSession`) with `exp` (2h cap) + `lastSeen` (30m idle).
  `verifySession` checks both and returns a refreshed token. It carries **no claims beyond
  `lastSeen`** — i.e. a session is "you are Mike, full access."
- `middleware.ts` gates `/dev`, `/api/dev/:path*`, `/admin/inbox`, comments — any valid `dev_session`
  cookie ⇒ full access; no cookie ⇒ 401 (API) / 404 (pages).
- `password.ts` (scrypt) is only the login factor; guest links should **not** touch it.
- `github.ts` already has the security primitive #6 needs: `isOwnedRepo(slug)` and per-repo
  `listIssues`/`listBoardIssues`. The issues API (`/api/dev/issues` GET) already accepts `?repo=`
  and validates it with `isOwnedRepo` (route.ts lines 27–31).

### Recommended design — a separate, scoped guest token (do NOT widen the admin session)
Mint a **distinct signed token** that encodes scope + read-only, kept structurally separate from the
admin `dev_session` so a guest link can never be escalated:

- New helper in `session.ts` (or a sibling `guestToken.ts`): `signGuestToken({ repo, exp })` →
  JWT with claims `{ scope: 'board:read', repo: 'owner/name' }`, longer/independent TTL (e.g. 7–30d),
  **no `lastSeen` idle window** (links are meant to be dormant then clicked). Reuse `jose` HS256 with
  a separate secret (`DEV_GUEST_SECRET`) so revoking guests never logs Mike out.
- A **public** read route, e.g. `GET /api/dev/board/[token]` (or `/api/dev/shared?t=...`), **outside**
  the middleware matcher (matcher currently captures `/api/dev/:path*`, so add an explicit bypass like
  the existing `/api/dev/auth` carve-out at middleware lines 25–27, or host it under a non-`/api/dev`
  path such as `/api/shared-board`). It verifies the guest token, extracts `repo`, re-checks
  `isOwnedRepo(repo)` (defense in depth), and returns **only** `listBoardIssues([repo])`. It must
  reject any write verb.
- A public read page, e.g. `/share/[token]` (or `/b/[token]`), rendering `IssueList` /
  `TicketCard` with `editable={false}` (#53 dependency) against that endpoint.
- Generation UI: a "Share" affordance in the board header (`dev/page.tsx`) or per-repo in
  `RepoPicker`, calling an admin-only `POST /api/dev/share { repo }` that returns the link.

### Revocation
Stateless JWT can't be revoked without state. Options: short TTL + regenerate; OR a Supabase row
(`share_links`: token id, repo, created, revoked) checked on each guest request — Supabase is already
a project dependency. Recommend the lightweight stateful table for real revocation.

### Key decision for Mike
**Stateless short-lived links vs. stateful revocable links.** Stateless = zero new storage, but a
leaked link works until expiry. Stateful (Supabase `share_links`) = true revoke + per-link analytics,
at the cost of a table + a lookup. Given the board can surface private-repo titles, lean stateful.
Second decision: separate guest secret/token (recommended) vs. reusing `dev_session` with a `scope`
claim (rejected — risks privilege confusion in `verifySession`/middleware).

### Build outline
1. `signGuestToken` / `verifyGuestToken` in a new `guestToken.ts` (separate secret, scope+repo claim).
2. Public read endpoint outside the `/api/dev` admin gate; verify token → `isOwnedRepo` → `listBoardIssues([repo])`.
3. (If stateful) Supabase `share_links` table + revoke check.
4. Public `/share/[token]` page reusing `TicketCard editable={false}` (needs #53 step 1).
5. Admin "Share this repo" UI in the board header → `POST /api/dev/share`.

### Proposed ticket update (#6)
> **Sequenced after #53** (needs the `editable={false}` `TicketCard`/read-only render path).
> Do NOT extend the admin `dev_session` — mint a **separate** scoped guest JWT
> (`{ scope:'board:read', repo }`, own secret `DEV_GUEST_SECRET`, long TTL, no idle window) so a
> guest link can't be escalated and revoking guests doesn't log Mike out. Add a **public** read
> endpoint *outside* the `/api/dev/:path*` middleware matcher (mirror the `/api/dev/auth` carve-out),
> which verifies the token, re-checks `isOwnedRepo`, and returns only `listBoardIssues([repo])` — no
> writes. `github.ts` already supports single-repo scoping (`?repo=` + `isOwnedRepo`). Decision:
> stateless short-TTL links vs. a stateful Supabase `share_links` table for true revocation
> (recommend stateful since board titles can be from private repos).

---

## #7 (M) — KB projects: multiple images + context-varying descriptions

### Current schema + data reality
- `ProjectBase` in `schema.ts` (lines 112–116) extends `BaseContent`. Images today are **not** a
  first-class field — they live in the free-form `links` record:
  `links: z.record(z.string(), z.string())` (schema line 107). Every project in `projects.json`
  uses `links.image` (single string); `loaders.ts` line 234 reads `proj.links.image` into the UI's
  `imageUrl?: string`. So there is exactly **one image slot per project today.**
- Descriptions: `summary` (card text) + `specifics[]` (Iris depth). `loaders.ts` line 238 maps
  `summary` → homepage `description`. Iris loads the full KB (`load.ts`) so it sees `summary` +
  `specifics` + `tech_stack` + `architecture`.

### Change for an image array
Add an explicit optional field to `ProjectBase` rather than overloading `links`:
```ts
images: z.array(z.object({
  src: z.string().min(1),
  alt: z.string().optional(),
  caption: z.string().optional(),
})).default([])
```
Keep `links.image` working for backward compat: in `loaders.ts`, prefer `images[0].src`, fall back to
`links.image`. `verify_kb.ts` validates via the Zod schema, so adding the field there is the only
schema-side change. `project_card.tsx` currently renders a single `<Image>` (lines 31–44) — a gallery
is a separate UI ticket, but the data model should land here. Remember `verify:kb && kb:rebuild`.

### Change for context-varying descriptions
"Descriptions that vary by context" = different blurbs for different surfaces (homepage card vs. Iris
answer vs. a future subsidiaries panel vs. a recruiter view). Two models:

- **(a) Named description map** (recommended): an optional
  `descriptions?: z.record(z.string(), z.string())` keyed by context, e.g.
  `{ card: "...", iris: "...", recruiter: "..." }`, with `summary` as the default fallback. Loaders /
  Iris pick the relevant key, defaulting to `summary`. Backward compatible (omit ⇒ today's behavior).
- **(b) Audience/length variants** — a small fixed enum (`short`, `long`, `technical`) instead of an
  open record. Less flexible but easier to validate and reason about.

This must respect CLAUDE.md's anti-hallucination + link policy: Iris still references resources by
name, descriptions are just KB content.

### Key decision for Mike
**Open keyed map vs. fixed variant enum**, and **how many contexts actually need distinct copy.**
If only "short card vs. full Iris" is needed, `summary` + `specifics` may already cover it and #7
collapses to just the image array. Worth confirming the real surfaces before adding a description map.

### Build outline
1. Add `images[]` + (optionally) `descriptions` map to `ProjectBase` in `schema.ts`.
2. Backfill 1–2 projects in `projects.json` with the new fields; keep `links.image` as fallback.
3. Update `loaders.ts`: `imageUrl` from `images[0].src` ?? `links.image`; expose chosen description.
4. `npm run verify:kb && npm run kb:rebuild`.
5. (Separate UI ticket) gallery render in `project_card.tsx`.
6. Update `proj_portfolio` if this ships as a portfolio feature.

### Proposed ticket update (#7)
> Images are currently a single `links.image` string per project (schema `links` record;
> `loaders.ts` reads `proj.links.image`). Add a first-class
> `images: { src, alt?, caption? }[]` to `ProjectBase` in `src/lib/iris/schema.ts`; in `loaders.ts`
> prefer `images[0].src`, fall back to `links.image` (back-compat). For context-varying copy, add an
> optional `descriptions: Record<context,string>` (e.g. `card`/`iris`/`recruiter`) with `summary` as
> the default fallback. Both are additive/optional ⇒ no migration of existing entries required, but
> run `verify:kb && kb:rebuild`. Decision: open keyed description map vs. fixed `short|long|technical`
> enum — and whether `summary`+`specifics` already cover the real contexts (in which case #7 is just
> the image array). Gallery rendering in `project_card.tsx` is a separate UI ticket.

---

## #54 (M) — Projects card subsidiaries panel (DATA MODEL focus)

### Context
`proj_portfolio` in `projects.json` already enumerates sub-features (Iris, The Web/Blog, AI Voice
Reading, Per-Post Music, Spotify Timeline, Deep Mode, THE HARLEQUIN/dev console) as prose bullets
inside `specifics[]`. #54 wants these surfaced as **structured subsidiaries** in the Projects card,
not just prose. The homepage Projects card is `project_card.tsx`, fed by `loaders.ts` `projects[]`
(mapped from `projects.json`).

### Two data-model options (the real decision)
- **(a) Inline `subsidiaries[]` on the parent project** (lightweight; recommended for v1):
  add to `ProjectBase` in `schema.ts`:
  ```ts
  subsidiaries: z.array(z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    link: z.string().optional(),       // internal route or external URL
    ref: Id.optional(),                // optional pointer to a standalone KB item
  })).default([])
  ```
  Put Blog / Iris / THE HARLEQUIN under `proj_portfolio.subsidiaries`. `loaders.ts` passes them to
  `project_card.tsx`. Simple, self-contained, no new top-level items.

- **(b) Reference separate project/KB items via ids** (heavier; better long-term): model each
  subsidiary as its own KB item and link by id (the schema already has the `Evidence`/`related_*`
  id-reference pattern, and `BaseContent` has `tags[]`). The Projects card resolves `ref` ids to full
  items. Lets Iris answer "tell me about THE HARLEQUIN" as a first-class item and lets a subsidiary
  carry its own skills/specifics/images.

**Recommendation:** start with **(a) inline** with an optional `ref` id field, so v1 ships fast but
can graduate any subsidiary to a standalone KB item later by populating `ref` — a migration path
without a schema rewrite. This is also the seam where #54 touches #53/#6: a subsidiary like
"THE HARLEQUIN" can carry `link: '/dev'` (or a guest/read-only board link once #6 lands).

### Dependencies / sequencing
- Independent of #53/#6 for the data model, but the **THE HARLEQUIN subsidiary's `link`** is the
  natural consumer of #6's shareable read-only board (point a guest at it instead of the gated `/dev`).
- Overlaps with #7's `descriptions` idea — a subsidiary's `description` is per-context copy by another
  name. If #7 lands a description model, reuse its shape for subsidiary descriptions for consistency.
- Visual design of the panel is explicitly a separate agent/ticket — this is data + wiring only.

### Key decision for Mike
**Inline subsidiaries vs. id-referenced standalone items.** Inline is faster and keeps everything on
`proj_portfolio`; id-referenced makes each sub-feature individually retrievable by Iris and reusable.
Recommend inline-with-optional-`ref` to get both. Second decision: do subsidiaries also belong to
*other* projects, or only `proj_portfolio`? (Schema supports any project either way.)

### Build outline
1. Add `subsidiaries[]` (with optional `ref`) to `ProjectBase` in `schema.ts`.
2. Populate `proj_portfolio.subsidiaries` (Blog, Iris, THE HARLEQUIN, etc.) in `projects.json`.
3. Surface `subsidiaries` through `loaders.ts` `Project` type into `project_card.tsx`.
4. `verify:kb && kb:rebuild`; update `proj_portfolio` specifics per CLAUDE.md.
5. (Separate ticket) the visual subsidiaries panel.

### Proposed ticket update (#54)
> Sub-features already live as prose in `proj_portfolio.specifics[]`. Promote them to a structured
> `subsidiaries: { name, description, link?, ref? }[]` on `ProjectBase` (`src/lib/iris/schema.ts`),
> populated under `proj_portfolio` in `projects.json`, surfaced via `loaders.ts` into
> `project_card.tsx`. Decision: **inline subsidiaries** (fast, self-contained) vs. **id-referenced
> standalone KB items** (each sub-feature individually retrievable by Iris). Recommend inline + an
> optional `ref` id so a subsidiary can graduate to a standalone item later without a schema rewrite.
> The THE HARLEQUIN subsidiary's `link` is the consumer of #6's read-only board. Overlaps #7's
> per-context descriptions — reuse that shape if #7 lands first. Data + wiring only; visual panel is
> a separate ticket.

---

## #28 (M) — Migrate ALL site buttons to the shared `<Button>` (scoping pass)

The shared component is `src/components/ui/Button.tsx` — a styled `<button>` with a
`ContainedMouseGlow`, `variant` (`solid|ghost|hatch|hatch-red|hatch-google`), `glowColor`,
`glowIntensity`. The dev board (`IssueList.tsx`) already uses it heavily; the homepage/blog/iris/
header surfaces are mostly raw `<button>` / styled `<a>` and are the bulk of the work.

### Inventory — 124 raw `<button>` elements across 38 files

Already importing the shared `Button` (partial migration): `dev/IssueList.tsx`,
`dev/CopyForClaude.tsx`, `dev/CerePanel.tsx` (the last two/IssueList still have raw buttons alongside).

| Area | Files | Count |
|------|------:|------:|
| The Web (blog) | 13 | 37 |
| Header / Nav / Layout | 9 | 21 |
| Dev / Admin (THE HARLEQUIN) | 7 | 22 |
| Games / Rack-Rush | 7 | 15 |
| Iris chat / AI | 4 | 12 |
| Playground | 4 | 11 |
| Spotify | 3 | 5 |
| UI primitives | 1 | 2 |
| **TOTAL** | **38** | **124** |

#### The Web / Blog (37)
- `src/app/the-web/components/CommentForm.tsx` — 102, 173, 181
- `src/app/the-web/components/SubscribeWidget.tsx` — 128, 201, 225
- `src/app/the-web/components/BlogIrisConversation.tsx` — 151
- `src/app/the-web/components/SearchBar.tsx` — 47
- `src/app/the-web/components/ShareButton.tsx` — 15
- `src/app/the-web/components/SummarizeButton.tsx` — 18
- `src/app/the-web/components/CommentCard.tsx` — 159, 167, 177, 188
- `src/app/the-web/components/IrisHighlightHint.tsx` — 22
- `src/app/the-web/components/BlogIrisDraft.tsx` — 185, 193
- `src/app/the-web/components/BlogIrisBubble.tsx` — 290, 296, 314, 329
- `src/app/the-web/components/BlogIrisActions.tsx` — 12, 19
- `src/app/the-web/[slug]/components/ListenBar.tsx` — 50, 67, 75, 84, 97, 112, 122, 129
- `src/app/the-web/[slug]/components/ListenCard.tsx` — 80, 101
- `src/app/the-web/components/SoundtrackBar.tsx` — 63, 73, 89, 136

#### Header / Nav / Layout (21)
- `src/components/AboutSheet.tsx` — 160, 212
- `src/components/IrisButton.tsx` — 472
- `src/components/HeaderMobile.tsx` — 70, 89, 106
- `src/components/ExpandableSection.tsx` — 139, 155
- `src/components/IrisPalette.tsx` — 278, 336, 1637, 1689, 1709, 2081
- `src/components/AskIrisButton.tsx` — 49
- `src/components/AboutContent.tsx` — 124
- `src/components/WebBanner.tsx` — 109
- `src/components/theme_toggle.tsx` — 13
- `src/components/hover-cards/MemoryBubble.tsx` — 91, 115, 146

#### Dev / Admin (THE HARLEQUIN) (22)
- `src/components/dev/CerePortal.tsx` — 11
- `src/components/dev/DevPortal.tsx` — 164
- `src/components/dev/GearMenu.tsx` — 45, 55, 66, 77
- `src/components/dev/GroupByToggle.tsx` — 23
- `src/components/dev/CerePanel.tsx` — 173, 189, 199
- `src/components/dev/IssueList.tsx` — 252, 324, 342, 397, 412, 575, 597 (these migrate alongside the #53 `TicketCard` extraction)
- `src/components/dev/RepoPicker.tsx` — 17, 28, 67, 80

#### Iris chat / AI (12)
- `src/components/iris/IrisChat.tsx` — 195, 214
- `src/components/iris/ContactCta.tsx` — 44
- `src/components/iris/QuickActions.tsx` — 512, 521, 543, 575, 584, 612, 656
- `src/components/iris/MessageComposer.tsx` — 291, 326

#### Games / Rack-Rush (15)
- `src/app/games/page.tsx` — 21
- `src/app/games/rack-rush/components/modals/BlankLetterModal.tsx` — 38
- `src/app/games/rack-rush/components/GameScreen.tsx` — 128, 134, 148, 155
- `src/app/games/rack-rush/components/modals/HowToPlayModal.tsx` — 19, 67, 74, 81
- `src/app/games/rack-rush/components/modals/ExchangeModal.tsx` — 63, 69
- `src/app/games/rack-rush/components/modals/EndScreen.tsx` — 57, 63, 69

#### Playground (11)
- `src/app/playground/quotes/page.tsx` — 127, 134, 145, 160
- `src/app/playground/rack-rush/page.tsx` — 159, 166
- `src/app/playground/decision-maker/page.tsx` — 122, 158, 164
- `src/app/playground/ranked-by-mv/page.tsx` — 217, 245

#### Spotify (5)
- `src/components/spotify/SpotifyBubble.tsx` — 163, 189, 240
- `src/components/spotify/SpotifyAdminDetail.tsx` — 98
- `src/components/spotify/SpotifyMobilePanel.tsx` — 110

#### UI primitives (2)
- `src/components/ui/Dropdown.tsx` — 90, 117 (these are intentional primitives — likely leave as raw, or `Button` would recurse via its own use of `Dropdown`)

### Notes on migration scope
- The shared `Button` only wraps `<button>`. Several "buttons" on the site are actually `<a>` anchors
  (e.g. the GitHub / external-link icon anchors in `project_card.tsx` lines 65–88). Those are NOT
  `<button>` and need a decision: leave as anchors, or add an `as`/`href` variant to `Button`.
- Some raw buttons live *inside* the shared `Button`'s own concern (icon toggles, close `X` buttons in
  portals/panels). Migrating those that are tiny icon-only controls may add glow where it's unwanted —
  triage per-site rather than blind sweep.
- The dev board components (`IssueList`, `RepoPicker`, `GearMenu`, `GroupByToggle`, Cere panels) carry
  many raw buttons but already import `Button` in places; they're the densest cluster.

### Key decision for Mike
**Scope of "all buttons":** strictly raw `<button>` → `Button`, or also fold in clickable `<a>`
anchors styled as buttons (requires extending `Button` with an `as="a"`/`href` polymorphic prop)?
Recommend: migrate raw `<button>`s now; track anchor-as-button separately, possibly adding a
polymorphic `Button` first.

### Build outline
1. (This pass) inventory below — file:line of every raw `<button>`.
2. Decide anchor handling (polymorphic `Button` vs. leave anchors).
3. Migrate per area, smallest blast radius first (ui primitives → header → home → the-web → iris → dev).
4. Visual QA each surface (glow/variant parity), since `Button` injects a glow not present on raw buttons.

### Proposed ticket update (#28)
> Scoping pass complete — inventory below (raw `<button>` count and file:line per area). Shared target
> is `src/components/ui/Button.tsx`. Decision needed first: does "all buttons" include `<a>` anchors
> styled as buttons (e.g. `project_card.tsx` icon links)? If yes, add a polymorphic `as`/`href` prop to
> `Button` before migrating those. Migrate raw `<button>`s area-by-area (ui → header → home → the-web →
> iris → dev), visual-QA each surface because `Button` injects a `ContainedMouseGlow` not on raw buttons.
