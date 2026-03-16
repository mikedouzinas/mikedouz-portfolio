/**
 * spotify-api.ts
 *
 * Spotify Web API client for enriching track metadata (album art, preview URLs).
 * Uses client credentials flow — no user auth required.
 *
 * Uses the Search API instead of the Tracks batch endpoint because new Spotify
 * apps in development mode get 403 on /v1/tracks but Search works fine.
 */

import type { SpotifyTrackMeta } from "../../src/lib/spotify/types";

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
  token: string
): Promise<SpotifyTrackMeta | null> {
  const query = encodeURIComponent(`track:${trackName} artist:${artist}`);
  const url = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

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
export async function enrichTracks(
  tracks: TrackInfo[]
): Promise<Map<string, SpotifyTrackMeta>> {
  const token = await getAccessToken();
  const result = new Map<string, SpotifyTrackMeta>();

  console.log(`  Enriching ${tracks.length} unique tracks via Search API...`);

  let enriched = 0;
  let failed = 0;

  for (let i = 0; i < tracks.length; i++) {
    const { trackUri, trackName, artist } = tracks[i];

    // Skip if already enriched (same URI from a previous search)
    if (result.has(trackUri)) continue;

    const meta = await searchTrack(trackName, artist, token);
    if (meta) {
      // Use the original trackUri as key (not the search result URI, in case of slight mismatches)
      result.set(trackUri, meta);
      enriched++;
    } else {
      failed++;
    }

    // Progress every 50 tracks
    if ((i + 1) % 50 === 0) {
      console.log(`    ${i + 1}/${tracks.length} searched (${enriched} found, ${failed} missed)`);
    }

    // Rate limit: 50ms between requests
    if (i < tracks.length - 1) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  console.log(`  Enrichment complete: ${enriched} found, ${failed} missed out of ${tracks.length}`);
  return result;
}
