/**
 * refresh_spotify.ts
 *
 * Fetches recent plays from the Spotify API and merges them into
 * data/spotify/raw/api_recent_plays.json so that `npm run spotify:analyze`
 * automatically picks them up.
 *
 * Usage:  npx tsx scripts/refresh_spotify.ts
 *
 * Required env vars (loaded from .env.local):
 *   SPOTIFY_CLIENT_ID
 *   SPOTIFY_CLIENT_SECRET
 *   SPOTIFY_REFRESH_TOKEN
 */

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

import fs from "fs";

// ---------------------------------------------------------------------------
// Spotify API response shapes
// ---------------------------------------------------------------------------

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface SpotifyArtist {
  id: string;
  name: string;
  uri: string;
}

interface SpotifyAlbum {
  id: string;
  name: string;
  uri: string;
}

interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
}

interface SpotifyPlayHistoryObject {
  track: SpotifyTrack;
  played_at: string; // ISO 8601 timestamp
  context: unknown;
}

interface SpotifyRecentlyPlayedResponse {
  items: SpotifyPlayHistoryObject[];
  next: string | null;
  cursors: {
    after: string;
    before: string;
  };
  limit: number;
  href: string;
}

// ---------------------------------------------------------------------------
// Extended history format (same shape as Spotify's own export + normalize.ts)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const RAW_DIR = path.resolve(__dirname, "../data/spotify/raw");
const OUT_FILE = path.join(RAW_DIR, "api_recent_plays.json");

// ---------------------------------------------------------------------------
// Auth: exchange refresh token for access token
// ---------------------------------------------------------------------------

async function getAccessToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing required env vars: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN"
    );
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as SpotifyTokenResponse;
  return data.access_token;
}

// ---------------------------------------------------------------------------
// Fetch recently played tracks
// ---------------------------------------------------------------------------

async function fetchRecentPlays(
  accessToken: string
): Promise<SpotifyPlayHistoryObject[]> {
  const res = await fetch(
    "https://api.spotify.com/v1/me/player/recently-played?limit=50",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Recently-played fetch failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as SpotifyRecentlyPlayedResponse;
  return data.items;
}

// ---------------------------------------------------------------------------
// Convert API items → ExtendedHistoryEntry format
// ---------------------------------------------------------------------------

function toExtendedHistory(
  items: SpotifyPlayHistoryObject[]
): ExtendedHistoryEntry[] {
  return items.map((item) => ({
    ts: item.played_at,
    ms_played: item.track.duration_ms,
    master_metadata_track_name: item.track.name,
    master_metadata_album_artist_name: item.track.artists[0]?.name ?? null,
    master_metadata_album_album_name: item.track.album?.name ?? null,
    spotify_track_uri: item.track.uri,
    reason_start: "api_fetch",
    reason_end: "api_fetch",
    skipped: false,
    episode_name: null,
  }));
}

// ---------------------------------------------------------------------------
// Deduplicate key: timestamp + track name
// ---------------------------------------------------------------------------

function dedupeKey(entry: ExtendedHistoryEntry): string {
  return `${entry.ts}||${entry.master_metadata_track_name ?? ""}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("Refreshing Spotify recent plays…");

  // 1. Auth
  const accessToken = await getAccessToken();

  // 2. Fetch
  const items = await fetchRecentPlays(accessToken);
  console.log(`Fetched ${items.length} plays from Spotify API.`);

  // 3. Convert
  const incoming = toExtendedHistory(items);

  // 4. Load existing data
  let existing: ExtendedHistoryEntry[] = [];
  if (fs.existsSync(OUT_FILE)) {
    existing = JSON.parse(fs.readFileSync(OUT_FILE, "utf-8")) as ExtendedHistoryEntry[];
  }

  // 5. Merge + deduplicate
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

  // 6. Sort by timestamp ascending
  existing.sort((a, b) => a.ts.localeCompare(b.ts));

  // 7. Ensure output directory exists and write
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(existing, null, 2), "utf-8");

  console.log(`Added ${newCount} new plays (${existing.length} total in file).`);
  console.log(`Written to: ${OUT_FILE}`);
}

main().catch((err) => {
  console.error("Error:", (err as Error).message);
  process.exit(1);
});
