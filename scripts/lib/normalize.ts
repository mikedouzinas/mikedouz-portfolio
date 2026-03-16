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
  const files = fs.readdirSync(rawDir).filter((f) =>
    (f.startsWith("Streaming_History_Audio") || f === "api_recent_plays.json") && f.endsWith(".json")
  );
  const plays: NormalizedPlay[] = [];

  for (const file of files.sort()) {
    const raw: ExtendedHistoryEntry[] = JSON.parse(fs.readFileSync(path.join(rawDir, file), "utf-8"));
    for (const entry of raw) {
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

  plays.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return plays;
}
