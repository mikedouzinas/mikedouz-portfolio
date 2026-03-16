# Spotify Music Timeline — Design Spec

**Date**: 2026-03-15
**Status**: Draft
**Starting point**: Fresh branch from `main` (the old `feature/spotify-sidebar` branch has outdated scaffolding that will be replaced)

---

## Overview

"Mike's Music" — a data-driven music timeline that surfaces songs from Spotify listening history based on algorithmic burst detection and pattern analysis. Displayed as a floating bubble widget in deep mode, with an admin-only detail layer for richer insights.

## Goals

1. Automatically detect songs that had significant listening moments (bursts, loyalty, late-night patterns, etc.)
2. Display a clean, scrollable timeline of these moments in a floating bubble (deep mode only)
3. Provide a public view (song + artist + date range + album art + preview) and an admin-only detail view (stats, insight tags, context)
4. Keep the data fresh with periodic Spotify API refreshes alongside the historical export

## Non-Goals

- Not a Spotify embed or playlist viewer
- Not a real-time "now playing" widget
- No manual curation — the algorithm decides what surfaces
- No public-facing raw analytics or dashboards

---

## Data Pipeline

### Input Sources

**Historical (one-time):**
- Spotify Extended Streaming History export (4 files, 53,648 records, Feb 2022 – Mar 2026)
- Located at `data/spotify/raw/` (gitignored)
- Fields used: `ts`, `ms_played`, `master_metadata_track_name`, `master_metadata_album_artist_name`, `master_metadata_album_album_name`, `spotify_track_uri`, `reason_start`, `reason_end`, `skipped`

**Refresh (ongoing, ~every 2 weeks):**
- Spotify Web API: `recently-played` (last 50 tracks) and `top-tracks` (short/medium/long term)
- Requires OAuth refresh token stored in env var
- New plays normalized to same format, merged with existing data

### Analysis Engine

Single analysis pipeline that works on both historical export and incremental API data. Located at `scripts/analyze_spotify.ts`.

**Step 1: Normalization**
- Parse all streaming history files into unified format: `{ trackId, trackName, artist, album, trackUri, timestamp, msPlayed, reasonStart, reasonEnd, skipped }`
- Filter out: plays under 30 seconds (skips/accidents), podcast episodes, null track names

**Step 2: Burst Detection (Primary)**
- For each unique track, collect all plays sorted by timestamp
- Sliding window: find clusters where 3+ plays occur within a 10-day window, allowing up to 2-day gaps between plays
- Score each burst: `playCount × dominanceRatio` where dominanceRatio = track plays / total plays in that window
- Minimum threshold: score must exceed a tunable floor (calibrated against actual data)
- Output per burst: track info, date range, play count, total listening context (unique tracks, total plays in window), listening share %, streak length

**Step 3: Secondary Insights (Admin-Only)**

These are computed for all tracks but only displayed in admin mode:

- **Loyalty tracks**: Played 30+ times across 3+ distinct months. Scored by consistency (months with plays / total months in range)
- **Rediscoveries**: A track with a dormancy gap of 60+ days followed by 3+ plays in 10 days. The gap length and comeback intensity are recorded
- **Late night signatures**: Tracks where 50%+ of plays occur between midnight–4am. Minimum 5 total plays. Contrast ratio (night% vs day%) is the score
- **Artist deep dives**: 7+ unique tracks by the same artist played within a 14-day window. Scored by catalog breadth (unique tracks / artist's total unique tracks in history)
- **Session anchors**: Tracks that appear as `reason_start: "playbtn"` (manual play, session starter) in 30%+ of their plays, minimum 10 plays. Also detect frequent session-enders via `reason_end: "endplay"` patterns
- **One-and-done obsessions**: 5+ plays within 7 days, then zero plays for 60+ days after. The abruptness of the drop-off is the insight
- **Seasonal returns**: Tracks that spike in the same calendar month across 2+ years. Detected by month-over-month play distribution

**Step 4: Spotify API Enrichment**
- For each unique track URI in the output, fetch from Spotify API:
  - Album art URL (multiple sizes)
  - 30-second preview URL
  - Spotify external URL
  - Genre tags (from artist endpoint)
- Cache these in the output JSON to avoid repeated API calls

**Step 5: Output**
- Write `src/data/spotify/music-moments.json` — the public dataset:
  ```typescript
  interface MusicMoment {
    id: string;                    // hash of trackUri + dateRange
    trackName: string;
    artist: string;
    album: string;
    trackUri: string;
    albumArtUrl: string;           // Spotify CDN
    previewUrl: string | null;     // 30-sec preview
    spotifyUrl: string;            // External link
    dateRange: { start: string; end: string };
    playCount: number;
    listeningShare: number;        // 0-1
    streakDays: number;
    score: number;                 // For sorting
  }
  ```

- Write `src/data/spotify/music-insights.json` — the admin-only dataset (committed — data is personal but not sensitive, gated in UI):
  ```typescript
  interface MusicInsight extends MusicMoment {
    insightTypes: InsightType[];   // 'burst' | 'loyalty' | 'rediscovery' | 'late_night' | 'artist_dive' | 'session_anchor' | 'one_and_done' | 'seasonal'
    context: {
      totalPlaysInWindow: number;
      uniqueTracksInWindow: number;
      timeOfDayDistribution: Record<string, number>;  // hour buckets
      dormancyDaysBefore?: number;   // for rediscoveries
      monthsActive?: number;         // for loyalty
      artistTracksExplored?: number; // for artist dives
    };
  }
  ```

### Refresh Strategy

The refresh script is a **local/CI script** (matching the existing `build_embeddings.ts` pattern). It runs locally, regenerates the JSON files, and the results are committed to git. This is not a runtime/Vercel process — the site serves static JSON.

- Run manually or via CI on a ~2-week cadence: `npm run spotify:refresh`
- Fetches recent plays from Spotify API
- Runs burst detection on new data window
- Merges new moments with existing `music-moments.json`
- De-duplicates by track URI + overlapping date ranges
- Commit updated JSON files to git

**Spotify OAuth (v1 approach):** Obtain refresh token manually via Spotify's authorization flow, store as `SPOTIFY_REFRESH_TOKEN` env var. The refresh script exchanges it for an access token at runtime. Refresh tokens are long-lived and rarely expire. If a proper OAuth callback flow is needed later, add `/api/spotify/callback` route.

---

## Admin Mode (Site-Wide)

A new site-wide concept, not Spotify-specific. Gated by a key stored in localStorage.

### Activation
- Visit site with `?admin=<ADMIN_SECRET_KEY>` query param
- JavaScript reads param, stores flag in localStorage: `adminMode: true`
- URL param is **stripped immediately** via `window.history.replaceState` after reading (prevents accidental sharing via copy-paste)
- Flag persists across sessions until explicitly cleared (visit with `?admin=off` to deactivate)
- `ADMIN_SECRET_KEY` is an env var (`NEXT_PUBLIC_ADMIN_MODE_KEY`) — a simple passphrase, compared client-side

**Deliberate tradeoff:** The `NEXT_PUBLIC_` prefix means this key is in the client bundle. This is intentional — admin mode gates personal-but-not-sensitive data. Anyone determined enough to extract it from the bundle could, but that's acceptable. For truly sensitive operations, the existing server-side `ADMIN_API_KEY` pattern remains the right choice.

### Relationship to Existing Contexts
- `AdminModeProvider` is a **sibling context** to the existing `DeepModeContext`
- Both are wrapped in the root layout (`layout.tsx`)
- Admin mode is independent of deep mode — you can be in admin mode without deep mode and vice versa
- However, the Spotify widget itself only renders in deep mode; admin mode just adds detail to it

### Behavior
- When active, components can check `useAdminMode()` hook
- No visible UI change except within components that opt in
- Admin-only data can be:
  - Bundled in the build but hidden (for static data like Spotify insights)
  - Fetched from authenticated API endpoints (for dynamic data)

### Security Considerations
- Source code is open — people can see admin mode exists
- The key comparison happens client-side, so it's obscurity not true auth (see deliberate tradeoff above)
- For truly sensitive data, use server-side `ADMIN_API_KEY` (existing pattern) on API routes
- Spotify insights are personal but not sensitive — client-side gating is fine
- Raw Spotify data never leaves `data/spotify/raw/` (gitignored)

### Future Admin Features
- Iris query analytics
- Inbox stats
- Detailed Spotify insights
- Any personal dashboard data

---

## UI Design

### Trigger
- Floating music icon button, visible only in deep mode
- Positioned in sidebar area (exact placement TBD during implementation)
- Desktop only

### Collapsed State (Default)
- Small floating bubble/panel (~260px wide)
- Header: "Mike's Music" with small music icon
- Shows 3 most recent music moments as compact rows:
  - Small album art (36px), song name, artist, date range
- Bottom: dot indicator + "X more moments"
- Click "expand" to open full view

### Expanded State
- Larger panel (~420px wide, max height ~520px, scrollable)
- Header: "Mike's Music" with collapse control
- Cards grouped by month, with green month labels as scroll markers
- Each card (public view):
  - Album art (64px) with play preview button overlaid
  - Song name + artist
  - Date range in accent color
  - Spotify link (top-right arrow)
  - Stats row: plays, % of listening, day streak
- Lazy loading: renders recent months first, loads older months on scroll
- Bottom: scroll indicator showing available years

### Admin Detail View (Admin Mode Only)
- Additional panel or expandable section per card showing:
  - Insight type tags (burst, loyalty, rediscovery, etc.)
  - Full listening context (what else was playing that week)
  - Time-of-day distribution
  - Detection reasoning / raw numbers
- Possibly a separate "analytics" tab in the expanded view

### Audio Preview UX
- **Single active preview**: only one song plays at a time — starting a new preview stops the previous
- **Progress indicator**: thin green bar at the bottom of the album art during playback
- **Null preview URL**: hide the play button, Spotify external link becomes the primary action
- **Implementation**: HTML5 Audio element (simple, no Web Audio API needed for basic playback)

### Edge Cases
- **Empty data** (no `music-moments.json` or zero moments): hide the bubble entirely — no empty state UI needed
- **Audio preview fails** (network error, URL expired): silently fall back to Spotify link, no error toast
- **Loading**: skeleton cards in expanded view while data loads (though static JSON should be near-instant)

### Visual Design
- Dark theme matching deep mode (background: `#1a1a2e` or similar)
- Spotify green (`#1DB954`) as accent color
- Smooth expand/collapse animations (Framer Motion)
- Album art with rounded corners
- Cards grouped reverse-chronologically (most recent first), with month labels as section headers

---

## File Structure

```
scripts/
  analyze_spotify.ts           # Main analysis pipeline
  refresh_spotify.ts           # API refresh + merge

data/spotify/
  raw/                         # Gitignored — original export files (large, personal)

src/data/spotify/
  music-moments.json           # Public processed data (committed)
  music-insights.json          # Admin-only detailed data (committed, gated in UI)

src/lib/spotify/
  types.ts                     # MusicMoment, MusicInsight, etc. (matches iris/schema.ts pattern)

src/hooks/
  useAdminMode.ts              # Admin mode detection hook (extends existing hooks/ dir)

src/components/spotify/        # Feature directory (matches iris/ pattern)
  SpotifyBubble.tsx            # Main floating bubble (replaces old SpotifySidebar)
  SpotifyTimeline.tsx          # Expanded scrollable timeline
  SpotifyCard.tsx              # Individual moment card
  SpotifyAdminDetail.tsx       # Admin-only detail panel

src/components/
  AdminModeProvider.tsx        # Context provider — site-wide, not spotify-specific
```

### npm Scripts

```json
{
  "spotify:analyze": "ts-node scripts/analyze_spotify.ts",
  "spotify:refresh": "ts-node scripts/refresh_spotify.ts",
  "spotify:rebuild": "npm run spotify:analyze && npm run spotify:refresh"
}
```

---

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Analysis language | TypeScript (ts-node) | Consistency with codebase, shared types |
| Primary data store | Static JSON files | Simple, no runtime DB dependency for reads |
| Refresh mechanism | Script (cron-compatible) | Can run via Vercel cron or manually |
| Album art source | Spotify CDN URLs | Stored in JSON, no local image storage |
| Preview playback | Spotify 30-sec preview URLs | Free, no auth needed for playback |
| Admin gating | localStorage + env var key | Simple, appropriate for non-sensitive data |
| UI framework | React + Framer Motion | Matches existing site patterns |
| Rendering | Client component | Needs interactivity (expand, scroll, play) |

---

## Open Questions

1. **Burst detection thresholds** — need to calibrate minimum score against real data. Plan: run analysis once, inspect results, tune
2. **Exact deep mode integration point** — need to examine how deep mode currently works to find the right mount point for the bubble
3. **Album art caching** — Spotify CDN URLs may change. Consider storing in Supabase or using a proxy if this becomes an issue
