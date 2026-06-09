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
- File tasks with a **description + t-shirt size** (the Buganizer feel) for any of Mike's repos.
- See/triage all items across repos in **one cross-repo board**.
- **Export an item to Claude Code** in one click to actually work it.
- A **mutable links launchpad** for the services behind each product.
- **Strong, server-enforced security** — inaccessible to anyone but Mike; sessions that do not persist.
- Fit Mike's existing flow and stack; reuse existing patterns (`x-admin-key`/env, `GITHUB_TOKEN`, Supabase, Upstash Redis).

### Non-goals (v1)
- No agent auto-dispatch / job runner (the site can't run Claude Code). Export = copy-to-clipboard prompt.
- No duplicate task database — GitHub Issues are the source of truth.
- No GitHub Projects v2 / GraphQL. T-shirt size is a `size/*` **label** on the issue.
- No TOTP/2FA in v1 (tracked as a future item; see Future Work).

---

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Tracker backend | GitHub Issues per repo, one in-app cross-repo board |
| T-shirt size | `size/XS … size/XL` labels |
| Who works items | Mike + Claude Code agents |
| Auth strength (v1) | Strong password only (hashed, rate-limited, signed cookie) |
| Session lifetime | Session cookie (dies on browser close) + ~2h absolute expiry + ~30m idle timeout |
| Secret trigger | Animated "portal" on hover that poofs on leave; ⌘⇧D shortcut is **P3** |
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
- `src/app/api/dev/issues/route.ts` — `GET` (cross-repo list w/ filters), `POST` (create w/ `size/*` label), `PATCH` (size/close).
- `src/app/dev/page.tsx` — console shell + board UI (create form, filters, list, per-item "Copy for Claude Code").
- `src/components/dev/CopyForClaude.tsx` — builds the clipboard prompt.

**Phase 3 — links launchpad**
- Supabase tables `dev_products`, `dev_links` (migration).
- `src/app/api/dev/products/route.ts`, `src/app/api/dev/links/route.ts` — CRUD.
- Launchpad UI section in `/dev`.

### Data

**GitHub Issues** — the task store. Size = label (`size/XS|S|M|L|XL`). Description = issue body. Repo = the issue's repo.

**Supabase (Phase 3):**
```
dev_products(id, name, github_repo, accent_color, sort, created_at)
dev_links(id, product_id FK, label, url, category, icon, sort, created_at)
  category ∈ {hosting, db, cache, email, analytics, domain, repo, ai, app_store, other}
```

### Export to Claude Code (format)

Per item, "Copy for Claude Code" places on the clipboard:
```
Work on this task in the <repo> repo (GitHub issue #<n>, size <S/M/L>).

<title>

<description>

When complete, close issue #<n>.
```
Mike pastes it into a Claude Code session opened in that repo. No infra, no queue.

---

## Phasing / build order

1. **Phase 1 — Secure auth + portal.** Foundation + the security-critical work. Done = portal opens, password → session, middleware locks `/dev` and `/api/dev`, rate-limit + timeouts verified.
2. **Phase 2 — Board + export.** Create/triage GitHub issues across repos with size labels; "Copy for Claude Code". Done = Buganizer core usable end-to-end.
3. **Phase 3 — Links launchpad.** Supabase-backed editable service links per product. *Filed as items on the board itself.*
4. **P3 — ⌘⇧D shortcut.** Filed as the first `size/S` item in the tool (dogfooding). Must not collide with ⌘K (Iris).

Each phase is independently shippable; Phase 1 must land before any other.

### Seed links (per product)
- **mikeveson.com**: Vercel, Supabase, Upstash Redis, Resend, Google Analytics, GoDaddy (DNS), Anthropic console, GitHub repo, live site, `/admin/inbox`.
- **apollo** (macOS freewrite fork): GitHub repo, releases, Anthropic console.
- **iris-mobile** (Swift): GitHub repo, App Store Connect / TestFlight, Anthropic console.

---

## Testing
- **Auth**: unauthenticated `/dev` → 404; unauthenticated `/api/dev/*` → 401; wrong password → generic 401; >5 attempts → 429; valid login sets cookie and reaches console; browser-close / 30m idle / 2h absolute all force re-auth.
- **Board**: create issue lands in the right repo with the right `size/*` label; cross-repo list + filters correct; size change and close persist; GitHub failure degrades gracefully.
- **Export**: clipboard payload matches format and references the correct repo/issue.
- **Links** (Phase 3): CRUD round-trips; Supabase RLS / service-role access correct.

---

## Risks / open items
- `middleware.ts` runs on the Edge runtime — JWT verify must use Edge-compatible crypto (Web Crypto / `jose`), not Node `crypto`.
- Confirm GitHub token scope covers `issues:write` on all target repos.
- Per CLAUDE.md: update the `proj_portfolio` KB entry in `projects.json` when this ships so Iris knows about the dev console.

## Future work (not v1)
- TOTP / 2FA on top of the password.
- ⌘⇧D keyboard shortcut (P3, filed on the board).
- File-based export queue the terminal auto-ingests (only if clipboard proves insufficient).
