-- Add soundtrack column to blog_posts
-- Stores an array of Spotify track references as JSONB
-- Example: [{"trackUri":"spotify:track:xxx","trackName":"...","artist":"...","albumArtUrl":"..."}]
ALTER TABLE blog_posts ADD COLUMN soundtrack jsonb DEFAULT NULL;
