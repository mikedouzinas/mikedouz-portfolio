# Sidebar Nav — Sliding Pill Redesign

**Date:** 2026-04-17
**Status:** Approved

---

## Summary

Replace the existing growing-bar nav indicator in the sidebar with a sliding blue pill that animates between active sections as the user scrolls.

---

## Scope

**Only the nav items are changing.** Everything else in the sidebar — profile photo, name, Iris button, Spotify bubble, social icons — stays exactly as-is.

File to edit: `src/app/sidebar_content.tsx`

---

## Design

### Current behavior
Each nav item (`About`, `Experience`, `Projects`, `Media`) has a small horizontal bar on the left that grows in width when active or hovered. The bar is orange in light mode (`#ff7f32`) and blue in dark mode.

### New behavior
A single pill element sits behind the nav list. It slides (CSS `transition`) to the position of the currently active item. No per-item indicator elements.

### Pill visual spec
- **Background:** `rgba(96, 165, 250, 0.13)` — translucent blue
- **Border:** `1px solid rgba(96, 165, 250, 0.25)`
- **Border radius:** `7px`
- **Height:** matches each nav item's height exactly (anchored to row height)
- **Transition:** `top 0.3s cubic-bezier(0.4, 0, 0.2, 1)` — smooth slide

### Text colors
- **Active:** `#93c5fd` (blue-300), `font-weight: 600`
- **Inactive:** `text-gray-500` (unchanged from current)
- **Hover (inactive):** `text-gray-300` — subtle lift, no pill movement on hover

### Light mode
The site's light mode currently uses orange as the accent. The pill should use the same blue values — this nav treatment is intentionally consistent regardless of mode, since blue reads clearly on both the light gray (`gray-50`) and dark (`gray-900`) backgrounds.

---

## Implementation notes

- The pill is a single absolutely-positioned `div` inside a `position: relative` wrapper around the `<ul>`
- Each nav item gets a fixed height (e.g. `36px`); the pill matches that height
- The pill's `top` is set via inline style: `activeIndex * ITEM_HEIGHT_PX` where `activeIndex` is derived from `navItems.findIndex(i => i.id === activeSection)`
- `opacity: 0` when `activeSection` is empty (initial load before any section is in view); `opacity: 1` otherwise — transition on both `top` and `opacity`
- No pill visible (or pill fully transparent / `opacity: 0`) when no section is active yet (on initial load before scroll)
- The existing `useActiveSection` hook and `handleNavClick` logic are unchanged
- Remove the per-item indicator `<div>` that currently does the growing-bar animation
