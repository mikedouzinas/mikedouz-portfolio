# The Web — New Post Banner

**Date:** 2026-04-10
**Status:** Approved

## Overview

A dismissable banner on the homepage that promotes the latest blog post when it's fresh (published within 3 days). Disappears entirely when no new post exists. Introduces bright teal (`#2dd4bf`) as the web's identity color.

## Placement

- **Location:** Main content area, between About and Experience sections
- **Visibility:** Both mobile and desktop
- **File:** New component rendered in `src/app/page.tsx`

## Visual Design

### Container
- Rounded corners: `rounded-2xl` (matching Iris/Spotify banner style)
- Background: `rgba(8, 38, 38, 0.85)` with `backdrop-filter: blur(20px)`
- Border: SVG round-dot stroke (`stroke-dasharray="3 6"`, `stroke-linecap="round"`) in `rgba(45, 212, 191, 0.35)` — no solid CSS border
- Shadow: `0 8px 20px rgba(0,0,0,0.25), 0 0 30px rgba(45,212,191,0.06), inset 0 1px 0 rgba(255,255,255,0.05)`
- Spider web line pattern inside (faint SVG radial lines + arc curves at ~10% opacity)

### Content Layout
```
┌─ · · · · · · · · · · · · · · · · · · · · · · · · ─┐  ← dotted teal border
·                                                 ✕  ·
·  Mike's blog · THE WEB                              ·
·  · · · · · · · · · · · · · · · · · · · · · · · ·   ·  ← dotted web separator
·  [New]  The Tree of Human Flourishing    Read →     ·
·                                                     ·
└─ · · · · · · · · · · · · · · · · · · · · · · · · ─┘
```

- **Top line:** "Mike's blog" in `#94a3b8` (slate-400) + dot separator + "THE WEB" in `#2dd4bf` (teal-400, uppercase, letter-spacing)
- **Separator:** `radial-gradient` dotted line in `rgba(45, 212, 191, 0.35)` — looks like a web strand
- **Bottom line:** Green "New" badge (`#34d399`, bordered pill) + post title in `#e2e8f0` (white) + "Read →" in `#2dd4bf`
- **Dismiss:** X button in top-right corner, `rgba(148, 163, 184, 0.5)`

## Behavior

### Data Fetching
- Client-side fetch to `/api/the-web?limit=1` on mount
- Response includes `published_at` timestamp and `slug`
- Only render the banner if the latest post's `published_at` is within 3 days of now

### Dismiss Logic
- X button sets `localStorage` key: `web-banner-dismissed-{slug}`
- On mount, check if the current latest post's slug has been dismissed
- When a new post is published (different slug), the banner reappears since the key is different
- No expiry needed — slug-keyed dismissal naturally resets per post

### Navigation
- Clicking the banner (anywhere except X) navigates to `/the-web/{slug}`
- Use `next/link` for client-side navigation

### Fallback
- When no post is within 3 days: render nothing (banner disappears entirely)
- When API fails or no posts exist: render nothing (fail silently)

## Color System

Bright teal `#2dd4bf` (Tailwind `teal-400`) becomes the web's identity color, replacing purple `#a78bfa`.

**Key color tokens for the banner:**
| Token | Value | Usage |
|-------|-------|-------|
| Accent | `#2dd4bf` | Brand text, links, web pattern, border dots |
| Background | `rgba(8, 38, 38, 0.85)` | Banner container fill |
| Border dots | `rgba(45, 212, 191, 0.35)` | SVG dotted border stroke |
| Web lines | `rgba(45, 212, 191, 0.1)` | Interior web pattern |
| New badge | `#34d399` | Green "New" pill (emerald-400) |
| Text primary | `#e2e8f0` | Post title |
| Text secondary | `#94a3b8` | "Mike's blog" context |

**Future scope (separate task):** Recolor the blog site (`/the-web`) from purple to teal — web pattern, tags, accents, post card glows, Iris bubble. Also update post cards to use borderless raised-surface style instead of hard borders.

## Component Structure

```
src/components/WebBanner.tsx    — New component
  ├── Fetches latest post from API
  ├── Checks freshness (3-day window)
  ├── Checks localStorage dismissal
  ├── Renders banner or null
  └── Handles dismiss + navigation
```

Rendered in `src/app/page.tsx` between the About and Experience sections.

## Mobile Considerations

- Banner should be full-width with same padding as other content (`px-4`)
- Post title may truncate on narrow screens — use `truncate` or allow wrapping to 2 lines max
- X button should have adequate touch target (min 44px tap area via padding)
- "Read →" can be hidden on very narrow screens if needed (the whole banner is clickable)

## Testing

- Verify banner appears when latest post is <3 days old
- Verify banner disappears when latest post is >3 days old
- Verify dismiss persists per slug via localStorage
- Verify new post (different slug) resets dismissal
- Verify API failure renders nothing (no error state)
- Verify navigation to correct `/the-web/{slug}`
- Verify responsive layout on mobile
