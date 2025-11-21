-- Enhanced Analytics Migration
-- Adds visitor tracking, geo data, device info, and conversation threading

-- Add new columns to iris_queries table
ALTER TABLE iris_queries
ADD COLUMN IF NOT EXISTS visitor_id TEXT,
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS region TEXT,
ADD COLUMN IF NOT EXISTS referrer TEXT,
ADD COLUMN IF NOT EXISTS device_type TEXT,
ADD COLUMN IF NOT EXISTS screen_size TEXT,
ADD COLUMN IF NOT EXISTS parent_query_id UUID REFERENCES iris_queries(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS conversation_depth INTEGER DEFAULT 0;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_iris_queries_visitor_id ON iris_queries(visitor_id);
CREATE INDEX IF NOT EXISTS idx_iris_queries_country ON iris_queries(country);
CREATE INDEX IF NOT EXISTS idx_iris_queries_device_type ON iris_queries(device_type);
CREATE INDEX IF NOT EXISTS idx_iris_queries_parent_query_id ON iris_queries(parent_query_id);

-- View: Geographic distribution
CREATE OR REPLACE VIEW iris_geographic_stats AS
SELECT
  country,
  COUNT(*) as query_count,
  COUNT(DISTINCT visitor_id) as unique_visitors,
  ROUND(AVG(latency_ms)::numeric, 2) as avg_latency_ms,
  COUNT(CASE WHEN cached THEN 1 END)::float / NULLIF(COUNT(*), 0)::float as cache_hit_rate
FROM iris_queries
WHERE country IS NOT NULL
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY country
ORDER BY query_count DESC;

-- View: Device type distribution
CREATE OR REPLACE VIEW iris_device_stats AS
SELECT
  device_type,
  COUNT(*) as query_count,
  ROUND(AVG(latency_ms)::numeric, 2) as avg_latency_ms,
  COUNT(DISTINCT visitor_id) as unique_visitors
FROM iris_queries
WHERE device_type IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY device_type
ORDER BY query_count DESC;

-- View: Conversation threads (top-level queries with their follow-ups)
CREATE OR REPLACE VIEW iris_conversations AS
SELECT
  parent.id as conversation_id,
  parent.query as initial_query,
  parent.created_at as started_at,
  parent.visitor_id,
  COUNT(child.id) as follow_up_count,
  MAX(child.created_at) as last_interaction,
  ARRAY_AGG(child.query ORDER BY child.created_at) FILTER (WHERE child.id IS NOT NULL) as follow_up_queries
FROM iris_queries parent
LEFT JOIN iris_queries child ON child.parent_query_id = parent.id
WHERE parent.parent_query_id IS NULL
  AND parent.created_at > NOW() - INTERVAL '7 days'
GROUP BY parent.id, parent.query, parent.created_at, parent.visitor_id
ORDER BY parent.created_at DESC;

-- View: Visitor activity summary
CREATE OR REPLACE VIEW iris_visitor_summary AS
SELECT
  visitor_id,
  COUNT(*) as total_queries,
  MIN(created_at) as first_seen,
  MAX(created_at) as last_seen,
  COUNT(DISTINCT DATE(created_at)) as active_days,
  ARRAY_AGG(DISTINCT intent) as intents_used,
  ARRAY_AGG(DISTINCT country) FILTER (WHERE country IS NOT NULL) as countries,
  COUNT(CASE WHEN parent_query_id IS NULL THEN 1 END) as conversations_started
FROM iris_queries
WHERE visitor_id IS NOT NULL
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY visitor_id
ORDER BY total_queries DESC;

-- View: Enhanced daily stats (with visitor and geo data)
CREATE OR REPLACE VIEW iris_daily_stats_enhanced AS
SELECT
  created_at_date as date,
  COUNT(*) as total_queries,
  COUNT(DISTINCT visitor_id) as unique_visitors,
  COUNT(CASE WHEN cached THEN 1 END) as cached_queries,
  ROUND(AVG(latency_ms)::numeric, 2) as avg_latency_ms,
  ROUND(AVG(answer_length)::numeric, 2) as avg_answer_length,
  COUNT(DISTINCT intent) as unique_intents,
  COUNT(CASE WHEN results_count = 0 THEN 1 END) as failed_queries,
  COUNT(DISTINCT country) as countries_count,
  COUNT(CASE WHEN parent_query_id IS NULL THEN 1 END) as conversations_started,
  COUNT(CASE WHEN parent_query_id IS NOT NULL THEN 1 END) as follow_up_queries
FROM iris_queries
GROUP BY created_at_date
ORDER BY date DESC;

-- Function: Get conversation thread (all queries in a conversation)
CREATE OR REPLACE FUNCTION get_conversation_thread(root_query_id UUID)
RETURNS TABLE (
  id UUID,
  query TEXT,
  intent TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  answer_length INTEGER,
  results_count INTEGER,
  conversation_depth INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE conversation_tree AS (
    -- Base case: start with the root query
    SELECT
      q.id,
      q.query,
      q.intent,
      q.created_at,
      q.answer_length,
      q.results_count,
      q.conversation_depth,
      q.parent_query_id
    FROM iris_queries q
    WHERE q.id = root_query_id

    UNION ALL

    -- Recursive case: get all children
    SELECT
      q.id,
      q.query,
      q.intent,
      q.created_at,
      q.answer_length,
      q.results_count,
      q.conversation_depth,
      q.parent_query_id
    FROM iris_queries q
    INNER JOIN conversation_tree ct ON q.parent_query_id = ct.id
  )
  SELECT
    ct.id,
    ct.query,
    ct.intent,
    ct.created_at,
    ct.answer_length,
    ct.results_count,
    ct.conversation_depth
  FROM conversation_tree ct
  ORDER BY ct.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON COLUMN iris_queries.visitor_id IS 'Vercel Analytics visitor ID for cross-platform tracking';
COMMENT ON COLUMN iris_queries.country IS 'Country code from Vercel geo headers (e.g., US, CA, GB)';
COMMENT ON COLUMN iris_queries.city IS 'City name from Vercel geo headers';
COMMENT ON COLUMN iris_queries.region IS 'Region/state from Vercel geo headers';
COMMENT ON COLUMN iris_queries.device_type IS 'Device type: mobile, tablet, or desktop';
COMMENT ON COLUMN iris_queries.screen_size IS 'Screen dimensions (e.g., 1920x1080)';
COMMENT ON COLUMN iris_queries.parent_query_id IS 'Reference to parent query for conversation threading';
COMMENT ON COLUMN iris_queries.conversation_depth IS 'Depth in conversation tree (0 = root)';

-- End of migration
