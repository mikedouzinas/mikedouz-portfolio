import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET /api/cron/spotify-refresh
 * Fetches recent plays from Spotify API and stores them in Supabase.
 * Triggered daily by Vercel cron (see vercel.json).
 *
 * Spotify's recently-played endpoint returns the last 50 tracks.
 * Running daily ensures no plays are lost (50 tracks covers ~1-2 days
 * of normal listening). Dedup in Supabase handles overlap between runs.
 */
export async function GET(req: NextRequest) {
  // Verify cron auth in production
  const authHeader = req.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return NextResponse.json(
      { error: 'Missing Spotify credentials' },
      { status: 500 }
    );
  }

  try {
    // 1. Exchange refresh token for access token
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error('[SpotifyRefresh] Token exchange failed:', body);
      return NextResponse.json(
        { error: 'Token exchange failed', detail: body },
        { status: 500 }
      );
    }

    const { access_token } = (await tokenRes.json()) as { access_token: string };

    // 2. Fetch recently played (max 50)
    const playsRes = await fetch(
      'https://api.spotify.com/v1/me/player/recently-played?limit=50',
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    if (!playsRes.ok) {
      const body = await playsRes.text();
      console.error('[SpotifyRefresh] Fetch plays failed:', body);
      return NextResponse.json(
        { error: 'Fetch plays failed', detail: body },
        { status: 500 }
      );
    }

    const playsData = (await playsRes.json()) as {
      items: Array<{
        played_at: string;
        track: {
          name: string;
          uri: string;
          duration_ms: number;
          artists: Array<{ name: string }>;
          album: { name: string };
        };
      }>;
    };

    // 3. Upsert into Supabase (dedup handled by unique index)
    const supabase = getSupabaseAdmin();
    const rows = playsData.items.map((item) => ({
      played_at: item.played_at,
      ms_played: item.track.duration_ms,
      track_name: item.track.name,
      artist_name: item.track.artists[0]?.name ?? null,
      album_name: item.track.album?.name ?? null,
      track_uri: item.track.uri,
    }));

    const { error: upsertError } = await supabase
      .from('spotify_plays')
      .upsert(rows, { onConflict: 'played_at,track_uri', ignoreDuplicates: true });

    if (upsertError) {
      console.error('[SpotifyRefresh] Supabase upsert failed:', upsertError);
      return NextResponse.json(
        { error: 'Supabase upsert failed', detail: upsertError.message },
        { status: 500 }
      );
    }

    console.log(`[SpotifyRefresh] Stored ${rows.length} plays (dupes ignored)`);
    return NextResponse.json({ ok: true, playsProcessed: rows.length });
  } catch (err) {
    console.error('[SpotifyRefresh] Error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
