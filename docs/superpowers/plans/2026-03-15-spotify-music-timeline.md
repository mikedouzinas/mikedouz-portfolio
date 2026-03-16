# Spotify Music Timeline Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build "Mike's Music" — a data-driven Spotify listening timeline with Kleinberg burst detection, displayed as a floating bubble in deep mode with admin-only insights.

**Architecture:** Analysis pipeline (TypeScript scripts) processes raw Spotify export into static JSON via 3-layer Kleinberg burst detection. React components consume this JSON and render a floating bubble widget (collapsed/expanded states) gated behind deep mode. Admin mode (site-wide localStorage key) unlocks detailed insights. Spotify API enriches tracks with album art and preview URLs.

**Tech Stack:** TypeScript, tsx (script runner), Next.js 15 App Router, React 19, Framer Motion, Tailwind CSS, Spotify Web API, HTML5 Audio

**Spec:** `docs/superpowers/specs/2026-03-15-spotify-music-timeline-design.md`

---

## Chunk 1: Types, Analysis Pipeline, and Data Output

This chunk builds the entire data pipeline — from raw Spotify export to processed JSON files ready for the UI. It can be developed and tested independently of any React components.

### Task 1: Shared Types

**Files:**
- Create: `src/lib/spotify/types.ts`

- [ ] **Step 1: Write type definitions**

Define all shared types used by both the analysis scripts and UI components. These mirror the spec's `MusicMoment` and `MusicInsight` interfaces, plus internal types for the pipeline.

```typescript
// src/lib/spotify/types.ts
import { z } from "zod";

// --- Raw data types (from Spotify export) ---

export const NormalizedPlaySchema = z.object({
  trackName: z.string(),
  artist: z.string(),
  album: z.string(),
  trackUri: z.string(),
  timestamp: z.string(), // ISO 8601
  msPlayed: z.number(),
  reasonStart: z.string().optional(),
  reasonEnd: z.string().optional(),
  skipped: z.boolean().optional(),
});
export type NormalizedPlay = z.infer<typeof NormalizedPlaySchema>;

// --- Burst detection output ---

export interface BurstRegion {
  trackKey: string; // "trackName — artist"
  startWeekIdx: number;
  endWeekIdx: number;
  maxState: number; // 1=elevated, 2=burst, 3=intense
  stateSequence: number[];
}

export interface MusicMoment {
  id: string; // deterministic hash of trackUri + dateRange
  trackName: string;
  artist: string;
  album: string;
  trackUri: string;
  albumArtUrl: string;
  previewUrl: string | null;
  spotifyUrl: string;
  dateRange: { start: string; end: string };
  playCount: number;
  weeksCount: number;
  intensity: number; // plays per week
  maxState: number; // 1-3 Kleinberg state
  peakDay: string;
  peakDayPlays: number;
}

export type InsightType =
  | "burst"
  | "comeback"
  | "loyalty"
  | "late_night"
  | "artist_dive"
  | "session_anchor"
  | "one_and_done"
  | "seasonal";

export interface MusicInsight extends MusicMoment {
  insightTypes: InsightType[];
  context: {
    totalPlaysInWindow: number;
    uniqueTracksInWindow: number;
    timeOfDayDistribution: Record<string, number>; // hour buckets "0"-"23"
    dormancyDaysBefore?: number;
    monthsActive?: number;
    artistTracksExplored?: number;
  };
}

// --- Spotify API enrichment ---

export interface SpotifyTrackMeta {
  trackUri: string;
  albumArtUrl: string;
  previewUrl: string | null;
  spotifyUrl: string;
  genres: string[];
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors related to spotify types.

- [ ] **Step 3: Commit**

```bash
git add src/lib/spotify/types.ts
git commit -m "feat(spotify): add shared type definitions for music timeline"
```

---

### Task 2: Kleinberg Algorithm Core

**Files:**
- Create: `scripts/lib/kleinberg.ts`

The Kleinberg burst detection algorithm, implemented as a pure function with no external dependencies. This is the heart of the analysis.

- [ ] **Step 1: Write the Kleinberg implementation**

```typescript
// scripts/lib/kleinberg.ts

/**
 * Kleinberg's Burst Detection Algorithm (2002)
 * "Bursty and Hierarchical Structure in Streams"
 *
 * Models a time series as a hidden Markov process with multiple intensity
 * states. Uses the Viterbi algorithm to find the optimal state sequence
 * that minimizes total cost (emission + transition).
 *
 * No fixed windows — the data's statistical properties determine burst
 * boundaries. Self-calibrating per track via base_rate.
 */
export function kleinbergBurstDetection(
  eventCounts: number[],
  params: { s?: number; gamma?: number; numStates?: number } = {}
): { states: number[]; stateRates: number[] } {
  const { s = 2.0, gamma = 2.0, numStates = 4 } = params;
  const T = eventCounts.length;
  if (T === 0) return { states: [], stateRates: [] };

  const counts = Float64Array.from(eventCounts);

  // Base rate: average count across all periods (including zeros)
  let sum = 0;
  for (let i = 0; i < T; i++) sum += counts[i];
  const baseRate = Math.max(sum / T, 1e-10);

  // State rates: rate_i = baseRate * s^i
  const stateRates: number[] = [];
  for (let i = 0; i < numStates; i++) {
    stateRates.push(baseRate * Math.pow(s, i));
  }

  const logT = Math.log(T);

  // Transition cost: moving UP costs gamma * (j - i) * log(T). Down is free.
  function transitionCost(from: number, to: number): number {
    return to > from ? gamma * (to - from) * logT : 0;
  }

  // Emission cost: Poisson negative log-likelihood
  // cost = rate - count * log(rate)
  function emissionCost(count: number, rate: number): number {
    if (rate <= 0) return Infinity;
    if (count === 0) return rate;
    return rate - count * Math.log(rate);
  }

  // Viterbi: dp[t * numStates + k] = min cost to be in state k at time t
  const dp = new Float64Array(T * numStates).fill(Infinity);
  const backptr = new Int32Array(T * numStates);

  // Initialize t=0
  for (let k = 0; k < numStates; k++) {
    dp[k] = emissionCost(counts[0], stateRates[k]) + transitionCost(0, k);
  }

  // Forward pass
  for (let t = 1; t < T; t++) {
    const tOff = t * numStates;
    const prevOff = (t - 1) * numStates;
    for (let k = 0; k < numStates; k++) {
      const emit = emissionCost(counts[t], stateRates[k]);
      for (let pk = 0; pk < numStates; pk++) {
        const cost = dp[prevOff + pk] + transitionCost(pk, k) + emit;
        if (cost < dp[tOff + k]) {
          dp[tOff + k] = cost;
          backptr[tOff + k] = pk;
        }
      }
    }
  }

  // Backtrack
  const states = new Array<number>(T);
  let minCost = Infinity;
  let bestK = 0;
  const lastOff = (T - 1) * numStates;
  for (let k = 0; k < numStates; k++) {
    if (dp[lastOff + k] < minCost) {
      minCost = dp[lastOff + k];
      bestK = k;
    }
  }
  states[T - 1] = bestK;
  for (let t = T - 2; t >= 0; t--) {
    states[t] = backptr[(t + 1) * numStates + states[t + 1]];
  }

  return { states, stateRates };
}

/**
 * Extract contiguous burst regions from a Kleinberg state sequence.
 * A burst region = consecutive time steps where state >= minState.
 */
export function extractBurstRegions(
  states: number[],
  minState: number = 1
): Array<{ start: number; end: number; maxState: number; stateSeq: number[] }> {
  const regions: Array<{ start: number; end: number; maxState: number; stateSeq: number[] }> = [];
  let inBurst = false;
  let start = 0;
  let maxState = 0;

  for (let t = 0; t <= states.length; t++) {
    const s = t < states.length ? states[t] : 0;
    if (s >= minState && !inBurst) {
      inBurst = true;
      start = t;
      maxState = s;
    } else if (s >= minState && inBurst) {
      maxState = Math.max(maxState, s);
    } else if (s < minState && inBurst) {
      inBurst = false;
      regions.push({
        start,
        end: t - 1,
        maxState,
        stateSeq: states.slice(start, t),
      });
    }
  }

  return regions;
}

/**
 * Split a burst region into distinct sub-peaks separated by valleys.
 * A valley = 2+ consecutive weeks below the region's median active count.
 */
export function splitIntoPeaks(
  weeklyCounts: number[],
  regionStart: number,
  regionEnd: number
): Array<{ relStart: number; relEnd: number; plays: number; weeks: number }> {
  const region = weeklyCounts.slice(regionStart, regionEnd + 1);
  if (region.length === 0) return [];

  // Median of non-zero weeks
  const activeWeeks = region.filter((c) => c > 0);
  if (activeWeeks.length === 0) return [];
  const sorted = [...activeWeeks].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const threshold = Math.max(median, 0.5);

  const peaks: Array<{ relStart: number; relEnd: number; plays: number; weeks: number }> = [];
  let inPeak = false;
  let peakStart = 0;

  for (let i = 0; i <= region.length; i++) {
    const c = i < region.length ? region[i] : 0;
    if (c >= threshold && !inPeak) {
      inPeak = true;
      peakStart = i;
    } else if (c < threshold && inPeak) {
      // Check if valley is real (2+ weeks below threshold)
      let valleyLen = 0;
      for (let j = i; j < region.length && region[j] < threshold; j++) {
        valleyLen++;
      }
      if (valleyLen >= 2 || i >= region.length) {
        inPeak = false;
        let plays = 0;
        for (let j = peakStart; j < i; j++) plays += region[j];
        if (plays >= 5) {
          peaks.push({ relStart: peakStart, relEnd: i - 1, plays, weeks: i - peakStart });
        }
      }
    }
  }

  // If no splits, return whole region
  if (peaks.length === 0) {
    let total = 0;
    for (const c of region) total += c;
    if (total >= 5) {
      return [{ relStart: 0, relEnd: region.length - 1, plays: total, weeks: region.length }];
    }
  }

  return peaks;
}
```

- [ ] **Step 2: Write tests for Kleinberg core**

Create: `scripts/lib/__tests__/kleinberg.test.ts`

```typescript
// scripts/lib/__tests__/kleinberg.test.ts
import { kleinbergBurstDetection, extractBurstRegions, splitIntoPeaks } from "../kleinberg";

// Test 1: baseline — all zeros produces all state-0
const allZeros = new Array(52).fill(0);
const { states: zeroStates } = kleinbergBurstDetection(allZeros);
console.assert(
  zeroStates.every((s) => s === 0),
  "All-zero input should produce all state-0"
);

// Test 2: single spike should trigger burst
const singleSpike = new Array(52).fill(0);
singleSpike[25] = 20;
singleSpike[26] = 15;
singleSpike[27] = 10;
const { states: spikeStates } = kleinbergBurstDetection(singleSpike);
const spikeMax = Math.max(...spikeStates.slice(25, 28));
console.assert(spikeMax >= 1, "Spike should trigger state >= 1");
console.assert(spikeStates[0] === 0, "Non-spike period should be state 0");

// Test 3: extractBurstRegions finds contiguous regions
const testStates = [0, 0, 1, 2, 2, 1, 0, 0, 1, 0];
const regions = extractBurstRegions(testStates);
console.assert(regions.length === 2, `Expected 2 regions, got ${regions.length}`);
console.assert(regions[0].start === 2 && regions[0].end === 5, "First region 2-5");
console.assert(regions[0].maxState === 2, "First region max state 2");
console.assert(regions[1].start === 8 && regions[1].end === 8, "Second region 8-8");

// Test 4: splitIntoPeaks splits at valleys
const weeklyCounts = [5, 8, 10, 0, 0, 0, 7, 9, 6];
const peaks = splitIntoPeaks(weeklyCounts, 0, 8);
console.assert(peaks.length === 2, `Expected 2 peaks, got ${peaks.length}`);

// Test 5: splitIntoPeaks returns whole region if no valleys
const noValley = [5, 8, 10, 7, 9, 6];
const singlePeak = splitIntoPeaks(noValley, 0, 5);
console.assert(singlePeak.length === 1, "Should be single peak");

console.log("All Kleinberg tests passed!");
```

- [ ] **Step 3: Run tests**

Run: `npx tsx scripts/lib/__tests__/kleinberg.test.ts`
Expected: "All Kleinberg tests passed!"

- [ ] **Step 4: Commit**

```bash
git add scripts/lib/kleinberg.ts scripts/lib/__tests__/kleinberg.test.ts
git commit -m "feat(spotify): implement Kleinberg burst detection algorithm with tests"
```

---

### Task 3: Normalization Module

**Files:**
- Create: `scripts/lib/normalize.ts`

Parses raw Spotify export files into the unified `NormalizedPlay` format.

- [ ] **Step 1: Write normalizer**

```typescript
// scripts/lib/normalize.ts
import fs from "fs";
import path from "path";
import type { NormalizedPlay } from "../../src/lib/spotify/types";

interface ExtendedHistoryEntry {
  ts: string;
  ms_played: number;
  master_metadata_track_name: string | null;
  master_metadata_album_artist_name: string | null;
  master_metadata_album_album_name: string | null;
  spotify_track_uri: string | null;
  reason_start: string | null;
  reason_end: string | null;
  skipped: boolean | null;
  episode_name: string | null;
}

export function loadAndNormalize(rawDir: string): NormalizedPlay[] {
  const files = fs.readdirSync(rawDir).filter((f) => f.startsWith("Streaming_History_Audio") && f.endsWith(".json"));
  const plays: NormalizedPlay[] = [];

  for (const file of files.sort()) {
    const raw: ExtendedHistoryEntry[] = JSON.parse(fs.readFileSync(path.join(rawDir, file), "utf-8"));
    for (const entry of raw) {
      // Filter: skip short plays, podcasts, null tracks
      if (!entry.master_metadata_track_name) continue;
      if (entry.ms_played < 30000) continue;
      if (entry.episode_name) continue;

      plays.push({
        trackName: entry.master_metadata_track_name,
        artist: entry.master_metadata_album_artist_name || "Unknown",
        album: entry.master_metadata_album_album_name || "Unknown",
        trackUri: entry.spotify_track_uri || "",
        timestamp: entry.ts,
        msPlayed: entry.ms_played,
        reasonStart: entry.reason_start || undefined,
        reasonEnd: entry.reason_end || undefined,
        skipped: entry.skipped || undefined,
      });
    }
  }

  // Sort chronologically
  plays.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return plays;
}
```

- [ ] **Step 2: Test normalizer loads real data**

Run: `npx tsx -e "import { loadAndNormalize } from './scripts/lib/normalize'; const p = loadAndNormalize('data/spotify/raw'); console.log('Loaded', p.length, 'plays. First:', p[0]?.trackName, 'Last:', p[p.length-1]?.trackName)"`
Expected: "Loaded ~32970 plays. First: Island In The Sun Last: ..."

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/normalize.ts
git commit -m "feat(spotify): add raw data normalization module"
```

---

### Task 4: Main Analysis Pipeline

**Files:**
- Create: `scripts/analyze_spotify.ts`

Orchestrates the full pipeline: normalize → Kleinberg → peak split → daily peaks → output JSON.

- [ ] **Step 1: Write the analysis script**

```typescript
// scripts/analyze_spotify.ts
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { loadAndNormalize } from "./lib/normalize";
import { kleinbergBurstDetection, extractBurstRegions, splitIntoPeaks } from "./lib/kleinberg";
import type { MusicMoment, MusicInsight, NormalizedPlay } from "../src/lib/spotify/types";

const RAW_DIR = path.join(process.cwd(), "data/spotify/raw");
const OUT_DIR = path.join(process.cwd(), "src/data/spotify");

// ── Step 1: Load & normalize ──────────────────────────────────────
console.log("Loading raw data...");
const plays = loadAndNormalize(RAW_DIR);
console.log(`  ${plays.length} plays loaded`);

// ── Step 2: Build weekly buckets per track ────────────────────────
type TrackKey = string;
const trackWeekly = new Map<TrackKey, Map<string, number>>();
const trackDaily = new Map<TrackKey, Map<string, number>>();
const trackUris = new Map<TrackKey, string>();
const trackAlbums = new Map<TrackKey, string>();

function weekStart(isoDate: string): string {
  const d = new Date(isoDate);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setUTCDate(diff);
  return d.toISOString().slice(0, 10);
}

for (const play of plays) {
  const key: TrackKey = `${play.trackName} — ${play.artist}`;
  const week = weekStart(play.timestamp);
  const day = play.timestamp.slice(0, 10);

  if (!trackWeekly.has(key)) trackWeekly.set(key, new Map());
  trackWeekly.get(key)!.set(week, (trackWeekly.get(key)!.get(week) || 0) + 1);

  if (!trackDaily.has(key)) trackDaily.set(key, new Map());
  trackDaily.get(key)!.set(day, (trackDaily.get(key)!.get(day) || 0) + 1);

  if (play.trackUri && !trackUris.has(key)) trackUris.set(key, play.trackUri);
  if (!trackAlbums.has(key)) trackAlbums.set(key, play.album);
}

// Build week index
const timestamps = plays.map((p) => new Date(p.timestamp));
const minDate = new Date(Math.min(...timestamps.map((t) => t.getTime())));
const maxDate = new Date(Math.max(...timestamps.map((t) => t.getTime())));
// Align to Monday
minDate.setUTCDate(minDate.getUTCDate() - ((minDate.getUTCDay() + 6) % 7));

const allWeeks: string[] = [];
const d = new Date(minDate);
while (d <= maxDate) {
  allWeeks.push(d.toISOString().slice(0, 10));
  d.setUTCDate(d.getUTCDate() + 7);
}
const nWeeks = allWeeks.length;
console.log(`  ${nWeeks} weeks from ${allWeeks[0]} to ${allWeeks[nWeeks - 1]}`);

// ── Step 3: Run Kleinberg + peak splitting on each track ──────────
const MIN_TOTAL_PLAYS = 10;
const candidates = [...trackWeekly.entries()].filter(([, weeks]) => {
  let total = 0;
  for (const c of weeks.values()) total += c;
  return total >= MIN_TOTAL_PLAYS;
});
console.log(`  Running Kleinberg on ${candidates.length} tracks...`);

const moments: MusicMoment[] = [];

for (const [trackKey, weekMap] of candidates) {
  const weeklyCounts = allWeeks.map((w) => weekMap.get(w) || 0);

  // Layer 1: Kleinberg
  const { states } = kleinbergBurstDetection(weeklyCounts, { s: 2.0, gamma: 2.0, numStates: 4 });

  // Extract burst regions
  const regions = extractBurstRegions(states);

  for (const region of regions) {
    // Layer 2: Peak splitting
    const peaks = splitIntoPeaks(weeklyCounts, region.start, region.end);

    for (const peak of peaks) {
      const absStart = region.start + peak.relStart;
      const absEnd = region.start + peak.relEnd;

      // Layer 3: Daily peak detection
      const startDate = new Date(allWeeks[absStart]);
      const endDate = new Date(allWeeks[Math.min(absEnd, nWeeks - 1)]);
      endDate.setUTCDate(endDate.getUTCDate() + 6); // End of that week

      const dailyMap = trackDaily.get(trackKey)!;
      let peakDay = "";
      let peakDayPlays = 0;
      const cursor = new Date(startDate);
      while (cursor <= endDate) {
        const ds = cursor.toISOString().slice(0, 10);
        const cnt = dailyMap.get(ds) || 0;
        if (cnt > peakDayPlays) {
          peakDayPlays = cnt;
          peakDay = ds;
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }

      const [trackName, artist] = trackKey.split(" — ");
      const uri = trackUris.get(trackKey) || "";
      const dateRange = {
        start: allWeeks[absStart],
        end: allWeeks[Math.min(absEnd, nWeeks - 1)],
      };
      const id = crypto.createHash("md5").update(`${uri}:${dateRange.start}:${dateRange.end}`).digest("hex").slice(0, 12);

      moments.push({
        id,
        trackName,
        artist,
        album: trackAlbums.get(trackKey) || "Unknown",
        trackUri: uri,
        albumArtUrl: "", // Filled by enrichment step
        previewUrl: null,
        spotifyUrl: uri ? `https://open.spotify.com/track/${uri.split(":")[2]}` : "",
        dateRange,
        playCount: peak.plays,
        weeksCount: peak.weeks,
        intensity: peak.plays / Math.max(peak.weeks, 1),
        maxState: region.maxState,
        peakDay,
        peakDayPlays,
      });
    }
  }
}

// Sort: most recent first, then by intensity
moments.sort((a, b) => {
  const dateCompare = b.dateRange.start.localeCompare(a.dateRange.start);
  if (dateCompare !== 0) return dateCompare;
  return b.intensity - a.intensity;
});

console.log(`  ${moments.length} moments detected`);
console.log(`  State 3 (intense): ${moments.filter((m) => m.maxState === 3).length}`);
console.log(`  State 2 (burst): ${moments.filter((m) => m.maxState === 2).length}`);
console.log(`  State 1 (elevated): ${moments.filter((m) => m.maxState === 1).length}`);

// ── Step 4: Write output ──────────────────────────────────────────
fs.mkdirSync(OUT_DIR, { recursive: true });
const outPath = path.join(OUT_DIR, "music-moments.json");
fs.writeFileSync(outPath, JSON.stringify(moments, null, 2));
console.log(`\nWrote ${moments.length} moments to ${outPath}`);
```

- [ ] **Step 2: Add npm script to package.json**

Add to `package.json` scripts:
```json
"spotify:analyze": "tsx scripts/analyze_spotify.ts"
```

- [ ] **Step 3: Run the analysis on real data**

Run: `npm run spotify:analyze`
Expected output:
```
Loading raw data...
  ~32970 plays loaded
  ~213 weeks from 2022-02-14 to 2026-03-09
  Running Kleinberg on ~775 tracks...
  ~727 moments detected
  State 3 (intense): ~99
  State 2 (burst): ~165
  State 1 (elevated): ~132
Wrote ~727 moments to src/data/spotify/music-moments.json
```

- [ ] **Step 4: Verify output JSON structure**

Run: `npx tsx -e "const d = require('./src/data/spotify/music-moments.json'); console.log('Moments:', d.length); console.log('Sample:', JSON.stringify(d[0], null, 2))"`
Expected: Valid JSON with all MusicMoment fields populated (except albumArtUrl/previewUrl which are empty pre-enrichment).

- [ ] **Step 5: Commit**

```bash
git add scripts/analyze_spotify.ts src/data/spotify/music-moments.json package.json
git commit -m "feat(spotify): add main analysis pipeline with Kleinberg burst detection"
```

---

### Task 5: Spotify API Enrichment

**Files:**
- Create: `scripts/lib/spotify-api.ts`
- Modify: `scripts/analyze_spotify.ts` (add enrichment step)

Fetches album art and preview URLs from Spotify Web API for each unique track.

- [ ] **Step 1: Write Spotify API helper**

```typescript
// scripts/lib/spotify-api.ts
import type { SpotifyTrackMeta } from "../../src/lib/spotify/types";

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const TRACKS_URL = "https://api.spotify.com/v1/tracks";

async function getAccessToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in env");
  }
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

/**
 * Fetch metadata for up to 50 tracks at once (Spotify batch limit).
 */
async function fetchTrackBatch(
  trackIds: string[],
  token: string
): Promise<Map<string, SpotifyTrackMeta>> {
  const res = await fetch(`${TRACKS_URL}?ids=${trackIds.join(",")}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Tracks API failed: ${res.status}`);
  const data = await res.json();
  const result = new Map<string, SpotifyTrackMeta>();

  for (const track of data.tracks) {
    if (!track) continue;
    result.set(`spotify:track:${track.id}`, {
      trackUri: `spotify:track:${track.id}`,
      albumArtUrl: track.album?.images?.[1]?.url || track.album?.images?.[0]?.url || "",
      previewUrl: track.preview_url || null,
      spotifyUrl: track.external_urls?.spotify || "",
      genres: [], // Genres come from artist endpoint, skip for v1
    });
  }
  return result;
}

/**
 * Enrich a list of track URIs with Spotify metadata.
 * Batches requests in groups of 50, with rate limiting.
 */
export async function enrichTracks(
  trackUris: string[]
): Promise<Map<string, SpotifyTrackMeta>> {
  const token = await getAccessToken();
  const allMeta = new Map<string, SpotifyTrackMeta>();

  // Extract track IDs from URIs
  const uriToId = new Map<string, string>();
  for (const uri of trackUris) {
    const parts = uri.split(":");
    if (parts.length === 3 && parts[2]) {
      uriToId.set(uri, parts[2]);
    }
  }

  const ids = [...uriToId.values()];
  const BATCH_SIZE = 50;

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    console.log(`  Fetching Spotify metadata: batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(ids.length / BATCH_SIZE)}`);
    const meta = await fetchTrackBatch(batch, token);
    for (const [uri, m] of meta) allMeta.set(uri, m);

    // Rate limit: 100ms between batches
    if (i + BATCH_SIZE < ids.length) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return allMeta;
}
```

- [ ] **Step 2: Add enrichment step to analyze_spotify.ts**

After the moment generation and before writing output, add:

```typescript
// ── Step 4: Spotify API Enrichment ────────────────────────────────
import dotenv from "dotenv";
dotenv.config({ path: path.join(process.cwd(), ".env.local") });
import { enrichTracks } from "./lib/spotify-api";

const uniqueUris = [...new Set(moments.map((m) => m.trackUri).filter(Boolean))];
console.log(`\nEnriching ${uniqueUris.length} unique tracks via Spotify API...`);

try {
  const meta = await enrichTracks(uniqueUris);
  let enriched = 0;
  for (const moment of moments) {
    const m = meta.get(moment.trackUri);
    if (m) {
      moment.albumArtUrl = m.albumArtUrl;
      moment.previewUrl = m.previewUrl;
      moment.spotifyUrl = m.spotifyUrl || moment.spotifyUrl;
      enriched++;
    }
  }
  console.log(`  Enriched ${enriched}/${moments.length} moments with album art + preview URLs`);
} catch (err) {
  console.warn(`  Enrichment failed (continuing without): ${err}`);
}
```

Note: Move the dotenv import to the top of the file. The enrichment is wrapped in try/catch — if API keys aren't set, analysis still works, just without album art.

- [ ] **Step 3: Add env vars to .env.example**

Add to `.env.example`:
```bash
# Spotify API (for album art enrichment)
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
```

- [ ] **Step 4: Test enrichment (requires API keys)**

Run: `npm run spotify:analyze`
Expected: Should now show "Enriching N unique tracks..." and populate albumArtUrl fields.
If no API keys: "Enrichment failed (continuing without)" — still produces valid output.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/spotify-api.ts scripts/analyze_spotify.ts .env.example
git commit -m "feat(spotify): add Spotify API enrichment for album art and preview URLs"
```

---

### Task 6: Secondary Insights (Admin-Only Data)

**Files:**
- Create: `scripts/lib/insights.ts`
- Modify: `scripts/analyze_spotify.ts` (add insights generation + write music-insights.json)

- [ ] **Step 1: Write insights detection module**

```typescript
// scripts/lib/insights.ts
import type { NormalizedPlay, MusicMoment, MusicInsight, InsightType } from "../../src/lib/spotify/types";

type TrackKey = string;

/**
 * Compute secondary insights for each moment.
 * Requires the full play history for context.
 */
export function computeInsights(
  moments: MusicMoment[],
  plays: NormalizedPlay[]
): MusicInsight[] {
  // Pre-index plays by track
  const playsByTrack = new Map<TrackKey, NormalizedPlay[]>();
  for (const p of plays) {
    const key: TrackKey = `${p.trackName} — ${p.artist}`;
    if (!playsByTrack.has(key)) playsByTrack.set(key, []);
    playsByTrack.get(key)!.push(p);
  }

  // Pre-index moments by track for comeback detection
  const momentsByTrack = new Map<TrackKey, MusicMoment[]>();
  for (const m of moments) {
    const key: TrackKey = `${m.trackName} — ${m.artist}`;
    if (!momentsByTrack.has(key)) momentsByTrack.set(key, []);
    momentsByTrack.get(key)!.push(m);
  }

  // Total plays per day for listening share
  const totalByDay = new Map<string, number>();
  for (const p of plays) {
    const day = p.timestamp.slice(0, 10);
    totalByDay.set(day, (totalByDay.get(day) || 0) + 1);
  }

  // Unique tracks per day for context
  const uniqueTracksByDay = new Map<string, Set<string>>();
  for (const p of plays) {
    const day = p.timestamp.slice(0, 10);
    if (!uniqueTracksByDay.has(day)) uniqueTracksByDay.set(day, new Set());
    uniqueTracksByDay.get(day)!.add(`${p.trackName} — ${p.artist}`);
  }

  return moments.map((moment) => {
    const key: TrackKey = `${moment.trackName} — ${moment.artist}`;
    const trackPlays = playsByTrack.get(key) || [];
    const trackMoments = momentsByTrack.get(key) || [];
    const insightTypes: InsightType[] = [];

    // Always tag as burst
    insightTypes.push("burst");

    // Comeback: 2+ moments for this track
    if (trackMoments.length >= 2) {
      insightTypes.push("comeback");
    }

    // Loyalty: 50+ total plays across 4+ months
    const monthsWithPlays = new Set(trackPlays.map((p) => p.timestamp.slice(0, 7)));
    if (trackPlays.length >= 50 && monthsWithPlays.size >= 4) {
      insightTypes.push("loyalty");
    }

    // Late night: 50%+ plays between midnight-4am
    const nightPlays = trackPlays.filter((p) => {
      const hour = parseInt(p.timestamp.slice(11, 13));
      return hour >= 0 && hour < 4;
    });
    if (trackPlays.length >= 10 && nightPlays.length / trackPlays.length >= 0.5) {
      insightTypes.push("late_night");
    }

    // Session anchor: 30%+ plays started manually
    const manualStarts = trackPlays.filter((p) => p.reasonStart === "playbtn");
    if (trackPlays.length >= 10 && manualStarts.length / trackPlays.length >= 0.3) {
      insightTypes.push("session_anchor");
    }

    // One-and-done: this moment followed by 60+ days of silence
    const momentEndDate = new Date(moment.dateRange.end);
    const laterPlays = trackPlays.filter((p) => new Date(p.timestamp) > momentEndDate);
    if (laterPlays.length === 0) {
      const daysSinceEnd = (Date.now() - momentEndDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceEnd >= 60) {
        insightTypes.push("one_and_done");
      }
    } else {
      const nextPlay = new Date(laterPlays[0].timestamp);
      const gap = (nextPlay.getTime() - momentEndDate.getTime()) / (1000 * 60 * 60 * 24);
      if (gap >= 60) {
        insightTypes.push("one_and_done");
      }
    }

    // Time of day distribution
    const hourDist: Record<string, number> = {};
    for (let h = 0; h < 24; h++) hourDist[String(h)] = 0;
    for (const p of trackPlays) {
      const hour = parseInt(p.timestamp.slice(11, 13));
      hourDist[String(hour)]++;
    }

    // Window context (plays in the moment's date range)
    const startDate = moment.dateRange.start;
    const endDate = moment.dateRange.end;
    let totalInWindow = 0;
    const uniqueInWindow = new Set<string>();
    const cursor = new Date(startDate);
    const end = new Date(endDate);
    end.setDate(end.getDate() + 7); // Include full last week
    while (cursor <= end) {
      const ds = cursor.toISOString().slice(0, 10);
      totalInWindow += totalByDay.get(ds) || 0;
      const ut = uniqueTracksByDay.get(ds);
      if (ut) for (const t of ut) uniqueInWindow.add(t);
      cursor.setDate(cursor.getDate() + 1);
    }

    return {
      ...moment,
      insightTypes,
      context: {
        totalPlaysInWindow: totalInWindow,
        uniqueTracksInWindow: uniqueInWindow.size,
        timeOfDayDistribution: hourDist,
        monthsActive: monthsWithPlays.size,
      },
    };
  });
}
```

- [ ] **Step 2: Wire insights into analyze_spotify.ts**

After the enrichment step and before writing output, add:

```typescript
import { computeInsights } from "./lib/insights";

console.log("\nComputing secondary insights...");
const insights = computeInsights(moments, plays);
const insightCounts: Record<string, number> = {};
for (const insight of insights) {
  for (const type of insight.insightTypes) {
    insightCounts[type] = (insightCounts[type] || 0) + 1;
  }
}
console.log("  Insight distribution:", insightCounts);

// Write insights JSON
const insightsPath = path.join(OUT_DIR, "music-insights.json");
fs.writeFileSync(insightsPath, JSON.stringify(insights, null, 2));
console.log(`Wrote ${insights.length} insights to ${insightsPath}`);
```

- [ ] **Step 3: Run and verify**

Run: `npm run spotify:analyze`
Expected: Should now also show insight distribution and write `music-insights.json`.

- [ ] **Step 4: Commit**

```bash
git add scripts/lib/insights.ts scripts/analyze_spotify.ts src/data/spotify/music-insights.json
git commit -m "feat(spotify): add secondary insight detection (comebacks, loyalty, late night, etc.)"
```

---

## Chunk 2: Admin Mode and UI Components

This chunk builds the site-wide admin mode system and all React components for the Spotify bubble widget. It depends on Chunk 1's output JSON files.

### Task 7: Admin Mode Provider

**Files:**
- Create: `src/components/AdminModeProvider.tsx`
- Create: `src/hooks/useAdminMode.ts`
- Modify: `src/app/layout.tsx` (wrap with provider)

- [ ] **Step 1: Write AdminModeProvider**

```typescript
// src/components/AdminModeProvider.tsx
"use client";

import React, { createContext, useState, useEffect, type ReactNode } from "react";

interface AdminModeContextType {
  adminMode: boolean;
}

export const AdminModeContext = createContext<AdminModeContextType>({ adminMode: false });

const STORAGE_KEY = "mv-admin-mode";

export function AdminModeProvider({ children }: { children: ReactNode }) {
  const [adminMode, setAdminMode] = useState(false);

  useEffect(() => {
    // Check localStorage first
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setAdminMode(true);

    // Check URL param
    const params = new URLSearchParams(window.location.search);
    const adminParam = params.get("admin");
    const expectedKey = process.env.NEXT_PUBLIC_ADMIN_MODE_KEY;

    if (adminParam === "off") {
      localStorage.removeItem(STORAGE_KEY);
      setAdminMode(false);
    } else if (adminParam && expectedKey && adminParam === expectedKey) {
      localStorage.setItem(STORAGE_KEY, "true");
      setAdminMode(true);
    }

    // Strip admin param from URL
    if (adminParam) {
      params.delete("admin");
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  return (
    <AdminModeContext.Provider value={{ adminMode }}>
      {children}
    </AdminModeContext.Provider>
  );
}
```

- [ ] **Step 2: Write useAdminMode hook**

```typescript
// src/hooks/useAdminMode.ts
"use client";

import { useContext } from "react";
import { AdminModeContext } from "@/components/AdminModeProvider";

export function useAdminMode(): boolean {
  return useContext(AdminModeContext).adminMode;
}
```

- [ ] **Step 3: Add to layout.tsx**

In `src/app/layout.tsx`, import and wrap inside the existing provider chain:

```tsx
import { AdminModeProvider } from "@/components/AdminModeProvider";
```

Wrap children: `<DeepModeProvider><AdminModeProvider>{children}<IrisPalette /></AdminModeProvider></DeepModeProvider>`

- [ ] **Step 4: Add env var to .env.example and .env.local**

Add to `.env.example`:
```bash
# Admin mode key (client-side, non-sensitive)
NEXT_PUBLIC_ADMIN_MODE_KEY=
```

Set a value in `.env.local`.

- [ ] **Step 5: Test — verify admin mode activates**

Run: `npm run dev`
Visit: `http://localhost:3000?admin=<your-key>`
Check: Open browser console, run `localStorage.getItem('mv-admin-mode')` — should return `"true"`.
Check: URL should have `?admin` stripped.
Visit: `http://localhost:3000?admin=off` — should clear.

- [ ] **Step 6: Commit**

```bash
git add src/components/AdminModeProvider.tsx src/hooks/useAdminMode.ts src/app/layout.tsx .env.example
git commit -m "feat: add site-wide admin mode with localStorage + URL param activation"
```

---

### Task 8: Spotify Data Loader

**Files:**
- Create: `src/data/spotify/loader.ts`

Loads the static JSON files and exports typed arrays for component consumption. Follows the existing `src/data/loaders.ts` pattern.

- [ ] **Step 1: Write loader**

```typescript
// src/data/spotify/loader.ts
import type { MusicMoment, MusicInsight } from "@/lib/spotify/types";

// Static imports — bundled at build time
import momentsData from "./music-moments.json";
import insightsData from "./music-insights.json";

export const musicMoments: MusicMoment[] = momentsData as MusicMoment[];
export const musicInsights: MusicInsight[] = insightsData as MusicInsight[];

/**
 * Get moments grouped by month, sorted reverse-chronologically.
 */
export function getMomentsByMonth(
  moments: MusicMoment[]
): Array<{ month: string; moments: MusicMoment[] }> {
  const grouped = new Map<string, MusicMoment[]>();

  for (const m of moments) {
    // Use start date's year-month
    const month = m.dateRange.start.slice(0, 7);
    if (!grouped.has(month)) grouped.set(month, []);
    grouped.get(month)!.push(m);
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, moments]) => ({
      month,
      moments: moments.sort((a, b) => b.intensity - a.intensity),
    }));
}

/**
 * Format month string for display: "2025-03" → "March 2025"
 */
export function formatMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
```

- [ ] **Step 2: Ensure placeholder JSON files exist for build safety**

If `music-moments.json` or `music-insights.json` don't exist yet (repo was cloned without running analysis), create empty-array placeholders so `next build` doesn't fail:

```bash
# Only if files don't exist yet:
[ -f src/data/spotify/music-moments.json ] || echo '[]' > src/data/spotify/music-moments.json
[ -f src/data/spotify/music-insights.json ] || echo '[]' > src/data/spotify/music-insights.json
```

- [ ] **Step 3: Verify loader compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to spotify loader.

- [ ] **Step 4: Commit**

```bash
git add src/data/spotify/loader.ts
git commit -m "feat(spotify): add data loader for music moments and insights"
```

---

### Task 9: SpotifyCard Component

**Files:**
- Create: `src/components/spotify/SpotifyCard.tsx`
- Modify: `next.config.ts` (add Spotify CDN to image remote patterns)

Individual moment card — the building block for both collapsed and expanded views.

- [ ] **Step 0: Add Spotify CDN to next.config.ts**

`next/image` requires whitelisting external hostnames. Add Spotify's CDN:

```typescript
// In next.config.ts, add to the config object:
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'i.scdn.co' },
  ],
},
```

- [ ] **Step 1: Write SpotifyCard**

```typescript
// src/components/spotify/SpotifyCard.tsx
"use client";

import React, { useRef, useCallback } from "react";
import Image from "next/image";
import { ExternalLink, Play, Pause } from "lucide-react";
import type { MusicMoment } from "@/lib/spotify/types";

interface SpotifyCardProps {
  moment: MusicMoment;
  compact?: boolean;
  isPlaying?: boolean;
  playProgress?: number; // 0-1
  onPlayToggle?: (moment: MusicMoment) => void;
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const sMonth = s.toLocaleDateString("en-US", { month: "short" });
  const eMonth = e.toLocaleDateString("en-US", { month: "short" });
  const sDay = s.getDate();
  const eDay = e.getDate();
  const sYear = s.getFullYear();
  const eYear = e.getFullYear();

  if (start === end) return `${sMonth} ${sDay}, ${sYear}`;
  if (sYear === eYear && sMonth === eMonth) return `${sMonth} ${sDay}–${eDay}, ${sYear}`;
  if (sYear === eYear) return `${sMonth} ${sDay} – ${eMonth} ${eDay}, ${sYear}`;
  return `${sMonth} ${sDay}, ${sYear} – ${eMonth} ${eDay}, ${eYear}`;
}

export default function SpotifyCard({
  moment,
  compact = false,
  isPlaying = false,
  playProgress = 0,
  onPlayToggle,
}: SpotifyCardProps) {
  const hasPreview = !!moment.previewUrl;
  const artSize = compact ? 36 : 64;

  return compact ? (
    // ── Compact row (collapsed view) ──
    <div className="flex items-center gap-2.5 py-1.5">
      <div
        className="relative rounded-md overflow-hidden flex-shrink-0 bg-gray-700"
        style={{ width: artSize, height: artSize }}
      >
        {moment.albumArtUrl && (
          <Image
            src={moment.albumArtUrl}
            alt={moment.album}
            fill
            sizes={`${artSize}px`}
            className="object-cover"
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-100 truncate leading-tight">
          {moment.trackName}
        </p>
        <p className="text-[10px] text-gray-500 truncate leading-tight">
          {moment.artist} · {formatDateRange(moment.dateRange.start, moment.dateRange.end)}
        </p>
      </div>
    </div>
  ) : (
    // ── Full card (expanded view) ──
    <div className="bg-white/[0.04] rounded-xl p-3.5 border border-white/[0.06]">
      <div className="flex gap-3">
        {/* Album art with play button */}
        <div
          className="relative rounded-lg overflow-hidden flex-shrink-0 bg-gray-700 group cursor-pointer"
          style={{ width: artSize, height: artSize }}
          onClick={() => hasPreview && onPlayToggle?.(moment)}
        >
          {moment.albumArtUrl && (
            <Image
              src={moment.albumArtUrl}
              alt={moment.album}
              fill
              sizes={`${artSize}px`}
              className="object-cover"
            />
          )}
          {hasPreview && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
              {isPlaying ? (
                <Pause className="w-5 h-5 text-white fill-white" />
              ) : (
                <Play className="w-5 h-5 text-white fill-white ml-0.5" />
              )}
            </div>
          )}
          {/* Progress bar */}
          {isPlaying && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-600">
              <div
                className="h-full bg-[#1DB954] transition-all duration-200"
                style={{ width: `${playProgress * 100}%` }}
              />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-100 truncate">
                {moment.trackName}
              </p>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{moment.artist}</p>
            </div>
            {moment.spotifyUrl && (
              <a
                href={moment.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1DB954] hover:text-[#1ed760] transition-colors flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
          <p className="text-[11px] text-[#1DB954] mt-1.5 font-medium">
            {formatDateRange(moment.dateRange.start, moment.dateRange.end)}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-4 mt-2.5 pt-2.5 border-t border-white/[0.06]">
        <div className="text-center">
          <p className="text-base font-bold text-white">{moment.playCount}</p>
          <p className="text-[9px] text-gray-500 uppercase tracking-wide">plays</p>
        </div>
        <div className="text-center">
          <p className="text-base font-bold text-white">{moment.weeksCount}</p>
          <p className="text-[9px] text-gray-500 uppercase tracking-wide">
            {moment.weeksCount === 1 ? "week" : "weeks"}
          </p>
        </div>
        <div className="text-center">
          <p className="text-base font-bold text-white">{moment.intensity.toFixed(1)}</p>
          <p className="text-[9px] text-gray-500 uppercase tracking-wide">per wk</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/spotify/SpotifyCard.tsx
git commit -m "feat(spotify): add SpotifyCard component (compact + expanded variants)"
```

---

### Task 10: Audio Preview Hook

**Files:**
- Create: `src/hooks/useAudioPreview.ts`

Manages HTML5 Audio playback for 30-second Spotify previews. Single-active-preview behavior.

- [ ] **Step 1: Write useAudioPreview hook**

```typescript
// src/hooks/useAudioPreview.ts
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { MusicMoment } from "@/lib/spotify/types";

interface UseAudioPreviewReturn {
  currentMomentId: string | null;
  isPlaying: boolean;
  progress: number; // 0-1
  togglePlay: (moment: MusicMoment) => void;
  stop: () => void;
}

export function useAudioPreview(): UseAudioPreviewReturn {
  const [currentMomentId, setCurrentMomentId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    cancelAnimationFrame(rafRef.current);
    setCurrentMomentId(null);
    setIsPlaying(false);
    setProgress(0);
  }, []);

  const updateProgress = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.duration) {
      setProgress(audio.currentTime / audio.duration);
    }
    if (audioRef.current && !audioRef.current.paused) {
      rafRef.current = requestAnimationFrame(updateProgress);
    }
  }, []);

  const togglePlay = useCallback(
    (moment: MusicMoment) => {
      if (!moment.previewUrl) return;

      // Same track — toggle pause/play
      if (currentMomentId === moment.id && audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause();
          cancelAnimationFrame(rafRef.current);
          setIsPlaying(false);
        } else {
          audioRef.current.play().catch(() => {});
          rafRef.current = requestAnimationFrame(updateProgress);
          setIsPlaying(true);
        }
        return;
      }

      // Different track — stop current, start new
      stop();

      const audio = new Audio(moment.previewUrl);
      audioRef.current = audio;
      setCurrentMomentId(moment.id);

      audio.addEventListener("ended", () => {
        setIsPlaying(false);
        setProgress(0);
        setCurrentMomentId(null);
      });

      audio.addEventListener("error", () => {
        // Silent fallback on error
        stop();
      });

      audio.play().then(() => {
        setIsPlaying(true);
        rafRef.current = requestAnimationFrame(updateProgress);
      }).catch(() => {
        stop();
      });
    },
    [currentMomentId, isPlaying, stop, updateProgress]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { currentMomentId, isPlaying, progress, togglePlay, stop };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useAudioPreview.ts
git commit -m "feat(spotify): add useAudioPreview hook for 30-second preview playback"
```

---

### Task 11: SpotifyBubble — Main Widget

**Files:**
- Create: `src/components/spotify/SpotifyBubble.tsx`
- Modify: `src/app/page.tsx` (mount in deep mode)

The main floating bubble with collapsed/expanded states.

- [ ] **Step 1: Write SpotifyBubble**

```typescript
// src/components/spotify/SpotifyBubble.tsx
"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Music, ChevronDown } from "lucide-react";
import { musicMoments, getMomentsByMonth, formatMonth } from "@/data/spotify/loader";
import { useAudioPreview } from "@/hooks/useAudioPreview";
import { useAdminMode } from "@/hooks/useAdminMode";
import { useDeepMode } from "@/components/DeepModeContext";
import SpotifyCard from "./SpotifyCard";

const COLLAPSED_COUNT = 3;

export default function SpotifyBubble() {
  const [expanded, setExpanded] = useState(false);
  const { currentMomentId, isPlaying, progress, togglePlay, stop } = useAudioPreview();
  const adminMode = useAdminMode();
  const { deepMode } = useDeepMode();

  // Filter: public view shows state 2+ only; admin shows all
  const filteredMoments = useMemo(
    () => musicMoments.filter((m) => adminMode || m.maxState >= 2),
    [adminMode]
  );

  const grouped = useMemo(() => getMomentsByMonth(filteredMoments), [filteredMoments]);

  // Recent moments for collapsed view
  const recentMoments = filteredMoments.slice(0, COLLAPSED_COUNT);

  if (!deepMode || filteredMoments.length === 0) return null;

  return (
    <div className="hidden md:block fixed bottom-6 left-6 z-40">
      <motion.div
        layout
        className="bg-[#1a1a2e] rounded-2xl shadow-2xl shadow-black/30 overflow-hidden"
        style={{ width: expanded ? 420 : 260 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        {/* Header */}
        <button
          onClick={() => {
            if (expanded) stop();
            setExpanded(!expanded);
          }}
          className="w-full flex items-center justify-between px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#1DB954] to-[#1ed760] flex items-center justify-center">
              <Music className="w-3 h-3 text-black" />
            </div>
            <span className="text-[11px] font-semibold tracking-widest uppercase text-gray-400">
              Mike&apos;s Music
            </span>
          </div>
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
          </motion.div>
        </button>

        <AnimatePresence mode="wait">
          {!expanded ? (
            // ── Collapsed: recent moments ──
            <motion.div
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 pb-3"
            >
              {recentMoments.map((m) => (
                <SpotifyCard key={m.id} moment={m} compact />
              ))}
              {filteredMoments.length > COLLAPSED_COUNT && (
                <div className="flex items-center gap-1 mt-2 justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#1DB954]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#1DB954] opacity-60" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#1DB954] opacity-30" />
                  <span className="text-[9px] text-gray-500 ml-1">
                    {filteredMoments.length - COLLAPSED_COUNT} more moments
                  </span>
                </div>
              )}
            </motion.div>
          ) : (
            // ── Expanded: scrollable timeline ──
            <motion.div
              key="expanded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 pb-4 max-h-[480px] overflow-y-auto"
            >
              {grouped.map(({ month, moments }) => (
                <div key={month}>
                  <p className="text-[10px] font-semibold tracking-widest uppercase text-[#1DB954] mb-2 mt-3 first:mt-0">
                    {formatMonth(month)}
                  </p>
                  <div className="space-y-2.5">
                    {moments.map((m) => (
                      <SpotifyCard
                        key={m.id}
                        moment={m}
                        isPlaying={currentMomentId === m.id && isPlaying}
                        playProgress={currentMomentId === m.id ? progress : 0}
                        onPlayToggle={togglePlay}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-center text-[10px] text-gray-500 mt-3">
                {filteredMoments.length} moments · {new Set(filteredMoments.map((m) => `${m.trackName}—${m.artist}`)).size} songs
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Mount SpotifyBubble in page.tsx**

In `src/app/page.tsx`, import and render conditionally in deep mode:

```tsx
import SpotifyBubble from "@/components/spotify/SpotifyBubble";
```

Inside the main component, after other sections (no conditional — bubble handles its own deep mode check internally since page.tsx may be a server component):
```tsx
<SpotifyBubble />
```

- [ ] **Step 3: Test the full flow**

Run: `npm run dev`
1. Open `http://localhost:3000`
2. Activate deep mode (Cmd+Shift+. or click profile photo)
3. Verify: floating bubble appears bottom-left with 3 recent moments
4. Click to expand — should show full scrollable timeline grouped by month
5. Click album art to play preview (if enriched with Spotify API)
6. Collapse — audio should stop

- [ ] **Step 4: Commit**

```bash
git add src/components/spotify/SpotifyBubble.tsx src/app/page.tsx
git commit -m "feat(spotify): add SpotifyBubble widget with collapsed/expanded timeline"
```

---

### Task 12: Admin Detail View

**Files:**
- Create: `src/components/spotify/SpotifyAdminDetail.tsx`
- Modify: `src/components/spotify/SpotifyCard.tsx` (add admin detail toggle)

- [ ] **Step 1: Write SpotifyAdminDetail**

```typescript
// src/components/spotify/SpotifyAdminDetail.tsx
"use client";

import React from "react";
import type { MusicInsight, InsightType } from "@/lib/spotify/types";

const INSIGHT_LABELS: Record<InsightType, { label: string; color: string }> = {
  burst: { label: "Burst", color: "bg-green-500/20 text-green-400" },
  comeback: { label: "Comeback", color: "bg-blue-500/20 text-blue-400" },
  loyalty: { label: "Loyal Fav", color: "bg-purple-500/20 text-purple-400" },
  late_night: { label: "Late Night", color: "bg-indigo-500/20 text-indigo-400" },
  artist_dive: { label: "Deep Dive", color: "bg-orange-500/20 text-orange-400" },
  session_anchor: { label: "Opener", color: "bg-yellow-500/20 text-yellow-400" },
  one_and_done: { label: "One & Done", color: "bg-red-500/20 text-red-400" },
  seasonal: { label: "Seasonal", color: "bg-teal-500/20 text-teal-400" },
};

export default function SpotifyAdminDetail({ insight }: { insight: MusicInsight }) {
  return (
    <div className="mt-2.5 pt-2.5 border-t border-white/[0.06] space-y-2">
      {/* Insight tags */}
      <div className="flex flex-wrap gap-1">
        {insight.insightTypes.map((type) => {
          const { label, color } = INSIGHT_LABELS[type];
          return (
            <span
              key={type}
              className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${color}`}
            >
              {label}
            </span>
          );
        })}
      </div>

      {/* Context stats */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
        <div className="text-gray-500">
          Window: <span className="text-gray-300">{insight.context.totalPlaysInWindow} total plays</span>
        </div>
        <div className="text-gray-500">
          Unique: <span className="text-gray-300">{insight.context.uniqueTracksInWindow} tracks</span>
        </div>
        {insight.context.monthsActive && (
          <div className="text-gray-500">
            Active: <span className="text-gray-300">{insight.context.monthsActive} months</span>
          </div>
        )}
        <div className="text-gray-500">
          State: <span className="text-gray-300">S{insight.maxState}</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire admin detail into SpotifyCard**

In `src/components/spotify/SpotifyCard.tsx`, add:
- Import `useAdminMode` and `SpotifyAdminDetail`
- Import `musicInsights` from loader
- In the full card variant (non-compact), after the stats row, conditionally render:

```tsx
{adminMode && insight && <SpotifyAdminDetail insight={insight} />}
```

Where `insight` is looked up from `musicInsights` by matching `moment.id`.

- [ ] **Step 3: Test admin view**

Run: `npm run dev`
1. Visit `http://localhost:3000?admin=<your-key>`
2. Activate deep mode
3. Expand the bubble
4. Verify: cards now show insight tags (Burst, Comeback, etc.) and context stats

- [ ] **Step 4: Commit**

```bash
git add src/components/spotify/SpotifyAdminDetail.tsx src/components/spotify/SpotifyCard.tsx
git commit -m "feat(spotify): add admin-only insight detail panel on music cards"
```

---

## Chunk 3: Refresh Script and Polish

### Task 13: Spotify Refresh Script

**Files:**
- Create: `scripts/refresh_spotify.ts`
- Modify: `package.json` (add npm scripts)

For ongoing data freshness — fetches recent plays from Spotify API and merges with existing data.

- [ ] **Step 1: Write refresh script**

```typescript
// scripts/refresh_spotify.ts
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

import fs from "fs";

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const RECENTLY_PLAYED_URL = "https://api.spotify.com/v1/me/player/recently-played?limit=50";

async function getAccessTokenFromRefresh(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, or SPOTIFY_REFRESH_TOKEN");
  }
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: `grant_type=refresh_token&refresh_token=${refreshToken}`,
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function fetchRecentPlays(token: string) {
  const res = await fetch(RECENTLY_PLAYED_URL, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Recently played failed: ${res.status}`);
  const data = await res.json();
  return data.items;
}

// Convert Spotify API recently-played to extended history format
// so it can be processed by analyze_spotify.ts
async function main() {
  console.log("Fetching recent plays from Spotify API...");
  const token = await getAccessTokenFromRefresh();
  const items = await fetchRecentPlays(token);
  console.log(`  Got ${items.length} recent plays`);

  // Convert to extended history format
  const entries = items.map((item: any) => ({
    ts: item.played_at,
    ms_played: item.track.duration_ms, // Full duration (API doesn't give actual ms_played)
    master_metadata_track_name: item.track.name,
    master_metadata_album_artist_name: item.track.artists[0]?.name || "Unknown",
    master_metadata_album_album_name: item.track.album?.name || "Unknown",
    spotify_track_uri: item.track.uri,
    reason_start: "api_fetch",
    reason_end: "api_fetch",
    skipped: false,
    episode_name: null,
  }));

  // Append to a refresh file in raw dir
  const refreshPath = path.join(process.cwd(), "data/spotify/raw/api_recent_plays.json");
  let existing: any[] = [];
  if (fs.existsSync(refreshPath)) {
    existing = JSON.parse(fs.readFileSync(refreshPath, "utf-8"));
  }

  // Deduplicate by timestamp + track
  const existingKeys = new Set(existing.map((e: any) => `${e.ts}:${e.master_metadata_track_name}`));
  const newEntries = entries.filter((e: any) => !existingKeys.has(`${e.ts}:${e.master_metadata_track_name}`));

  const merged = [...existing, ...newEntries].sort((a: any, b: any) => a.ts.localeCompare(b.ts));
  fs.writeFileSync(refreshPath, JSON.stringify(merged, null, 2));
  console.log(`  Added ${newEntries.length} new plays (${merged.length} total in refresh file)`);
  console.log("\nNow run 'npm run spotify:analyze' to regenerate moments.");
}

main().catch(console.error);
```

- [ ] **Step 2: Update normalize.ts to include api_recent_plays.json**

The normalizer already reads all `Streaming_History_Audio*` files. Add support for the refresh file by also checking for `api_recent_plays.json`:

In `scripts/lib/normalize.ts`, update the file filter:
```typescript
const files = fs.readdirSync(rawDir).filter((f) =>
  (f.startsWith("Streaming_History_Audio") || f === "api_recent_plays.json") && f.endsWith(".json")
);
```

- [ ] **Step 3: Add npm scripts to package.json**

```json
"spotify:analyze": "tsx scripts/analyze_spotify.ts",
"spotify:refresh": "tsx scripts/refresh_spotify.ts",
"spotify:rebuild": "npm run spotify:refresh && npm run spotify:analyze"
```

Add `SPOTIFY_REFRESH_TOKEN=` to `.env.example`.

- [ ] **Step 4: Commit**

```bash
git add scripts/refresh_spotify.ts scripts/lib/normalize.ts package.json .env.example
git commit -m "feat(spotify): add refresh script for ongoing Spotify API data pulls"
```

---

### Task 14: Final Integration Test

- [ ] **Step 1: Full rebuild test**

Run the complete pipeline:
```bash
npm run spotify:analyze
npm run dev
```

- [ ] **Step 2: Verify all states**

1. **No deep mode**: Bubble should not be visible
2. **Deep mode on**: Bubble appears bottom-left, shows 3 most recent moments (state 2+)
3. **Expand**: Full timeline with month groups, album art, play buttons
4. **Audio preview**: Click art → plays 30-sec preview, progress bar, single-active
5. **Admin mode**: Visit with `?admin=key`, cards show insight tags
6. **Collapse**: Stops audio, returns to compact view
7. **Mobile**: Bubble hidden (`hidden md:block`)

- [ ] **Step 3: Production build test**

Run: `npm run build`
Expected: No TypeScript errors, no build failures.

- [ ] **Step 4: Final commit**

Verify no untracked sensitive files, then commit any remaining changes:
```bash
git status
# Review output, then add specific files as needed
git commit -m "feat(spotify): complete Mike's Music timeline with Kleinberg burst detection"
```
