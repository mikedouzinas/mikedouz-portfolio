# Design system — mikeveson.com

A living reference for the site's recurring-but-unique visual patterns: color
systems, glow/animation conventions, loaders, hidden components, buttons, and
typography. The goal is that new UI (added by Mike, by a contributor, or by Cere)
stays consistent with what already exists.

This is a whole-site reference, not just THE HARLEQUIN. Every value below is
pulled from real source — file paths and exact hex/RGB are cited so you can
trace and reuse them. When you add a pattern, update this doc.

> Convention note: glow colors are passed as **`"R, G, B"` strings** (no
> `rgb()`), because `ContainedMouseGlow` interpolates them into
> `rgba(${color}, ${alpha})`. Standalone CSS/SVG values are hex. Don't mix the
> two forms for the same token.

---

## 1. Color systems

### 1.1 Base / surface (site is dark-only)
`src/styles/globals.css`
- `--background: #111827` (gray-900) — the site is intentionally dark-only.
- `--foreground: #ededed`.
- `[role="dialog"]` (Iris) gets `box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8)`, borders/outlines forcibly removed.

`tailwind.config.js` (the legacy/CommonJS config) also defines brand blues that predate the current palette:
- `primaryBlue: #002a4a`, `secondaryBlue: #283e80`, `accentOrange: #ff7f32`.
> Note: there are **two** Tailwind configs — `tailwind.config.js` (CJS, carries the brand colors + `darkMode: "class"`) and `tailwind.config.ts` (TS, carries `background`/`foreground` CSS vars + keyframes). They define different things. See "Known inconsistencies."

### 1.2 Google palette (recurring accent)
`src/lib/dev/uiMeta.ts` — the single source of truth:
```ts
GOOGLE_COLORS = ['#4285F4', '#EA4335', '#FBBC05', '#34A853']  // blue, red, yellow, green
```
Used as the recurring HARLEQUIN/Cere accent: wordmark flicker, "File it" / `GoogleText`, the Cere portal core, and the "Manage repos" hatch button. Consume via `GOOGLE_COLORS` or the `<GoogleText>` component (`src/components/ui/GoogleText.tsx`) — never re-type the hexes inline. `GoogleText` cycles letters through the palette and supports `overrides` to pin specific visible-letter indices.

### 1.3 Priority / status / size colors (board)
`src/lib/dev/uiMeta.ts` — all board chip colors. These reuse the Google palette deliberately.

| Priority | color | note |
|---|---|---|
| `p1` P1 · Critical | `#EA4335` | red |
| `p2` P2 · High | `#FB923C` | orange (Tailwind orange-400, not a Google hue) |
| `p3` P3 · Medium | `#FBBC05` | yellow |
| `p4` P4 · Low | `#34A853` | green |
| `p5` P5 · Someday | `#4285F4` | blue |

| Status | color |
|---|---|
| `todo` | `#4285F4` (blue) |
| `in progress` | `#FBBC05` (amber) |

| Size | color | note |
|---|---|---|
| `S` Small | `#4285F4` blue | quick win |
| `M` Medium | `#FBBC05` yellow | |
| `L` Large | `#FB923C` orange | deep work |

### 1.4 Spotify green
Hard-coded brand green `#1DB954` everywhere Spotify surfaces — `SpotifyBubble.tsx`, `SpotifyMobilePanel.tsx`, `SpotifyCard.tsx`, `FloatingNotes.tsx`. `AlbumArtFallback.tsx` pairs it with a dark variant `#0a5a29`. Per-post album glow uses each post's own `theme.accent_color` (`"R, G, B"`) from Supabase, falling back to Spotify green when playing.

### 1.5 HARLEQUIN champagne duotone (/dev theme)
The `/dev` console is a champagne-on-dark duotone. The Google palette appears only as a *flicker/accent*, never floods.
- **Champagne ink**: `#E7E2D4` (text — `HarlequinTitle`, `CereMark`), expressed as RGB `231, 226, 212` for the translucent UI tints throughout `globals.css` (borders `rgba(231,226,212,0.18)`, fills `0.05`, muted text `0.4`).
- **Workpad floor**: `#0d0b11` (`.dev-workpad` background), with a faint warm-red bloom `rgba(140, 20, 40, 0.06)` and a two-tier champagne engineering grid (`rgba(231,226,212,0.04)` @ 80px, `0.02` @ 16px). Film grain via `.dev-workpad::after` (SVG turbulence, `opacity 0.3`, `mix-blend-mode: overlay`).
- **Harlequin argyle** (`HarlequinReveal.tsx`): red diamond `#B3122B` with champagne outline `#EDE6D6`, revealed only in a 130px radial mask under the cursor; suppressed over `[data-suppress-reveal]` (header, tickets).
- **Card faces** (Cere blackjack): cream gradient `#f6f1e3 → #e4dcc6`; red pips `#c0392b`, black pips `#23232c`.

### 1.6 Deep-mode greens/blues
Deep mode (see §5.3) uses an emerald↔blue duo:
- Ring/border gradient: `#22c55e` ↔ `#3b82f6` (also written `#34c759`-adjacent emerald `34, 197, 94` for the InProgressCard glow).
- Glow shadow: `rgba(34,197,94,0.4)` + `rgba(59,130,246,0.15)`.

---

## 2. Accent-by-area (card glow color per content type)

Each content area has a signature `ContainedMouseGlow` color (passed as `"R, G, B"`). **Heads-up:** the *intent* documented in CLAUDE.md ("green=projects, purple=blogs, blue=experience") has drifted from the *implementation*. The real, in-code values today:

| Area | Component | glowColor (RGB) | hex | intensity |
|---|---|---|---|---|
| Projects | `src/app/projects/project_card.tsx` | `99, 102, 241` (indigo) | `#6366F1` | 0.35 |
| Blogs / "the web" | `src/app/blogs/blog_card.tsx`, `the_web_card.tsx`, `PostCard.tsx`, `WebBanner.tsx` | `45, 212, 191` (teal) | `#2DD4BF` | 0.18–0.3 |
| Experience / in-progress | `src/components/InProgressCard.tsx` | `34, 197, 94` (green) | `#22C55E` | 0.15 |
| Default `BaseCard` | `src/components/base_card.tsx` | `147, 197, 253` (light blue) | `#93C5FD` | 0.3 |
| Default `Button` | `src/components/ui/Button.tsx` | `52, 211, 153` (emerald) | `#34D399` | 0.22 |
| The-web layout global glow | `src/app/the-web/layout.tsx` | `#2dd4bf` (teal) | — | — |

`the-web` uses the teal accent consistently (banner, cards, the global `MouseGlow color="#2dd4bf"`). When adding a new area card, pick one signature color and reuse it across that area's surfaces.

---

## 3. Mouse glow

Two distinct glow systems, plus a contract that lets them hand off.

### 3.1 Global cursor halo — `MouseGlow` (`src/components/mouse_glow.tsx`)
A fixed blue ring (`bg-blue-300 dark:bg-blue-500`, or a custom `color`) that follows the cursor over the whole viewport (`blur-3xl`, `mix-blend-screen`, `opacity 0.5`). Mounted per-page: `src/app/page.tsx` (`<MouseGlow />`) and `src/app/the-web/layout.tsx` (`<MouseGlow color="#2dd4bf" />`).

### 3.2 Contained glow — `ContainedMouseGlow` (`src/components/ContainedMouseGlow.tsx`)
A cursor-following radial gradient **clipped to its parent**. The default, light-reactive primitive for cards and buttons.
- Props: `color` (`"R, G, B"` string, default `"147, 197, 253"`), `intensity` (center alpha 0–1, default `0.4`), `size` (px, default `200`).
- Render: `radial-gradient(circle, rgba(color,intensity) 0%, ... 40%, rgba(color,0) 70%)`, `filter: blur(40px)`, instant tracking (no position transition), 300ms opacity fade on enter/leave.
- **Parent requirement**: `position: relative` + `overflow: hidden` (use `rounded-[inherit]` so the clip follows the corner radius).

### 3.3 The `data-has-contained-glow` contract
The global halo (§3.1) must *yield* to contained glows so they don't double up. The mechanism:
- Any element with `data-has-contained-glow="true"` (or the legacy `data-has-custom-glow="true"`) causes `MouseGlow` to walk up from `e.target` and, if it finds the attribute, fade the global halo to `opacity: 0` (150ms).
- So the rule is: **if you mount a `ContainedMouseGlow`, also set `data-has-contained-glow="true"` on the same clipping element.** `BaseCard` and `Button` do this for you; bare `<div>`s (PostCard, WebBanner) set it explicitly.

Standard usage (from CLAUDE.md):
```tsx
<div className="relative overflow-hidden" data-has-contained-glow="true">
  <ContainedMouseGlow color="147, 197, 253" intensity={0.4} />
</div>
```

### 3.4 Touch handling
Both glow components detect pointer type via `matchMedia('(pointer: fine)')` and render `null` on touch-only devices. Don't reimplement this — reuse the components.

---

## 4. Loaders & animations

### 4.1 Iris dialog bounce
`globals.css` — `iris-bounce-in` (0.6s, `cubic-bezier(0.68,-0.55,0.265,1.55)`) and `iris-bounce-out` (0.35s). Applied via `.iris-bounce-in` / `.iris-bounce-out`, with `!important` overrides to beat Radix dialog defaults (keyed on `[role="dialog"][data-state]`).

### 4.2 Blog Iris HUD entrance
`iris-hud-in` (420ms, scale + blur, Iron-Man-HUD feel). Class `.iris-hud-enter`.

### 4.3 Cere "thinking" loader (board)
`src/components/dev/CereGameLoader.tsx` picks one game at random *per message mount* (stays put for that load) from `GAMES = [CereBlackjack, CereWar]`. Blackjack styling is in `globals.css` under `.cere-bj-*`: cards deal in via `cere-bj-deal` (0.18s), champagne card faces, result tags colored `--cere #fbbc05 / --you #34a853 / --push champagne`. This is passed into the chat as `thinkingSlot` (see §5).

### 4.4 HARLEQUIN wordmark flicker
`.harlequin-diamond-flicker` — the trailing `◆` cycles the four Google hues once over 1.5s (`steps(1, end)`), then settles to champagne green `#34a853`. `both` holds the final frame.

### 4.5 Tailwind keyframes (`tailwind.config.ts`)
`fadeIn`, `bubbleExpand` (Spotify bubble expand), `bubbleCompact`. Plus CSS keyframes in `globals.css`: `deep-ring-spin`, `deep-ring-fade-out`, `deep-orbit-dash`, `cere-portal-spin`, `cere-portal-pulse`.

### 4.6 Reduced motion
Multiple animations respect `@media (prefers-reduced-motion: reduce)` (cere portal, cere blackjack cards, diamond flicker). The smooth scroll / page-transition fade is gated on `prefers-reduced-motion: no-preference`. **Honor this when adding animation** — gate decorative motion behind the same query.

---

## 5. Hidden / dev components

### 5.1 DevPortal — secret login (`src/components/dev/DevPortal.tsx`)
A near-invisible `·` dot (`text-white/10`, hover `text-white/25`) at the **end of the home list** (`src/app/page.tsx`, not a global footer). Desktop: hover opens a spring-animated password modal (framer-motion, `stiffness 260 / damping 20`). Touch: ~600ms long-press. Animation is cosmetic; real auth is server-side (`POST /api/dev/auth` → cookie + middleware → `/dev`). Inputs are hardened against password-manager autofill (`data-1p-ignore`, `data-lpignore`, `autoComplete="new-password"`).

### 5.2 Cere (board AI) — `src/components/dev/Cere*.tsx`
- `CerePortal` — the nested-diamond trigger (CSS `.cere-portal*`): a Google-palette conic core (`conic-gradient(from 0deg, #4285f4, #ea4335, #fbbc05, #34a853, #4285f4)`) pulsing inside a 6s-spinning champagne ring. Sized 28px to align with the gear/sort controls.
- `CerePanel` — the chat panel; renders `<IrisBubble tone="champagne">`, uses `<Button variant="hatch">` (green) for confirm, slate `148, 163, 184` for secondary.
- `CereMark` — wordmark, Poiret One, champagne `#E7E2D4`, `tracking-[0.22em]`. (Deliberately *not* Limelight, *not* Marcellus.)
- `CereGameLoader` / `CereBlackjack` / `CereWar` — the thinking-state mini-games (§4.3).

### 5.3 Deep mode (Iris/portfolio easter egg)
`src/components/DeepModeContext.tsx` — a boolean context persisted to `localStorage['mv-deep-mode']`. Toggles via **Cmd/Ctrl+Shift+.**, the `mv-toggle-deep-mode` window event (Iris palette command), or `toggleDeepMode()`.
When on:
- `DeepModeBorder.tsx` — an SVG stroke orbiting the viewport perimeter, gradient `#22c55e ↔ #3b82f6`, `strokeWidth 8`, animated via `.deep-orbit-stroke` (`deep-orbit-dash`, 32s). Fixed, `z-40`, `opacity 0.8`.
- `.deep-ring-wrapper` (globals.css) — a spinning conic ring (`#22c55e/#3b82f6`, 2.5s) with a layered green/blue glow `box-shadow`, used for ring affordances (e.g. InProgressCard).

### 5.4 `/dev` chrome suppression
`GlobalOverlays.tsx` returns `null` on `pathname.startsWith('/dev')` so the Iris command palette doesn't mount over THE HARLEQUIN — the board owns the full screen there.

---

## 6. Buttons & controls

### 6.1 `Button` (`src/components/ui/Button.tsx`)
The site's default light-reactive button. Always carries a `ContainedMouseGlow` + `data-has-contained-glow`. Base: `rounded-lg text-sm font-medium`, `hover:scale-[1.03] active:scale-[0.98]`, `disabled:opacity-50`.

Variants (`variant` prop):
| Variant | look |
|---|---|
| `solid` (default) | `border-white/15 bg-white/[0.06] text-white/85` |
| `ghost` | text-only, `text-white/70` |
| `hatch` | green diagonal cross-hatch (`.workpad-btn`) — the "forge glow" |
| `hatch-red` | red diagonal hatch (`.workpad-btn-red`) — destructive (log out) |
| `hatch-google` | Google-palette banded hatch (`.workpad-btn-google`) — manage repos |

Glow props: `glowColor` (default `'52, 211, 153'`), `glowIntensity` (default `0.22`).

### 6.2 Hatch backgrounds (`globals.css`)
- `.workpad-btn` — faint green cross-hatch `rgba(74,222,128,0.16)` (`#4ADE80`), hover deepens fill.
- `.workpad-btn-red` — fewer, larger red lines `rgba(234,67,53,0.22)` (`#EA4335`).
- `.workpad-btn-google` — one band per Google hue, 32px cycle.

### 6.3 Cere portal control sizing
Right-column board controls (gear, sort, cere portal) are all **28px** tall so they align. Match this when adding a board control. The `.cere-portal` hover/active scale (`1.03`/`0.98`) mirrors `Button` on purpose.

---

## 7. Typography

Display faces are loaded per-component via `next/font/google`, scoped to wordmarks only:
- **Limelight** (`HarlequinTitle.tsx`) — Art-Deco / 1930s marquee, THE HARLEQUIN wordmark only. `text-3xl tracking-[0.18em] text-[#E7E2D4]`.
- **Poiret One** (`CereMark.tsx`) — thin Art-Deco geometric, Cere wordmark only. A quiet companion to Limelight, deliberately distinct.
- Body text is the app default (system/Geist via Next defaults) at `--foreground #ededed`.

> **Font veto (non-negotiable, from project memory):** **no Marcellus anywhere.** Both wordmark faces were chosen specifically to avoid it.

---

## 8. Conventions to follow

1. **Glow color = `"R, G, B"` string** for `ContainedMouseGlow`/`Button`/`BaseCard`. Standalone CSS/SVG = hex. Don't cross the streams.
2. **Pair every `ContainedMouseGlow` with `data-has-contained-glow="true"`** on the clipping parent, which must be `relative overflow-hidden`. Otherwise the global halo doubles up.
3. **One signature accent per content area** (§2). Reuse the existing RGB for that area's new surfaces; don't introduce a fourth blue.
4. **Google palette comes from `GOOGLE_COLORS` / `GoogleText`**, never re-typed hexes. Board chip colors come from `PRIORITY_META` / `STATUS_META` / `SIZE_META`.
5. **Champagne is `#E7E2D4` (text) / `231, 226, 212` (RGB tints).** The /dev theme is duotone — the Google palette is a *flicker/accent*, not a flood.
6. **Spotify is always `#1DB954`.**
7. **Gate decorative motion behind `prefers-reduced-motion`** (§4.6).
8. **Don't reimplement pointer/touch detection** — `MouseGlow` / `ContainedMouseGlow` already null out on touch.
9. **Display fonts are wordmark-scoped** and loaded via `next/font/google`. No Marcellus, ever.
10. **Keep this doc and the `proj_portfolio` KB entry updated** when you ship a new visual pattern (the standing "keep KB updated" rule).

---

## Known inconsistencies (candidates for cleanup)

These are documented, not fixed, by this ticket — filed as separate tickets where noted:
- **Two Tailwind configs** (`tailwind.config.js` CJS + `tailwind.config.ts`). They define different things; Next picks one and the other's tokens may be dead. Worth consolidating.
- **Accent-by-area doc drift**: CLAUDE.md says "purple=blogs, blue=experience"; the code uses teal blogs / indigo projects / green experience. CLAUDE.md's "Mouse glow" note should be reconciled with §2 here (or vice-versa).
- **`primaryBlue/secondaryBlue/accentOrange`** brand tokens in `tailwind.config.js` predate the current palette. Only `secondaryBlue` is still used (once, in `theme_toggle.tsx`); `primaryBlue` and `accentOrange` appear dead. Verify before relying on them.
</content>
</invoke>
