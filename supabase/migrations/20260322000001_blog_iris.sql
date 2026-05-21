-- Blog Iris interaction system: passage-anchored comments + per-post context
-- 2026-03-22

-- Add passage_ref to blog_comments (optional — for highlight-anchored comments)
ALTER TABLE blog_comments ADD COLUMN IF NOT EXISTS passage_ref TEXT;

-- Add iris_context to blog_posts (optional — author's behind-the-scenes notes for Iris)
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS iris_context TEXT;

-- Update author_name default for anonymous comments
-- Drop and re-add constraint to ensure min 1 char with default 'Anonymous'
ALTER TABLE blog_comments DROP CONSTRAINT IF EXISTS author_name_length;
ALTER TABLE blog_comments ALTER COLUMN author_name SET DEFAULT 'Anonymous';
ALTER TABLE blog_comments ADD CONSTRAINT author_name_length CHECK (char_length(author_name) >= 1);
