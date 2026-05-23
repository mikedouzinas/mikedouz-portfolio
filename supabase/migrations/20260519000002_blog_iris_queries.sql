-- Per-turn log of reader conversations with blog Iris.
-- One row per user message + assistant response on /the-web/<slug>.
-- Draft modes (draft_comment / draft_message) are also logged; their
-- `answer_text` holds the generated draft.
CREATE TABLE IF NOT EXISTS blog_iris_queries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  slug            TEXT NOT NULL,
  mode            TEXT NOT NULL,      -- 'conversation' | 'draft_comment' | 'draft_message'
  passage         TEXT,
  message         TEXT NOT NULL,      -- user's prompt this turn
  answer_text     TEXT,               -- assistant's response (or draft)
  answer_length   INTEGER,
  turn_index      INTEGER,            -- 0-based; number of prior user turns this session
  latency_ms      INTEGER,

  session_id      TEXT,               -- client-generated per-bubble UUID
  user_agent      TEXT,

  -- Visitor enrichment (same shape as iris_queries)
  referrer        TEXT,
  ip_hash         TEXT,
  org             TEXT,
  city            TEXT,
  region          TEXT,
  country         TEXT,
  timezone        TEXT,
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,
  utm_content     TEXT,
  utm_term        TEXT
);

CREATE INDEX IF NOT EXISTS idx_blog_iris_queries_slug       ON blog_iris_queries(slug);
CREATE INDEX IF NOT EXISTS idx_blog_iris_queries_session_id ON blog_iris_queries(session_id);
CREATE INDEX IF NOT EXISTS idx_blog_iris_queries_created_at ON blog_iris_queries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_iris_queries_ip_hash    ON blog_iris_queries(ip_hash);
