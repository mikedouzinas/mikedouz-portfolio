# Deep Mode Design

**Date:** March 8, 2026
**Branch:** `feature/site-evolution`
**Status:** Approved, ready for implementation

---

## Concept

Deep mode is an augmentation layer activated by clicking the profile photo. It adds a visual transformation (animated ring, border bars) and reveals hidden content (working-on section, Spotify sidebar, future features). Everything existing stays. It's a peek into the vault.

---

## State Management

- Single boolean `deepMode` state in React context (`DeepModeContext`)
- Both sidebar and main content can read/react to it
- Persisted in `localStorage` so deep mode survives refresh
- No URL change, no route navigation
- Toggled by clicking the profile photo

---

## Profile Ring Animation

- **Normal (dark mode):** `from-gray-800 to-gray-700` gradient ring
- **Deep mode enter:** Transitions to animated green-blue-green gradient using CSS `@keyframes` that rotates the gradient angle. Smooth transition over ~200ms.
- **Deep mode exit:** Gradient reverses direction, then fades back to gray over ~200ms as the LAST step in the exit sequence.
- Click handler on the profile photo container toggles deep mode. Coexists with existing 3D tilt/glare effect.

**Note:** Light mode used an orange-to-gray ring that was discontinued. The current ring in dark mode is gray-800 to gray-700. Deep mode only needs to handle dark mode ring transition.

---

## Border Bars

- Fixed-position overlay (`position: fixed`, `pointer-events: none`, high `z-index` but below modals/Iris palette)
- Four edges of the viewport: top, right, bottom, left
- Each edge has a mix of long and short thin rounded bars (~2-3px thickness)
- Bars use the same green-to-blue animated gradient as the ring
- Bottom edge bars that overlap content have reduced opacity (~0.3-0.4) so text remains readable
- **Enter:** Fade in + slight scale from 0.95 to 1.0, ~300ms, starts after ring transition
- **Exit:** Fade out ~200ms, happens before ring reverts
- Implemented as a single `DeepModeBorder` component

---

## Content: "Working On" Section

- Appears below the About section in the main content area, only when deep mode is active
- Each card has: title, status line, description of current thinking/direction, future plans
- Data source: `src/data/deep/working-on.json`
  - Manually updated
  - Claude/Iris can update this from the vault when Mike says to add something
  - Add instruction in vault CLAUDE.md for updating this file
- **Enter:** Cards fade in with slight upward translate, staggered ~50ms each, starts after border bars appear
- **Exit:** Cards fade out simultaneously (no stagger)
- Visual treatment: subtle green-blue border glow on each card to match deep mode aesthetic

### Card Data Shape
```typescript
interface WorkingOnItem {
  id: string;
  title: string;
  status: string;           // e.g. "Pre-build", "Active", "Exploring"
  description: string;      // Current thinking, where things are at
  future?: string;          // Where it's going
  tags?: string[];           // e.g. ["app", "philosophy", "design"]
}
```

---

## Content: Spotify Sidebar (Phase 2)

- Only visible in deep mode
- Collapsible bar in sidebar, below nav items, above social icons
- Spotify green gradient + logo on left, dropdown arrow on right
- Expanded: animates open downward showing timeline/table of songs
- Same corner radius as collapsed state, just grows taller
- Data: `src/data/deep/spotify.json` (hardcoded MVP, Spotify API later)
- See `docs/FEATURE_site-evolution.md` for full Spotify design spec

---

## Animation Sequence

### Enter (~800ms total)
1. **Ring** (0-200ms): gray-800/gray-700 → animated green-blue-green gradient
2. **Border bars** (150-450ms): fade in + materialize (scale 0.95→1.0)
3. **Content** (400-800ms): staggered glow-in, slight upward translate per card

### Exit (~700ms total)
1. **Content** (0-200ms): all cards fade out simultaneously
2. **Border bars** (150-400ms): fade out
3. **Ring** (400-700ms): gradient reverses direction, fades to gray

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/DeepModeContext.tsx` | React context for deep mode state + localStorage persistence |
| `src/components/DeepModeBorder.tsx` | Fixed-position animated border bars overlay |
| `src/components/WorkingOnSection.tsx` | "Working On" cards section |
| `src/components/WorkingOnCard.tsx` | Individual card component |
| `src/data/deep/working-on.json` | Card data (manually updated) |

## Files to Modify

| File | Change |
|------|--------|
| `src/components/home_content.tsx` | Add click handler to toggle deep mode, animate ring gradient |
| `src/app/page.tsx` | Wrap in DeepModeContext, render DeepModeBorder, conditionally render WorkingOnSection |
| `src/app/sidebar_content.tsx` | Consume deep mode context (for Spotify sidebar in Phase 2) |

---

## Mobile Behavior

- Deep mode works on mobile (tap profile photo in header)
- Border bars scale down appropriately for smaller viewport
- Working-on section appears in mobile content flow
- Spotify sidebar becomes a section in mobile content (not sidebar) in Phase 2

---

## Future Deep Mode Content (not now)

- World map with experience dots/videos
- Extended music timeline with stories
- Apps & building showcase
- Whatever else grows over time

---

*Designed: March 8, 2026*
*"A peek into the vault"*
