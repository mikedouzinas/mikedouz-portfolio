# Secret Dev Console — Design

**Date:** 2026-06-08
**Status:** Approved (pending spec review)
**Repo:** mikeveson.com (this repo)

---

## Summary

A hidden, password-protected **dev console** built into mikeveson.com that gives
Mike a Google-Buganizer-style way to file, size, and triage work items across all
his products — plus a fast "jump to the services that run each product" launchpad.

The console is reached through an animated **portal** login that materializes on
hover and poofs away when you leave it. Real access control is enforced
**server-side** (signed cookie + middleware), not by hiding the trigger.

Work items are **GitHub Issues** (single source of truth), so anything filed here
is immediately workable from a terminal via `gh` and the GitHub UI. Each item can
be **exported to Claude Code** with one click.

### Goals
- File tasks with a **description + priority + status** (the Buganizer feel) for any of Mike's repos.
- **Auto-discover Mike's repos from GitHub** (no hardcoded list) with a per-repo view and a persisted hide toggle.
- See/triage all items across repos in **one cross-repo board**.
- **Export an item to Claude Code** in one click to actually work it.
- A **mutable links launchpad** for the services behind each product.
- **Strong, server-enforced security** — inaccessible to anyone but Mike; sessions that do not persist.
- Fit Mike's existing flow and stack; reuse existing patterns (`x-admin-key`/env, `GITHUB_TOKEN`, Supabase, Upstash Redis).

### Non-goals (v1)
- No agent auto-dispatch / job runner (the site can't run Claude Code). Export = copy-to-clipboard prompt.
- No duplicate task database — GitHub Issues are the source of truth.
- No GitHub Projects v2 / GraphQL. Priority and status are **labels** on the issue (`p1`–`p5`, `status: …`).
- No TOTP/2FA in v1 (tracked as a future item; see Future Work).

---

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Tracker backend | GitHub Issues per repo, one in-app cross-repo board |
| Priority | `p1 … p5` labels (colored, ensured via API) |
| Status | Minimal Kanban as colored labels: `status: todo` (gray) → `status: in progress` (amber); **Done = close the issue** (GitHub-native). No separate Done label. |
| Repo discovery | Auto-pulled from GitHub (all repos Mike owns); **persisted per-repo hide** toggle (Supabase). No hardcoded repo list. |
| Who works items | Mike + Claude Code agents |
| Auth strength (v1) | Strong password only (hashed, rate-limited, signed cookie) |
| Session lifetime | Session cookie (dies on browser close) + ~2h absolute expiry + ~30m idle timeout |
| Secret trigger | Animated "portal" on hover that poofs on leave; ⌘⇧J shortcut is **P3** |
| Export to Claude Code | One-click "Copy for Claude Code" prompt to clipboard |
| Links launchpad storage | Supabase (`dev_products` + `dev_links`) |
| Phasing | **Board first, links next** (so links/​shortcut get filed *on* the board) |

---

## Architecture

```
Homepage footer hotspot
   └─ hover → <DevPortal> (framer-motion) → password field
                 └─ POST /api/dev/auth ──┐
                                         ├─ verify hash (constant-time)
                                         ├─ Upstash rate-limit (per IP)
                                         └─ set signed httpOnly session cookie
                                              │
   middleware.ts  ── guards /dev/* and /api/dev/* ── verify cookie or 404/401
                                              │
   /dev (console)
     ├─ Board:   GET/POST/PATCH /api/dev/issues   → GitHub REST (GITHUB_TOKEN)
     ├─ Export:  client-side "Copy for Claude Code"
     └─ Links:   /api/dev/links (+ products)       → Supabase (Phase 3)
```

### Security model (the load-bearing part)

The portal animation carries **zero** security weight. Protection is entirely
server-side, so a visitor who navigates directly to `/dev` or curls
`/api/dev/*` gets nothing.

- **Middleware gate** (`src/middleware.ts`): matches `/dev/:path*` and
  `/api/dev/:path*`. Validates the signed session cookie. Invalid/absent →
  **pages return 404** (don't admit the route exists), **APIs return 401**. The
  console never renders and `GITHUB_TOKEN` is never touched without a valid session.
- **Password**: stored as a hash in env (`DEV_CONSOLE_PASSWORD_HASH`, scrypt/bcrypt).
  Plaintext and hash never reach the client. Comparison is constant-time. Generic
  error on failure (no "wrong password" vs "locked out" distinction beyond a 429).
- **Session token**: JWT signed with `DEV_SESSION_SECRET` (HMAC), payload =
  `{ iat, exp }`, ~2h `exp`. Delivered as a cookie with
  `HttpOnly; Secure; SameSite=Strict; Path=/` and **no `Max-Age`** (a session
  cookie — cleared when the browser closes).
- **Idle timeout**: token also carries `lastSeen`; middleware rejects if
  `now - lastSeen > 30m`. Activity refreshes `lastSeen` (re-issues the cookie),
  bounded by the absolute 2h `exp`. Net effect: closing the browser, ~30m idle,
  or ~2h total all force re-entry. Nothing persists.
- **Brute-force protection**: `/api/dev/auth` rate-limited via existing Upstash
  Redis — e.g. 5 attempts / 15 min per IP, then a lockout window. Returns 429.
- **Hardening**: `noindex` on all `/dev` pages; not linked anywhere; `GITHUB_TOKEN`
  stays server-only; mutations are same-origin behind a `SameSite=Strict` cookie
  (CSRF-safe).

### Console visual style — "workpad"

The `/dev` console sits on a **workpad / blueprint backdrop**: a faint engineering grid
of thin vertical + horizontal lines (Iron-Man-workspace feel) — modern and restrained,
not busy. Implemented as a pure-CSS layered grid (a coarse ~80px grid over a fine ~16px
grid) in a low-opacity cyan on near-black. No animation, no heavy effects. Defined once
as a `.dev-workpad` utility and applied to the console root (and optionally echoed on the
portal modal backdrop).

### Secret trigger — desktop + mobile

The trigger is cosmetic (security is the cookie/middleware above), but it must
exist on both form factors since `hover` doesn't exist on touch.

- **Desktop**: a near-invisible footer hotspot. On **hover** the portal animates
  open and reveals the password field; on mouse-leave it **poofs** away.
- **Mobile**: no hover and limited scroll, so the analog is a **long-press
  (~600ms) on the same footer hotspot** (fallback: a 5-tap pattern, like the
  Android build-number easter egg). It opens the **same `<DevPortal>` as a
  centered modal** (not hover-anchored), with a backdrop tap / "poof" to dismiss.
- `<DevPortal>` detects touch (`pointer: coarse`) and renders the appropriate
  affordance; the password → `/api/dev/auth` → cookie flow is identical on both.

### Components / files (anticipated)

**Phase 1 — secure auth + portal**
- `src/middleware.ts` — route guard for `/dev/*`, `/api/dev/*`.
- `src/lib/dev/auth.ts` — sign/verify session JWT, hash compare, cookie helpers.
- `src/lib/dev/rateLimit.ts` — Upstash-backed attempt limiter (or reuse existing limiter if present).
- `src/app/api/dev/auth/route.ts` — POST login (verify → set cookie), DELETE logout.
- `src/components/dev/DevPortal.tsx` — hover-to-open / poof-to-close portal + password field (framer-motion).
- Footer hotspot wiring (tiny element on the homepage).
- env additions: `DEV_CONSOLE_PASSWORD_HASH`, `DEV_SESSION_SECRET` (added to `src/lib/env.ts` in the existing style).

**Phase 2 — board + export**
- `src/lib/dev/github.ts` — list/create/update issues across configured repos via REST (reuse token/caching approach from `src/lib/iris/github.ts`).
- `src/lib/dev/repos.ts` — configured repo list (display name, accent). Config file in v1.
- `src/app/api/dev/issues/route.ts` — `GET` (cross-repo list w/ filters), `POST` (create w/ `priority/*` label), `PATCH` (priority/close).
- `src/app/dev/page.tsx` — console shell + board UI (create form, filters, list, per-item "Copy for Claude Code").
- `src/components/dev/CopyForClaude.tsx` — builds the clipboard prompt.

**Phase 3 — links launchpad**
- Supabase tables `dev_products`, `dev_links` (migration).
- `src/app/api/dev/products/route.ts`, `src/app/api/dev/links/route.ts` — CRUD.
- Launchpad UI section in `/dev`.

### Data

**GitHub Issues** — the task store. Priority = label (`p1`–`p5`). Status = label (`status: todo`, `status: in progress`); **Done = closed issue**. Description = issue body. Repo = the issue's repo. Priority/status labels are **ensured with colors** via the API (idempotent) so they render consistently.

**Repos** — discovered live from GitHub (`GET /user/repos`, cached); not stored. Each gets a deterministic accent color derived from its name.

**Supabase — `dev_hidden_repos`** (Phase 2; the only Phase-2 DB):
```
dev_hidden_repos(repo_slug text primary key, hidden_at timestamptz default now())
```
Hidden repos are filtered out of the board but stay un-hideable from a "hidden" management list.

**Supabase (Phase 3):**
```
dev_products(id, name, github_repo, accent_color, sort, created_at)
dev_links(id, product_id FK, label, url, category, icon, sort, created_at)
  category ∈ {hosting, db, cache, email, analytics, domain, repo, ai, app_store, other}
```

### Export to Claude Code (format)

Per item, "Copy for Claude Code" places on the clipboard:
```
Work on this task in the <repo> repo (GitHub issue #<n>, priority <p1/p2/p3>).

<title>

<description>

When complete, close issue #<n>.
```
Mike pastes it into a Claude Code session opened in that repo. No infra, no queue.

---

## Phasing / build order

1. **Phase 1 — Secure auth + portal.** Foundation + the security-critical work. Done = portal opens, password → session, middleware locks `/dev` and `/api/dev`, rate-limit + timeouts verified.
2. **Phase 2 — Board + export.** Create/triage GitHub issues across repos with priority labels; "Copy for Claude Code". Done = Buganizer core usable end-to-end.
3. **Phase 3 — Links launchpad.** Supabase-backed editable service links per product. *Filed as items on the board itself.*

Each phase is independently shippable; Phase 1 must land before any other.

### Dogfood board items (file these *in* the tool once Phase 2 lands)
The moment the board exists, seed it with the remaining work — the tool tracks its own roadmap:
- **Phase 3 — links launchpad** build-out (one item, `p2`).
- **Seed the launchpad data** with the per-product links below (one item, `p3`).
- **⌘⇧J keyboard shortcut** to open the portal anywhere (`p3`; must not collide with ⌘K/Iris).
- **Mobile secret trigger** — long-press / 5-tap portal modal (`p3`).
- **Unify with existing admin** — fold the current `/admin/inbox` + comment-deletion controls into the dev console so there's one secured surface (`p3`; see Future Work).
- **Shareable project links** — restricted, scoped link to let a specific person view (and maybe act on) a single repo's board, or the set of repos shared with them, without a full dev session (`p2`; see Future Work).
- **README/TODO importer** — scan a repo's README + inline `TODO`s and file them as uniform issues. First target: **bbn-knight-life** (Mike's high-school app, full of scattered TODOs) — our first real test dataset (`p3`).
- **Richer project content (KB)** — let projects carry **multiple images** and a **context-varying description** (different copy depending on where/how it's surfaced). Many mikeveson.com features are coming, so projects need more than one image + one blurb (`p2`).
- **Claude skill to read the board** — a setup how-to in-app + a connection recipe so Claude (and dispatched subagents) can pull board items directly and act on them, not just receive copied prompts (`p2`).

### Seed links (per product)
- **mikeveson.com**: Vercel, Supabase, Upstash Redis, Resend, Google Analytics, GoDaddy (DNS), Anthropic console, GitHub repo, live site, `/admin/inbox`.
- **apollo** (macOS freewrite fork): GitHub repo, releases, Anthropic console.
- **iris-mobile** (Swift): GitHub repo, App Store Connect / TestFlight, Anthropic console.

---

## Testing
- **Auth**: unauthenticated `/dev` → 404; unauthenticated `/api/dev/*` → 401; wrong password → generic 401; >5 attempts → 429; valid login sets cookie and reaches console; browser-close / 30m idle / 2h absolute all force re-auth.
- **Secret trigger**: desktop hover opens/poofs the portal; touch (`pointer: coarse`) long-press / 5-tap opens the centered modal; both reach the same auth flow.
- **Board**: create issue lands in the right repo with the right `priority/*` label; cross-repo list + filters correct; priority change and close persist; GitHub failure degrades gracefully.
- **Export**: clipboard payload matches format and references the correct repo/issue.
- **Links** (Phase 3): CRUD round-trips; Supabase RLS / service-role access correct.

---

## Risks / open items
- `middleware.ts` runs on the Edge runtime — JWT verify must use Edge-compatible crypto (Web Crypto / `jose`), not Node `crypto`.
- Confirm GitHub token scope covers `issues:write` on all target repos.
- Per CLAUDE.md: update the `proj_portfolio` KB entry in `projects.json` when this ships so Iris knows about the dev console.

## Future work (not v1)
- TOTP / 2FA on top of the password.
- ⌘⇧J keyboard shortcut (P3, filed on the board).
- **Mobile secret trigger** polish (long-press / 5-tap) — captured in the design above; filed on the board.
- **Unify the admin surfaces (P3).** Fold today's `x-admin-key`-gated `/admin/inbox` and the comment-deletion controls under the dev-console session/middleware so there's one secured admin entry instead of two auth schemes. Migrate those API routes from header-key checks to the dev session cookie.
- **Shareable project links (P2).** A scoped, signed share token (Supabase `dev_share_tokens`: token, repo_slug(s), access level, expiry) that grants a guest read/limited access to one project's board (or the set shared with them) at a public `/dev/share/<token>` route — bypassing the password but not the server checks. Lets Mike hand a collaborator visibility into a single repo's items.
- **README/TODO importer (P3).** Parse a repo's README + inline `TODO`/`FIXME` markers into uniform issues. First run against **bbn-knight-life** as real seed data.
- **Richer project KB (P2).** Extend the project schema so a project can hold multiple images and a context-varying description (the copy adapts to where it's shown). Driven by the volume of mikeveson.com features incoming. Touches `src/lib/iris/schema.ts` + `projects.json` + the project UI.
- **Claude skill for the board (P2).** Ship a small skill + connection how-to so Claude and its subagents can read the dev-console board (the GitHub issues) directly and pick up work — closing the loop beyond copy-paste export. Likely a scoped read endpoint/token the skill calls.
- File-based export queue the terminal auto-ingests (only if clipboard proves insufficient).
