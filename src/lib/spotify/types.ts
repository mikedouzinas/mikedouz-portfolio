import { z } from "zod";

// --- Raw data types (from Spotify export) ---

export const NormalizedPlaySchema = z.object({
  trackName: z.string(),
  artist: z.string(),
  album: z.string(),
  trackUri: z.string(),
  timestamp: z.string(),
  msPlayed: z.number(),
  reasonStart: z.string().optional(),
  reasonEnd: z.string().optional(),
  skipped: z.boolean().optional(),
});
export type NormalizedPlay = z.infer<typeof NormalizedPlaySchema>;

export interface BurstRegion {
  trackKey: string;
  startWeekIdx: number;
  endWeekIdx: number;
  maxState: number;
  stateSequence: number[];
}

export interface MusicMoment {
  id: string;
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
  intensity: number;
  maxState: number;
  peakDay: string;
  peakDayPlays: number;
  hotDays: Array<{ date: string; plays: number }>; // top days sorted by plays desc
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
    timeOfDayDistribution: Record<string, number>;
    dormancyDaysBefore?: number;
    monthsActive?: number;
    artistTracksExplored?: number;
  };
}

export interface SpotifyTrackMeta {
  trackUri: string;
  albumArtUrl: string;
  previewUrl: string | null;
  spotifyUrl: string;
  genres: string[];
}
