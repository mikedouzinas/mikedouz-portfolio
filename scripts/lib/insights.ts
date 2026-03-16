/**
 * insights.ts
 *
 * Computes admin-only secondary insights for each music moment.
 * Each MusicInsight extends MusicMoment with insightTypes[] and context fields.
 */

import type {
  NormalizedPlay,
  MusicMoment,
  MusicInsight,
  InsightType,
} from "../../src/lib/spotify/types";

/**
 * computeInsights
 *
 * For each moment, determines which insight types apply and computes
 * contextual metadata for admin use.
 *
 * Insight types implemented:
 * - burst          — always tagged (every moment is a burst)
 * - comeback       — song has 2+ distinct moments (grouped by trackName — artist)
 * - loyalty        — track has 50+ total plays across 4+ distinct months
 * - late_night     — 50%+ of track's plays occur between midnight–4am (hour 0-3), min 10 plays
 * - session_anchor — 30%+ of track's plays have reasonStart === "playbtn", min 10 plays
 * - one_and_done   — after moment's end date, no more plays OR next play is 60+ days later
 *
 * Note: artist_dive and seasonal are in the InsightType union but NOT implemented here.
 */
export function computeInsights(
  moments: MusicMoment[],
  plays: NormalizedPlay[]
): MusicInsight[] {
  // ---------------------------------------------------------------------------
  // Pre-compute per-track play lists (keyed by "trackName — artist")
  // ---------------------------------------------------------------------------

  /** All plays for a given trackKey, sorted ascending by timestamp */
  const playsByTrack = new Map<string, NormalizedPlay[]>();

  for (const play of plays) {
    const trackKey = `${play.trackName} \u2014 ${play.artist}`;
    if (!playsByTrack.has(trackKey)) {
      playsByTrack.set(trackKey, []);
    }
    playsByTrack.get(trackKey)!.push(play);
  }

  // Sort each track's plays by timestamp ascending
  for (const trackPlays of playsByTrack.values()) {
    trackPlays.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  // ---------------------------------------------------------------------------
  // Pre-compute how many moments each trackKey has (for comeback detection)
  // ---------------------------------------------------------------------------

  const momentCountByTrack = new Map<string, number>();
  for (const moment of moments) {
    const trackKey = `${moment.trackName} \u2014 ${moment.artist}`;
    momentCountByTrack.set(trackKey, (momentCountByTrack.get(trackKey) ?? 0) + 1);
  }

  // ---------------------------------------------------------------------------
  // Process each moment
  // ---------------------------------------------------------------------------

  const insights: MusicInsight[] = [];

  for (const moment of moments) {
    const trackKey = `${moment.trackName} \u2014 ${moment.artist}`;
    const trackPlays = playsByTrack.get(trackKey) ?? [];
    const totalTrackPlays = trackPlays.length;

    // ---- context: totalPlaysInWindow & uniqueTracksInWindow ------------------

    const windowStart = moment.dateRange.start;
    const windowEnd = moment.dateRange.end;

    let totalPlaysInWindow = 0;
    const uniqueTracksInWindowSet = new Set<string>();

    for (const play of plays) {
      const dayIso = play.timestamp.slice(0, 10);
      if (dayIso >= windowStart && dayIso <= windowEnd) {
        totalPlaysInWindow++;
        uniqueTracksInWindowSet.add(`${play.trackName} \u2014 ${play.artist}`);
      }
    }

    const uniqueTracksInWindow = uniqueTracksInWindowSet.size;

    // ---- context: timeOfDayDistribution (hour buckets for this track) --------

    const timeOfDayDistribution: Record<string, number> = {};
    for (let h = 0; h < 24; h++) {
      timeOfDayDistribution[String(h)] = 0;
    }
    for (const play of trackPlays) {
      const hour = new Date(play.timestamp).getUTCHours();
      timeOfDayDistribution[String(hour)]++;
    }

    // ---- context: monthsActive (distinct YYYY-MM months with plays) ----------

    const monthsSet = new Set<string>();
    for (const play of trackPlays) {
      monthsSet.add(play.timestamp.slice(0, 7)); // "YYYY-MM"
    }
    const monthsActive = monthsSet.size;

    // ---- Insight: burst (always) ---------------------------------------------

    const insightTypes: InsightType[] = ["burst"];

    // ---- Insight: comeback ---------------------------------------------------
    // Song has 2+ distinct moments

    const momentCount = momentCountByTrack.get(trackKey) ?? 0;
    if (momentCount >= 2) {
      insightTypes.push("comeback");
    }

    // ---- Insight: loyalty ----------------------------------------------------
    // 50+ total plays AND 4+ distinct months

    if (totalTrackPlays >= 50 && monthsActive >= 4) {
      insightTypes.push("loyalty");
    }

    // ---- Insight: late_night -------------------------------------------------
    // 50%+ of track's plays occur between midnight–4am (hours 0-3), min 10 total plays

    if (totalTrackPlays >= 10) {
      let lateNightPlays = 0;
      for (const play of trackPlays) {
        const hour = new Date(play.timestamp).getUTCHours();
        if (hour >= 0 && hour <= 3) {
          lateNightPlays++;
        }
      }
      if (lateNightPlays / totalTrackPlays >= 0.5) {
        insightTypes.push("late_night");
      }
    }

    // ---- Insight: session_anchor ---------------------------------------------
    // 30%+ of track's plays have reasonStart === "playbtn", min 10 total plays

    if (totalTrackPlays >= 10) {
      let playbtnCount = 0;
      for (const play of trackPlays) {
        if (play.reasonStart === "playbtn") {
          playbtnCount++;
        }
      }
      if (playbtnCount / totalTrackPlays >= 0.3) {
        insightTypes.push("session_anchor");
      }
    }

    // ---- Insight: one_and_done -----------------------------------------------
    // After this moment's end date, either no more plays OR next play is 60+ days later

    const playsAfterWindow = trackPlays.filter(
      (p) => p.timestamp.slice(0, 10) > windowEnd
    );

    if (playsAfterWindow.length === 0) {
      insightTypes.push("one_and_done");
    } else {
      const nextPlayDate = new Date(playsAfterWindow[0].timestamp.slice(0, 10));
      const windowEndDate = new Date(windowEnd);
      const daysDiff =
        (nextPlayDate.getTime() - windowEndDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff >= 60) {
        insightTypes.push("one_and_done");
      }
    }

    // ---- Assemble MusicInsight -----------------------------------------------

    insights.push({
      ...moment,
      insightTypes,
      context: {
        totalPlaysInWindow,
        uniqueTracksInWindow,
        timeOfDayDistribution,
        monthsActive,
      },
    });
  }

  return insights;
}
