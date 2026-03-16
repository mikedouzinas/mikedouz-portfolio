/**
 * analyze_spotify.ts
 *
 * Main orchestrator: loads raw Spotify plays, buckets them by week and day per
 * track, runs Kleinberg burst detection, splits bursts into peaks, then writes
 * MusicMoment objects to src/data/spotify/music-moments.json.
 *
 * Usage:  npx tsx scripts/analyze_spotify.ts
 */

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

import fs from "fs";
import crypto from "crypto";

import { loadAndNormalize } from "./lib/normalize";
import {
  kleinbergBurstDetection,
  extractBurstRegions,
  splitIntoPeaks,
} from "./lib/kleinberg";
import { enrichTracks } from "./lib/spotify-api";
import { computeInsights } from "./lib/insights";
import type { MusicMoment } from "../src/lib/spotify/types";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const RAW_DIR = path.resolve(__dirname, "../data/spotify/raw");
const OUT_DIR = path.resolve(__dirname, "../src/data/spotify");
const OUT_FILE = path.resolve(OUT_DIR, "music-moments.json");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the ISO date string (YYYY-MM-DD) for the Monday of the week
 *  containing `isoDate`. */
function weekStart(isoDate: string): string {
  const d = new Date(isoDate.slice(0, 10)); // drop time if present
  // getDay(): 0=Sun, 1=Mon … 6=Sat
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // offset to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Deterministic ID: md5 of trackUri + dateRange start + dateRange end */
function makeMomentId(
  trackUri: string,
  start: string,
  end: string
): string {
  return crypto
    .createHash("md5")
    .update(`${trackUri}|${start}|${end}`)
    .digest("hex");
}

/** Build a Spotify web URL from a track URI like "spotify:track:XXXX" */
function spotifyUrlFromUri(uri: string): string {
  const id = uri.split(":")[2] ?? uri;
  return `https://open.spotify.com/track/${id}`;
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // 1. Load & normalise plays ------------------------------------------------
  console.log("Loading raw data...");
  const plays = loadAndNormalize(RAW_DIR);
  console.log(`  ${plays.length.toLocaleString()} plays loaded`);

  // 2. Build per-track weekly buckets ----------------------------------------
  //    weekBuckets[trackKey][weekISO] = count
  //    dayBuckets[trackKey][dayISO]   = count
  //    trackMeta[trackKey]            = { trackName, artist, album, trackUri }

  type TrackMeta = {
    trackName: string;
    artist: string;
    album: string;
    trackUri: string;
  };

  const weekBuckets = new Map<string, Map<string, number>>();
  const dayBuckets = new Map<string, Map<string, number>>();
  const trackMeta = new Map<string, TrackMeta>();

  for (const play of plays) {
    const trackKey = `${play.trackName} \u2014 ${play.artist}`; // em dash
    const dayIso = play.timestamp.slice(0, 10);
    const weekIso = weekStart(dayIso);

    if (!weekBuckets.has(trackKey)) {
      weekBuckets.set(trackKey, new Map());
      dayBuckets.set(trackKey, new Map());
      trackMeta.set(trackKey, {
        trackName: play.trackName,
        artist: play.artist,
        album: play.album,
        trackUri: play.trackUri,
      });
    }

    const wb = weekBuckets.get(trackKey)!;
    wb.set(weekIso, (wb.get(weekIso) ?? 0) + 1);

    const db = dayBuckets.get(trackKey)!;
    db.set(dayIso, (db.get(dayIso) ?? 0) + 1);
  }

  // Collect the sorted global week index (all weeks across all tracks)
  const allWeeksSet = new Set<string>();
  for (const wb of weekBuckets.values()) {
    for (const w of wb.keys()) allWeeksSet.add(w);
  }
  const allWeeks = Array.from(allWeeksSet).sort();
  const weekIndex = new Map<string, number>(allWeeks.map((w, i) => [w, i]));

  console.log(`  ${allWeeks.length.toLocaleString()} weeks`);
  console.log(
    `  Running Kleinberg on ${weekBuckets.size.toLocaleString()} tracks...`
  );

  // 3. Per-track Kleinberg + peak extraction ----------------------------------
  const moments: MusicMoment[] = [];

  const MIN_TOTAL_PLAYS = 10;

  for (const [trackKey, wb] of weekBuckets) {
    // Total play count filter
    let totalPlays = 0;
    for (const c of wb.values()) totalPlays += c;
    if (totalPlays < MIN_TOTAL_PLAYS) continue;

    const meta = trackMeta.get(trackKey)!;

    // Build dense weekly count array aligned to global week index
    const weeklyCounts: number[] = new Array(allWeeks.length).fill(0);
    for (const [weekIso, count] of wb.entries()) {
      const idx = weekIndex.get(weekIso);
      if (idx !== undefined) weeklyCounts[idx] = count;
    }

    // Trim leading/trailing zeros for a tighter Kleinberg window
    let lo = 0;
    let hi = weeklyCounts.length - 1;
    while (lo <= hi && weeklyCounts[lo] === 0) lo++;
    while (hi >= lo && weeklyCounts[hi] === 0) hi--;
    if (lo > hi) continue;

    const trimmedCounts = weeklyCounts.slice(lo, hi + 1);

    // Run Kleinberg
    const { states } = kleinbergBurstDetection(trimmedCounts, {
      s: 2.0,
      gamma: 2.0,
      numStates: 4,
    });

    // Extract burst regions (state >= 1)
    const regions = extractBurstRegions(states, 1);
    if (regions.length === 0) continue;

    // Day buckets for this track
    const db = dayBuckets.get(trackKey)!;

    for (const region of regions) {
      // Map trimmed-array indices back to global week indices
      const globalRegionStart = lo + region.start;
      const globalRegionEnd = lo + region.end;

      // Split into sub-peaks
      // splitIntoPeaks expects the full (trimmed) count array and relative indices
      const peaks = splitIntoPeaks(trimmedCounts, region.start, region.end);

      for (const peak of peaks) {
        // Map peak relative offsets to global week indices
        const peakGlobalStart = globalRegionStart + peak.relStart;
        const peakGlobalEnd = globalRegionStart + peak.relEnd;

        const startWeekIso = allWeeks[peakGlobalStart];
        const endWeekIso = allWeeks[peakGlobalEnd];

        if (!startWeekIso || !endWeekIso) continue;

        // Date range: start of first week → end of last week (Sunday = +6 days)
        const endDate = new Date(endWeekIso);
        endDate.setUTCDate(endDate.getUTCDate() + 6);
        const endIso = endDate.toISOString().slice(0, 10);

        const dateRange = { start: startWeekIso, end: endIso };

        // Find peak day within this date range
        let peakDay = startWeekIso;
        let peakDayPlays = 0;

        for (const [dayIso, count] of db.entries()) {
          if (dayIso >= dateRange.start && dayIso <= dateRange.end) {
            if (count > peakDayPlays) {
              peakDayPlays = count;
              peakDay = dayIso;
            }
          }
        }

        // Intensity: maxState of the burst region (already in region.maxState)
        const intensity = region.maxState;

        // Deterministic ID
        const id = makeMomentId(meta.trackUri, dateRange.start, dateRange.end);

        moments.push({
          id,
          trackName: meta.trackName,
          artist: meta.artist,
          album: meta.album,
          trackUri: meta.trackUri,
          albumArtUrl: "",
          previewUrl: null,
          spotifyUrl: spotifyUrlFromUri(meta.trackUri),
          dateRange,
          playCount: peak.plays,
          weeksCount: peak.weeks,
          intensity,
          maxState: region.maxState,
          peakDay,
          peakDayPlays,
        });
      }
    }
  }

  // 4. Sort: most recent first, then by intensity descending -----------------
  moments.sort((a, b) => {
    const dateDiff = b.dateRange.start.localeCompare(a.dateRange.start);
    if (dateDiff !== 0) return dateDiff;
    return b.intensity - a.intensity;
  });

  // 5. Enrich with Spotify API metadata (album art, preview URLs) ------------
  try {
    const uniqueUris = [...new Set(moments.map((m) => m.trackUri))];
    const trackMeta = await enrichTracks(uniqueUris);

    let enriched = 0;
    for (const moment of moments) {
      const meta = trackMeta.get(moment.trackUri);
      if (meta) {
        moment.albumArtUrl = meta.albumArtUrl;
        moment.previewUrl = meta.previewUrl;
        moment.spotifyUrl = meta.spotifyUrl;
        enriched++;
      }
    }
    console.log(`  Enriched ${enriched} moments with Spotify metadata`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `  Warning: Spotify enrichment skipped — ${message}`
    );
    console.warn("  Moments will be written without album art or preview URLs.");
  }

  // 6. Write output -----------------------------------------------------------
  const outDir = path.dirname(OUT_FILE);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(moments, null, 2), "utf-8");

  // Summary stats
  const state3 = moments.filter((m) => m.maxState >= 3).length;
  const state2 = moments.filter((m) => m.maxState === 2).length;
  const state1 = moments.filter((m) => m.maxState === 1).length;

  console.log(`  ${moments.length.toLocaleString()} moments detected`);
  console.log(`  State 3 (intense): ${state3}`);
  console.log(`  State 2 (burst):   ${state2}`);
  console.log(`  State 1 (elevated): ${state1}`);
  console.log(`Wrote ${moments.length} moments to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
