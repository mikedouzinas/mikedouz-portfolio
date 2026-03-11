-- Blog comments table
CREATE TABLE IF NOT EXISTS blog_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES blog_comments(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT,           -- optional, never displayed publicly
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_admin BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,  -- soft delete for moderation (preserves thread structure)
  ip_hash TEXT,                -- hashed IP for rate limiting, never stored raw

  -- Constraints
  CONSTRAINT body_min_length CHECK (char_length(body) >= 10),
  CONSTRAINT body_max_length CHECK (char_length(body) <= 5000),
  CONSTRAINT author_name_length CHECK (char_length(author_name) >= 1 AND char_length(author_name) <= 100)
  -- Note: single-level nesting is enforced in the API layer, not via CHECK constraint.
  -- Postgres CHECK constraints that reference other rows are unreliable under concurrent writes.
);

-- Indexes
CREATE INDEX idx_blog_comments_post_id ON blog_comments(post_id);
CREATE INDEX idx_blog_comments_parent_id ON blog_comments(parent_id);
CREATE INDEX idx_blog_comments_created_at ON blog_comments(created_at DESC);
CREATE INDEX idx_blog_comments_ip_hash ON blog_comments(ip_hash);

-- Add comment_count to blog_posts for efficient display
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;

-- Function to update comment_count on blog_posts
CREATE OR REPLACE FUNCTION update_blog_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE blog_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.is_deleted = FALSE AND NEW.is_deleted = TRUE THEN
    UPDATE blog_posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = NEW.post_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.is_deleted = TRUE AND NEW.is_deleted = FALSE THEN
    UPDATE blog_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_blog_comment_count
  AFTER INSERT OR UPDATE OF is_deleted ON blog_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_blog_post_comment_count();
