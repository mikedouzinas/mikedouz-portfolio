ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS has_audio boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS audio_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS recorded_audio_url text;
