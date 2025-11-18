-- Iris Analytics Schema for Supabase
-- Run this in your Supabase SQL Editor to set up query tracking

-- Table to track all Iris queries
CREATE TABLE IF NOT EXISTS iris_queries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Query details
  query TEXT NOT NULL,
  intent TEXT,
  filters JSONB,

  -- Results
  results_count INTEGER,
  context_items JSONB,
  answer_length INTEGER,

  -- Performance
  latency_ms INTEGER,
  cached BOOLEAN DEFAULT FALSE,

  -- Session tracking
  session_id TEXT,
  user_agent TEXT,

  -- User feedback (future)
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,

  -- Computed column for date-based queries
  created_at_date DATE GENERATED ALWAYS AS (created_at::date) STORED
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_iris_queries_created_at ON iris_queries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_iris_queries_date ON iris_queries(created_at_date);
CREATE INDEX IF NOT EXISTS idx_iris_queries_intent ON iris_queries(intent);
CREATE INDEX IF NOT EXISTS idx_iris_queries_session ON iris_queries(session_id);
CREATE INDEX IF NOT EXISTS idx_iris_queries_cached ON iris_queries(cached);

-- Table for quick action tracking
CREATE TABLE IF NOT EXISTS iris_quick_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  query_id UUID REFERENCES iris_queries(id) ON DELETE CASCADE,
  suggestion TEXT NOT NULL,
  clicked BOOLEAN DEFAULT FALSE,
  clicked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_iris_quick_actions_query_id ON iris_quick_actions(query_id);
CREATE INDEX IF NOT EXISTS idx_iris_quick_actions_clicked ON iris_quick_actions(clicked);

-- Optional: Enable Row Level Security (RLS) for public access control
-- ALTER TABLE iris_queries ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE iris_quick_actions ENABLE ROW LEVEL SECURITY;

-- Optional: Create a policy to allow only authenticated service role to write
-- CREATE POLICY "Service role can insert queries" ON iris_queries
--   FOR INSERT TO service_role
--   USING (true);

-- Useful analytics views

-- View: Daily query stats
CREATE OR REPLACE VIEW iris_daily_stats AS
SELECT
  created_at_date as date,
  COUNT(*) as total_queries,
  COUNT(CASE WHEN cached THEN 1 END) as cached_queries,
  ROUND(AVG(latency_ms)::numeric, 2) as avg_latency_ms,
  ROUND(AVG(answer_length)::numeric, 2) as avg_answer_length,
  COUNT(DISTINCT intent) as unique_intents,
  COUNT(CASE WHEN results_count = 0 THEN 1 END) as failed_queries
FROM iris_queries
GROUP BY created_at_date
ORDER BY date DESC;

-- View: Intent distribution (last 7 days)
CREATE OR REPLACE VIEW iris_intent_distribution AS
SELECT
  intent,
  COUNT(*) as count,
  ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER () * 100, 2) as percentage
FROM iris_queries
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY intent
ORDER BY count DESC;

-- View: Most common queries (last 30 days)
CREATE OR REPLACE VIEW iris_common_queries AS
SELECT
  query,
  COUNT(*) as count,
  MAX(created_at) as last_asked
FROM iris_queries
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY query
ORDER BY count DESC
LIMIT 50;

-- View: Failing queries (no results, last 7 days)
CREATE OR REPLACE VIEW iris_failing_queries AS
SELECT
  query,
  intent,
  COUNT(*) as count,
  MAX(created_at) as last_occurred
FROM iris_queries
WHERE results_count = 0
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY query, intent
ORDER BY count DESC
LIMIT 25;

-- View: Performance metrics (last 7 days)
CREATE OR REPLACE VIEW iris_performance AS
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as queries,
  ROUND(AVG(latency_ms)::numeric, 2) as avg_latency,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms)::numeric, 2) as p50_latency,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::numeric, 2) as p95_latency,
  ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms)::numeric, 2) as p99_latency,
  COUNT(CASE WHEN cached THEN 1 END)::float / COUNT(*)::float as cache_hit_rate
FROM iris_queries
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

-- Comments for documentation
COMMENT ON TABLE iris_queries IS 'Tracks all Iris portfolio assistant queries for analytics and improvement';
COMMENT ON COLUMN iris_queries.query IS 'The raw user query text';
COMMENT ON COLUMN iris_queries.intent IS 'Detected intent (contact, filter_query, specific_item, etc.)';
COMMENT ON COLUMN iris_queries.filters IS 'Applied filters as JSON (skills, types, years, etc.)';
COMMENT ON COLUMN iris_queries.results_count IS 'Number of KB items retrieved';
COMMENT ON COLUMN iris_queries.context_items IS 'Array of retrieved items with type/title/score';
COMMENT ON COLUMN iris_queries.latency_ms IS 'Total query processing time in milliseconds';
COMMENT ON COLUMN iris_queries.cached IS 'Whether answer was served from cache';
COMMENT ON COLUMN iris_queries.session_id IS 'User session identifier for tracking conversations';
COMMENT ON COLUMN iris_queries.rating IS 'User feedback rating (1-5 stars)';
