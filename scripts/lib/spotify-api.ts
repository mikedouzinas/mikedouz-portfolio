/**
 * spotify-api.ts
 *
 * Spotify Web API client for enriching track metadata (album art, preview URLs).
 * Uses client credentials flow — no user auth required.
 *
 * Usage:
 *   import { enrichTracks } from "./lib/spotify-api";
 *   const meta = await enrichTracks(trackUris);
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
// Track metadata
// ---------------------------------------------------------------------------

interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

interface SpotifyAlbum {
  images: SpotifyImage[];
}

interface SpotifyApiTrack {
  id: string;
  uri: string;
  preview_url: string | null;
  external_urls: { spotify: string };
  album?: SpotifyAlbum;
}

interface SpotifyTracksResponse {
  tracks: (SpotifyApiTrack | null)[];
}

/**
 * Fetches metadata for up to 50 tracks in a single API call.
 * Returns a Map of trackUri → SpotifyTrackMeta.
 */
export async function fetchTrackBatch(
  trackIds: string[],
  token: string
): Promise<Map<string, SpotifyTrackMeta>> {
  const ids = trackIds.join(",");
  const url = `https://api.spotify.com/v1/tracks?ids=${encodeURIComponent(ids)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Spotify tracks API failed (${response.status}): ${text}`
    );
  }

  const data = (await response.json()) as SpotifyTracksResponse;
  const result = new Map<string, SpotifyTrackMeta>();

  for (const track of data.tracks) {
    if (!track) continue;

    // Prefer 300x300 (index 1), fall back to first image
    const albumArtUrl =
      track.album?.images?.[1]?.url ||
      track.album?.images?.[0]?.url ||
      "";

    result.set(track.uri, {
      trackUri: track.uri,
      albumArtUrl,
      previewUrl: track.preview_url,
      spotifyUrl: track.external_urls.spotify,
      genres: [],
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Enriches a list of track URIs with Spotify metadata.
 * Batches requests in groups of 50 with a 100ms delay between batches.
 *
 * @param trackUris - Array of Spotify track URIs (e.g. "spotify:track:abc123")
 * @returns Map of trackUri → SpotifyTrackMeta
 */
export async function enrichTracks(
  trackUris: string[]
): Promise<Map<string, SpotifyTrackMeta>> {
  const token = await getAccessToken();
  const result = new Map<string, SpotifyTrackMeta>();

  // Extract track IDs from URIs, keeping a URI→ID mapping
  const uriToId = new Map<string, string>();
  for (const uri of trackUris) {
    const parts = uri.split(":");
    const id = parts[2] ?? uri;
    uriToId.set(uri, id);
  }

  const uniqueIds = Array.from(uriToId.values());

  console.log(`  Enriching ${trackUris.length} unique tracks...`);

  // Batch in groups of 50
  const BATCH_SIZE = 50;
  for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
    const batch = uniqueIds.slice(i, i + BATCH_SIZE);
    const batchMeta = await fetchTrackBatch(batch, token);

    for (const [uri, meta] of batchMeta) {
      result.set(uri, meta);
    }

    // Rate-limit delay between batches (skip after the last one)
    if (i + BATCH_SIZE < uniqueIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return result;
}
