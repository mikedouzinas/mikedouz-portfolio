# Spotify Sidebar Feature

**Status**: Blocked (waiting for Spotify data export)
**Branch**: `feature/spotify-sidebar`

## Vision

Timeline-based songs associated with time periods in Mike's life. Clean, minimal, feels like a music journal not a playlist embed. Desktop-exclusive floating bubble/popup.

## Design Direction

- **Trigger**: Small music icon or compact widget in sidebar
- **Expanded state**: Floating bubble that expands UP and RIGHT from trigger, giving decent viewport coverage
- **Content**: Timeline of songs grouped by automatically detected life periods
- **Easily reducible**: Click to collapse back to compact state
- **Desktop only**

## Data Strategy

### Source: Spotify Data Export
- Requested both short and extended exports from privacy.spotify.com (March 2026)
- Extended export takes up to 30 days
- Data format: `StreamingHistory.json` with per-play timestamps, track names, artists, ms_played

### Period Detection Algorithm (TODO)
Run data analysis over the export to:
1. Cluster plays by time windows (weeks/months)
2. Identify dominant artists/tracks per period
3. Detect transitions between musical eras
4. Map to known life periods (Boston, Rice, Barcelona, etc.)
5. Surface the 1-3 most representative songs per period

### Album Art
- Pull from Spotify CDN URLs (available via track URIs in the export data)
- Use Spotify MCP (`SpotifyGetInfo`) to resolve track URIs to album art URLs
- Store CDN URLs in the processed data, not local files

### Keeping Data Fresh
- Spotify API gives recent 50 plays and top tracks (short/medium/long term)
- For ongoing updates without re-exporting: use API for recent data, merge with historical export
- Investigate automation frequency limits on the export

## What's Built So Far

Scaffolding exists on this branch but needs redesign:
- `src/data/spotify/songs.json` - placeholder data (will be replaced by processed export)
- `src/types/spotify.ts` - TypeScript interface (will evolve)
- `src/components/SpotifySidebar.tsx` - inline sidebar component (needs redesign to floating bubble)
- `src/data/loaders.ts` - songs export
- `src/app/sidebar_content.tsx` - integration point

## Next Steps

1. Receive Spotify data export
2. Build analysis script (`scripts/analyze_spotify.ts` or Python notebook)
3. Design period detection algorithm
4. Redesign component as floating bubble
5. Wire up real data + Spotify CDN album art
6. Test and iterate on period groupings
