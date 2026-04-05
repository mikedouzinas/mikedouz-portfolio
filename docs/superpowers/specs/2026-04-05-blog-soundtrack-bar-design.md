# Blog Soundtrack Bar

**Date**: 2026-04-05
**Status**: Approved

---

## Overview

Add a soundtrack feature to blog posts on "the web." Authors can associate Spotify tracks with a post, and readers see a playback bar at the top of the article — styled to match the existing Iris highlight hint.

## Data Model

### New type: `SoundtrackTrack`

```typescript
interface SoundtrackTrack {
  trackUri: string;      // "spotify:track:xxx"
  trackName: string;     // "Comptine d'un autre été"
  artist: string;        // "Yann Tiersen"
  albumArtUrl: string;   // Spotify CDN image URL
}
```

### Blog post field

- Add `soundtrack: SoundtrackTrack[] | null` to the `BlogPost` interface in `src/lib/blog.ts`
- Stored as JSONB in Supabase with `DEFAULT NULL`
- `null` or empty array = no soundtrack bar rendered
- Populated when publishing/updating a post via the existing admin API

### Supabase migration

New migration file adds a single column:

```sql
ALTER TABLE blog_posts ADD COLUMN soundtrack jsonb DEFAULT NULL;
```

No indexes needed — only read per-post, never queried or filtered.

## SoundtrackBar Component

**File**: `src/app/the-web/components/SoundtrackBar.tsx`

### Props

```typescript
interface SoundtrackBarProps {
  soundtrack: SoundtrackTrack[];
}
```

### Layout

Two-row bar with progress indicator (Option B from brainstorming):

```
┌──────────────────────────────────────────────────┐
│ [album art 40px]  [◁] [▶/❚❚] [▷]  Track Name    │
│                                    Artist    ● ○ ○ X │
│ ═══════════░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└──────────────────────────────────────────────────┘
```

- Album art: 40px rounded-lg, shows current track's `albumArtUrl`
- Play/pause button: centered, Spotify green accent
- Prev/next arrows: flanking play/pause, cycle through tracks (wrap around)
- Track name + artist: stacked text, truncated with ellipsis
- Track dots: one per track, active = `#1DB954`, inactive = `rgba(255,255,255,0.2)`
- Close button (X): dismisses for session (no persistence)
- Progress bar: 2px thin at bottom of bar, green gradient fill

### Styling

Matches the Iris highlight hint pattern with a Spotify green gradient:

- Background: `bg-gradient-to-r from-[#1DB954]/[0.08] to-emerald-500/[0.08]`
- Border: `border border-white/[0.06]`
- Rounded: `rounded-xl`
- Spacing: `mb-8` below (same gap as Iris hint)

### Position

- Renders between `<IrisHighlightHint>` and the post body on `src/app/the-web/[slug]/page.tsx`
- Only renders when `soundtrack` is non-null and non-empty

### Behavior

- Starts paused — user clicks play to begin
- Tracks auto-advance when one finishes
- Prev/next wrap around (last -> first, first -> last)
- Dismissible via X (session-only state, useState)

### Mobile

- Same position (below Iris hint, above post body)
- Album art shrinks to 32px
- Track name truncates with ellipsis
- Prev/next arrows stay with 44px tap targets for touch accessibility

### Login Prompt

When the Spotify preview ends (~30s for non-premium users):
- Show subtle inline text: "Log in to Spotify for full tracks"
- Link opens `https://open.spotify.com` in a new tab
- Flag clears if user plays again after logging in

## Playback Integration

### New hook: `useSoundtrackPlayer`

**File**: `src/app/the-web/hooks/useSoundtrackPlayer.ts`

Thin adapter over the existing `useSpotifyEmbed` hook:

- Takes the `soundtrack` array, manages current track index
- Converts `SoundtrackTrack` into the format `useSpotifyEmbed` expects
- Exposes: `play()`, `pause()`, `next()`, `prev()`, `currentTrack`, `currentIndex`, `isPlaying`, `isLoading`, `progress`, `position`, `duration`, `previewEnded`
- Handles auto-advance and wrap-around
- Reuses the same lazily-loaded Spotify IFrame API (loaded once globally)
- Hidden iframe (same pattern as existing Spotify bubble)

### Cross-site playback

Only one track plays at a time across the whole site. If the Spotify bubble in deep mode is playing something, starting the soundtrack pauses it, and vice versa. This is already handled by the Spotify IFrame API (single embed instance).

## API Changes

### POST `/api/the-web` (create)

Accept optional `soundtrack` field in the request body. Pass through to Supabase insert.

### PUT `/api/the-web/[slug]` (update)

Accept optional `soundtrack` field in the update body. Pass through to Supabase update.

### GET endpoints

No changes needed — all fields are already returned from Supabase.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/blog.ts` | Add `SoundtrackTrack` type, add `soundtrack` to `BlogPost` |
| `supabase/migrations/2026XXXX_blog_soundtrack.sql` | Add `soundtrack` column |
| `src/app/the-web/components/SoundtrackBar.tsx` | New component — the bar UI |
| `src/app/the-web/hooks/useSoundtrackPlayer.ts` | New hook — adapter over useSpotifyEmbed |
| `src/app/the-web/[slug]/page.tsx` | Wire up SoundtrackBar between hint and body |
| `src/app/api/the-web/route.ts` | Accept `soundtrack` in POST body |
| `src/app/api/the-web/[slug]/route.ts` | Accept `soundtrack` in PUT body |

## Out of Scope

- Spotify OAuth / premium detection (just use the IFrame API preview behavior)
- Persisting dismissed state across sessions
- Admin UI for managing soundtracks (done via API)
- Deep mode gating (soundtrack is always available on posts that have one)
