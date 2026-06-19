# Tickets #58 / #59 / #60 — Theme cleanup (DONE)

Date: 2026-06-18

## Ticket #60 — Remove dead Tailwind brand tokens `primaryBlue` / `accentOrange`
- Grepped whole repo (src/app/components, *.tsx/ts/js/css/json) for `primaryBlue`,
  `accentOrange`, and kebab/class forms (`primary-blue`, `text-primaryBlue`,
  `bg-primaryBlue`, `accent-orange`, `accentOrange`, etc.).
- Only hits were the token definitions themselves in `tailwind.config.js`. **Removed both.**
- Note: the hex `#ff7f32` (value of accentOrange) IS used in the codebase, but only as a
  Tailwind arbitrary value `hover:text-[#ff7f32]` in `sidebar_content.tsx` — that does NOT
  reference the token name, so removing the token is safe and changes nothing visually.
- `secondaryBlue` (#283e80) was KEPT — it is used: `bg-secondaryBlue` in
  `src/components/theme_toggle.tsx`.

## Ticket #58 — Consolidate two Tailwind configs into one
- Both `tailwind.config.js` and `tailwind.config.ts` existed.
- **Source of truth determination:** Tailwind v3 (`tailwindcss@^3.4.17`) resolves config in
  order js → cjs → mjs → ts, so the `.js` was the one actually loaded. Critically, `.js`
  had `darkMode: "class"` (load-bearing: 224 `dark:` usages toggled via a `.dark` class)
  and `secondaryBlue` (used). The `.ts` had `background`/`foreground` color vars (used by
  `bg-background`/`text-foreground`) plus three keyframes (fadeIn/bubbleExpand/bubbleCompact).
- **Action:** Merged EVERYTHING into the single canonical `tailwind.config.ts` (TS project
  preference) and deleted `tailwind.config.js`. Nothing dropped:
  - content globs: kept the broader `{js,ts,jsx,tsx,mdx}` globs from `.ts`
  - `darkMode: "class"` (brought over from `.js` — would have silently broken dark mode otherwise)
  - colors: `background`, `foreground`, `secondaryBlue` (primaryBlue/accentOrange dropped per #60)
  - keyframes: fadeIn, bubbleExpand, bubbleCompact (kept verbatim; note: not currently
    referenced via `animate-*`, but preserved to lose nothing)
  - plugins: [] (both empty)
- Note: there are also two postcss configs (postcss.config.js + postcss.config.mjs). Task #58
  scope was Tailwind configs only, so postcss was left untouched.

## Ticket #59 — Reconcile accent-by-area docs vs code
- Did NOT change any accent colors in code (design decision for Mike).
- Audited actual usage of `ContainedMouseGlow` color / `glowColor` props across the app and
  updated CLAUDE.md "Mouse glow" section to match the real mapping:
  - Projects = indigo `99, 102, 241`
  - Blogs / the web = teal `45, 212, 191`
  - Experience = default light blue `147, 197, 253` (no glowColor passed → ContainedMouseGlow default)
  - In-progress card = green `34, 197, 94`
  - Iris bubble tones = teal / champagne `231, 226, 212`; Iris composer/CTA = light blue
  - /dev (HARLEQUIN) = champagne `231, 226, 212`
- Old doc claimed "green=projects, purple=blogs, blue=experience" — all inaccurate except
  blue≈experience. Added a one-line note that if purple/blue was the intended design, that's a
  separate design change.

## Files changed
- MODIFIED: `tailwind.config.ts` (now the single merged config)
- DELETED:  `tailwind.config.js`
- MODIFIED: `CLAUDE.md` (Mouse glow / accent section)
- ADDED:    this note

## Verification
- `npm run build` → SUCCESS (exit 0). This is the load-bearing check for config changes.
- `npx tsc --noEmit` → SUCCESS (exit 0).
- `npm run lint` / `npx next lint` → FAILS with "Invalid project directory provided, no such
  directory: .../lint". This is a PRE-EXISTING, environment-level breakage: the repo has
  `eslint-config-next@16` while `next@15`'s `next lint` binary mis-parses its positional
  argument. It is unrelated to these changes (which only touch the Tailwind config and
  CLAUDE.md, not ESLint). The Next build's own type/lint pass succeeded.

## Skipped / uncertain
- Did NOT touch postcss configs (out of ticket #58 scope).
- Did NOT change any color values (per #59).
- Could not get `next lint` to run due to the pre-existing eslint-config-next@16 / next@15
  mismatch; relied on `npm run build` + `tsc --noEmit` instead.
