/**
 * spotify-api.ts
 *
 * Spotify Web API client for enriching track metadata (album art, preview URLs).
 * Uses client credentials flow — no user auth required.
 *
 * Uses the Search API instead of the Tracks batch endpoint because new Spotify
 * apps in development mode get 403 on /v1/tracks but Search works fine.
 */

import fs from "fs";
import path from "path";
import type { SpotifyTrackMeta } from "../../src/lib/spotify/types";

const CACHE_PATH = path.resolve(__dirname, "../../data/spotify/enrichment-cache.json");

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * Obtains a Bearer token via the Client Credentials OAuth flow.
 * Requires SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET env vars.
 */
export async function getAccessToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET environment variables"
    );
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Spotify token request failed (${response.status}): ${text}`
    );
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

// ---------------------------------------------------------------------------
// Track metadata via Search API
// ---------------------------------------------------------------------------

interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

interface SpotifySearchTrack {
  id: string;
  uri: string;
  name: string;
  preview_url: string | null;
  external_urls: { spotify: string };
  album?: {
    images: SpotifyImage[];
  };
  artists: Array<{ name: string }>;
}

interface SpotifySearchResponse {
  tracks: {
    items: SpotifySearchTrack[];
  };
}

/**
 * Search for a single track by name + artist and return its metadata.
 */
async function searchTrack(
  trackName: string,
  artist: string,
  token: string,
  retries = 2
): Promise<SpotifyTrackMeta | null> {
  const query = encodeURIComponent(`track:${trackName} artist:${artist}`);
  const url = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // Handle rate limiting with retry
  if (response.status === 429 && retries > 0) {
    const rawRetry = response.headers.get('retry-after');
    const retryAfter = Math.min(Math.max(parseInt(rawRetry || '3', 10), 1), 30);
    console.log(`    Rate limited, waiting ${retryAfter}s...`);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return searchTrack(trackName, artist, token, retries - 1);
  }

  if (!response.ok) return null;

  const data = (await response.json()) as SpotifySearchResponse;
  const track = data.tracks?.items?.[0];
  if (!track) return null;

  const albumArtUrl =
    track.album?.images?.[1]?.url ||
    track.album?.images?.[0]?.url ||
    "";

  return {
    trackUri: track.uri,
    albumArtUrl,
    previewUrl: track.preview_url,
    spotifyUrl: track.external_urls.spotify,
    genres: [],
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

interface TrackInfo {
  trackUri: string;
  trackName: string;
  artist: string;
}

/**
 * Enriches tracks with Spotify metadata using the Search API.
 * Searches one track at a time with 50ms delay for rate limiting.
 *
 * @param tracks - Array of { trackUri, trackName, artist }
 * @returns Map of trackUri → SpotifyTrackMeta
 */
function loadCache(): Map<string, SpotifyTrackMeta> {
  try {
    if (fs.existsSync(CACHE_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8")) as Record<string, SpotifyTrackMeta>;
      return new Map(Object.entries(raw));
    }
  } catch { /* ignore corrupt cache */ }
  return new Map();
}

function saveCache(cache: Map<string, SpotifyTrackMeta>): void {
  const obj: Record<string, SpotifyTrackMeta> = {};
  for (const [k, v] of cache) obj[k] = v;
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(obj, null, 2));
}

export async function enrichTracks(
  tracks: TrackInfo[]
): Promise<Map<string, SpotifyTrackMeta>> {
  const cache = loadCache();
  const result = new Map<string, SpotifyTrackMeta>();

  // Separate cached vs uncached
  const uncached: TrackInfo[] = [];
  for (const t of tracks) {
    const cached = cache.get(t.trackUri);
    if (cached) {
      result.set(t.trackUri, cached);
    } else {
      uncached.push(t);
    }
  }

  console.log(`  Enriching: ${result.size} cached, ${uncached.length} to fetch`);

  if (uncached.length === 0) return result;

  const token = await getAccessToken();
  let fetched = 0;
  let failed = 0;

  for (let i = 0; i < uncached.length; i++) {
    const { trackUri, trackName, artist } = uncached[i];

    if (result.has(trackUri)) continue;

    const meta = await searchTrack(trackName, artist, token);
    if (meta) {
      result.set(trackUri, meta);
      cache.set(trackUri, meta);
      fetched++;
    } else {
      failed++;
    }

    if ((i + 1) % 25 === 0) {
      console.log(`    ${i + 1}/${uncached.length} fetched (${fetched} found, ${failed} missed)`);
      // Save cache periodically in case of interruption
      saveCache(cache);
    }

    // Rate limit: 400ms between requests
    if (i < uncached.length - 1) {
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  saveCache(cache);
  console.log(`  Enrichment: ${result.size} total (${fetched} new, ${failed} missed)`);
  return result;
}
