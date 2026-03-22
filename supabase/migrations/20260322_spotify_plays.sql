-- Spotify play history captured by Vercel cron
-- Stores raw plays from the recently-played API endpoint
-- Deduplicated by (played_at, track_uri) to handle overlapping fetches

CREATE TABLE IF NOT EXISTS spotify_plays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  played_at timestamptz NOT NULL,
  ms_played integer NOT NULL,
  track_name text,
  artist_name text,
  album_name text,
  track_uri text,
  created_at timestamptz DEFAULT now()
);

-- Dedup index: same track at same timestamp = same play
CREATE UNIQUE INDEX idx_spotify_plays_dedup
  ON spotify_plays (played_at, track_uri);

-- For date-range queries when pulling data locally
CREATE INDEX idx_spotify_plays_played_at
  ON spotify_plays (played_at DESC);

-- RLS: off for now (admin-only access via service role key)
ALTER TABLE spotify_plays ENABLE ROW LEVEL SECURITY;
