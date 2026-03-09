# Site Evolution — MikeVeson.com Redesign

**Branch:** `feature/site-evolution`
**Date:** March 8, 2026
**Status:** Active development

---

## Vision

MikeVeson.com isn't a portfolio. It's a living representation of who Mike is. The world is evolving. So has Mike. The site should feel like meeting a person, not reading a resume.

---

## Phase 1: Intro Rewrite

### What
Rewrite the About section in Mike's actual voice. The current version is polished portfolio bio. The new version should feel like his Elysium essays: run-on energy, passion showing through, direct and philosophical without being pretentious.

### Requirements
- Must mention Rice, CS, junior somewhere (highlighted/visible, but doesn't need to lead)
- Voice should match Elysium writing style: raw, run-on feeling, passionate
- Keep the linked references (Rice, Veson Nautical, Barcelona, Barça, Iris)
- Still works for someone who's never heard of Mike (context without being boring)
- Lead with who he is, not what he studies

### Files to modify
- `src/components/AboutContent.tsx` — main content
- `src/data/iris/kb/profile.json` — update bio to match (for Iris consistency)

---

## Phase 2: Spotify Sidebar Section

### What
Collapsible Spotify bar in the sidebar, below nav items, above social icons.

### Design
- **Collapsed state:** Horizontal bar similar to the Iris button style
  - Spotify logo on the left with Spotify green gradient
  - Drop-down arrow on the right
  - Same width and styling language as the Iris button
- **Expanded state:** Bar stays at top (with arrow now pointing up)
  - Animates open downward
  - Shows a small timeline/table view of songs (like a Swift table view)
  - Same corner radius as collapsed bar, just grows taller
  - Maintains the bar header throughout
- **Content:** Timeline of songs mapped to periods
  - Song name, artist, time period label
  - Small album art if available
  - Clicking opens Spotify link

### Data (MVP — hardcoded)
- Store songs in a JSON data file (`src/data/spotify/songs.json` or similar)
- Include songs that have come up recently in vault conversations
- Easy to update by editing the JSON file
- Future: Spotify API integration for automatic population

### Files to create/modify
- `src/components/SpotifySidebar.tsx` — new component
- `src/app/sidebar_content.tsx` — integrate below nav, above social icons
- `src/data/spotify/songs.json` — song data

---

## Phase 3: `/deep` (Secret Layer)

### Access
- Hidden behind profile photo interaction (click/press profile photo)
- Currently the profile photo triggers Ascent to Olympus game; this replaces or augments that
- The route itself could be `/sideroman` or something personal, not `/deep`

### Visual Treatment (Iron Man-esque border mode)
When entering deep mode, the page gets a distinctive visual treatment:
- **Animated border bars** on all four edges of the viewport
  - Thin, rounded bars (not dotted lines)
  - Mix of long and short bars
  - Green-to-blue animated gradient, flowing back and forth
  - Bars on the bottom edge that overlap text have a lighter/transparent gradient so text remains readable
- **Profile photo ring:** The orange-to-gray gradient ring around the profile photo changes to the same green-blue-green animated gradient
- These visual cues signal "you found the hidden layer" without being obnoxious

### Content (deep mode reveals)
1. **Apps & Building:** Showcase of apps in progress (Caliber, Rankd, concepts). Shows the mind at work.
2. **World Map — Experiences:** Interactive map with dots for places visited. Videos/clips that make people feel the experience, not just see it. Barcelona, Boston, Rome, etc.
3. **Music (extended):** Full timeline with stories behind songs, deeper than the sidebar version.
4. **Grows over time** as Mike grows.

### Files to create
- `src/app/sideroman/page.tsx` (or whatever route name)
- `src/components/DeepModeBorder.tsx` — the animated edge bars
- `src/components/WorldMap.tsx` — interactive map
- Additional section components as needed

---

## Phase 4: Future Ideas (Not Now)

- Spotify API auto-population based on listen patterns
- Music-time association tool (separate product?)
- Passcode-protected edit mode for updating songs without git push
- Olympus card/page (currently shelved, may revisit)
- Video hosting for world map experiences

---

## Technical Notes

- Stack: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- Follow existing patterns in the codebase (see CLAUDE.md)
- Dark mode support required for all new components
- Mobile responsive required
- Preserve existing Iris integration
- The old `feature/portfolio-philosophy-content` branch has Olympus work if ever needed

---

## Development Order

1. **Intro rewrite** — content change, highest impact, smallest scope
2. **Spotify sidebar** — new component, moderate scope
3. **Deep mode** — new page + visual system, largest scope

Start with the intro. Ship it. Then build up.
