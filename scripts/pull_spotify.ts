/**
 * pull_spotify.ts
 *
 * Downloads Spotify plays from Supabase into the local raw JSON file,
 * merging with any existing local data. This bridges the server-side
 * daily capture (Vercel cron) with the local Kleinberg analysis pipeline.
 *
 * Usage:  npx tsx scripts/pull_spotify.ts
 */

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RAW_DIR = path.resolve(__dirname, "../data/spotify/raw");
const OUT_FILE = path.join(RAW_DIR, "api_recent_plays.json");

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

interface SupabasePlay {
  played_at: string;
  ms_played: number;
  track_name: string | null;
  artist_name: string | null;
  album_name: string | null;
  track_uri: string | null;
}

function dedupeKey(entry: ExtendedHistoryEntry): string {
  return `${entry.ts}||${entry.master_metadata_track_name ?? ""}`;
}

async function main(): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Pulling Spotify plays from Supabase...");

  // Fetch all plays (paginated, 1000 at a time)
  let allPlays: SupabasePlay[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("spotify_plays")
      .select("played_at, ms_played, track_name, artist_name, album_name, track_uri")
      .order("played_at", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(`Supabase fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;

    allPlays = allPlays.concat(data);
    offset += pageSize;
    if (data.length < pageSize) break;
  }

  console.log(`Fetched ${allPlays.length} plays from Supabase.`);

  // Convert to ExtendedHistoryEntry format
  const incoming: ExtendedHistoryEntry[] = allPlays.map((p) => ({
    ts: p.played_at,
    ms_played: p.ms_played,
    master_metadata_track_name: p.track_name,
    master_metadata_album_artist_name: p.artist_name,
    master_metadata_album_album_name: p.album_name,
    spotify_track_uri: p.track_uri,
    reason_start: "api_fetch",
    reason_end: "api_fetch",
    skipped: false,
    episode_name: null,
  }));

  // Load existing local data
  let existing: ExtendedHistoryEntry[] = [];
  if (fs.existsSync(OUT_FILE)) {
    existing = JSON.parse(fs.readFileSync(OUT_FILE, "utf-8")) as ExtendedHistoryEntry[];
  }

  // Merge + deduplicate
  const seen = new Set<string>(existing.map(dedupeKey));
  let newCount = 0;

  for (const entry of incoming) {
    const key = dedupeKey(entry);
    if (!seen.has(key)) {
      existing.push(entry);
      seen.add(key);
      newCount++;
    }
  }

  // Sort by timestamp
  existing.sort((a, b) => a.ts.localeCompare(b.ts));

  // Write
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(existing, null, 2), "utf-8");

  console.log(`Added ${newCount} new plays (${existing.length} total in file).`);
  console.log(`Written to: ${OUT_FILE}`);
}

main().catch((err) => {
  console.error("Error:", (err as Error).message);
  process.exit(1);
});
