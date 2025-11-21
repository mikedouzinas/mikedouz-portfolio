-- Iris Analytics Enhancements Migration
-- Adds advanced tracking for failure patterns, KB gaps, and query analysis
-- Created: 2025-11-21

-- ============================================================================
-- 1. ENHANCE EXISTING iris_queries TABLE
-- ============================================================================

-- Add query complexity metrics
ALTER TABLE iris_queries ADD COLUMN IF NOT EXISTS complexity JSONB;

-- Add retrieval quality metrics
ALTER TABLE iris_queries ADD COLUMN IF NOT EXISTS retrieval_quality JSONB;

-- Add success indicator (derived from multiple signals)
ALTER TABLE iris_queries ADD COLUMN IF NOT EXISTS success_score DECIMAL;

-- Comments for new columns
COMMENT ON COLUMN iris_queries.complexity IS 'Query complexity metrics: word_count, filter_count, has_negation, has_conjunction, etc.';
COMMENT ON COLUMN iris_queries.retrieval_quality IS 'Retrieval quality metrics: max_score, top_5_avg, score_gap, total_candidates';
COMMENT ON COLUMN iris_queries.success_score IS 'Calculated success score (0.0-1.0) based on results, ratings, and user behavior';

-- Create index for success queries
CREATE INDEX IF NOT EXISTS idx_iris_queries_success ON iris_queries(success_score DESC NULLS LAST);

-- ============================================================================
-- 2. FAILURE METADATA TABLE
-- ============================================================================

-- Detailed failure classification and analysis
CREATE TABLE IF NOT EXISTS iris_failure_metadata (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query_id UUID REFERENCES iris_queries(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Failure classification
  failure_type VARCHAR(50),
  -- Types: 'no_results', 'low_confidence', 'wrong_intent',
  --        'filter_conflict', 'too_vague', 'time_sensitive', 'ambiguous'

  -- Query complexity (denormalized for easier querying)
  word_count INTEGER,
  filter_count INTEGER,
  has_negation BOOLEAN,
  has_multiple_intents BOOLEAN,
  char_length INTEGER,

  -- Retrieval quality
  max_score DECIMAL,
  score_gap DECIMAL,  -- difference between top 2 results
  total_candidates INTEGER,
  top_5_avg_score DECIMAL,

  -- KB gap detection
  extracted_topics TEXT[],  -- Topics mentioned but not found in KB
  missing_kb_types TEXT[],  -- What types of content would have helped

  -- Additional metadata
  metadata JSONB  -- Flexible field for future extensions
);

CREATE INDEX IF NOT EXISTS idx_iris_failure_query_id ON iris_failure_metadata(query_id);
CREATE INDEX IF NOT EXISTS idx_iris_failure_type ON iris_failure_metadata(failure_type);
CREATE INDEX IF NOT EXISTS idx_iris_failure_created_at ON iris_failure_metadata(created_at DESC);

COMMENT ON TABLE iris_failure_metadata IS 'Detailed analysis of failed queries to understand and improve answer quality';
COMMENT ON COLUMN iris_failure_metadata.failure_type IS 'Classification of why the query failed';
COMMENT ON COLUMN iris_failure_metadata.extracted_topics IS 'Topics/keywords user asked about but KB lacks';

-- ============================================================================
-- 3. KB GAPS TABLE
-- ============================================================================

-- Track what content is missing from the knowledge base
CREATE TABLE IF NOT EXISTS iris_kb_gaps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  topic VARCHAR(200) NOT NULL,
  suggested_kb_type VARCHAR(50),  -- 'project', 'experience', 'skill', 'blog', etc

  -- Aggregated data
  query_count INTEGER DEFAULT 1,
  first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Example queries that wanted this topic
  example_queries TEXT[],

  -- Priority scoring (frequency + recency)
  priority_score INTEGER,

  -- Status tracking
  status VARCHAR(20) DEFAULT 'new',  -- 'new', 'acknowledged', 'planned', 'added', 'dismissed'
  notes TEXT,

  UNIQUE(topic, suggested_kb_type)
);

CREATE INDEX IF NOT EXISTS idx_iris_kb_gaps_priority ON iris_kb_gaps(priority_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_iris_kb_gaps_status ON iris_kb_gaps(status);
CREATE INDEX IF NOT EXISTS idx_iris_kb_gaps_last_seen ON iris_kb_gaps(last_seen DESC);

COMMENT ON TABLE iris_kb_gaps IS 'Tracks missing knowledge base content based on user queries';
COMMENT ON COLUMN iris_kb_gaps.priority_score IS 'Calculated priority: frequency * recency_factor';

-- ============================================================================
-- 4. SESSION FLOWS TABLE
-- ============================================================================

-- Track user journey through multiple queries in a session
CREATE TABLE IF NOT EXISTS iris_session_flows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Query sequence tracking
  query_ids UUID[],  -- Array of query IDs in order
  intent_sequence TEXT[],  -- ['general', 'filter_query', 'contact']
  success_sequence BOOLEAN[],  -- [false, false, true]

  -- Summary metrics
  total_queries INTEGER DEFAULT 0,
  failures_before_success INTEGER,
  ended_in_contact BOOLEAN DEFAULT FALSE,
  ended_in_failure BOOLEAN DEFAULT FALSE,
  session_duration_ms INTEGER,

  -- User context
  user_agent TEXT,
  first_query TEXT,
  last_query TEXT
);

CREATE INDEX IF NOT EXISTS idx_iris_session_flows_session_id ON iris_session_flows(session_id);
CREATE INDEX IF NOT EXISTS idx_iris_session_flows_created_at ON iris_session_flows(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_iris_session_flows_ended_in_contact ON iris_session_flows(ended_in_contact);

COMMENT ON TABLE iris_session_flows IS 'Tracks user journeys across multiple queries within a session';

-- ============================================================================
-- 5. QUERY REFORMULATIONS TABLE
-- ============================================================================

-- Track how users modify queries after failures
CREATE TABLE IF NOT EXISTS iris_reformulations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  original_query_id UUID REFERENCES iris_queries(id) ON DELETE CASCADE,
  reformulated_query_id UUID REFERENCES iris_queries(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Change analysis
  similarity_score DECIMAL,  -- 0.0 to 1.0 (Levenshtein-based)
  words_added TEXT[],
  words_removed TEXT[],
  intent_changed BOOLEAN,
  filters_changed JSONB,  -- {added: [], removed: []}
  time_between_ms INTEGER,

  -- Outcome comparison
  original_success BOOLEAN,
  reformulation_success BOOLEAN,
  improvement BOOLEAN  -- Did reformulation help?
);

CREATE INDEX IF NOT EXISTS idx_iris_reformulations_session ON iris_reformulations(session_id);
CREATE INDEX IF NOT EXISTS idx_iris_reformulations_original ON iris_reformulations(original_query_id);
CREATE INDEX IF NOT EXISTS idx_iris_reformulations_created_at ON iris_reformulations(created_at DESC);

COMMENT ON TABLE iris_reformulations IS 'Tracks how users rephrase queries to learn what improves success';

-- ============================================================================
-- 6. ENHANCED ANALYTICS VIEWS
-- ============================================================================

-- View: Top KB gaps by priority
CREATE OR REPLACE VIEW iris_top_kb_gaps AS
SELECT
  topic,
  suggested_kb_type,
  query_count,
  example_queries[1:3] as example_queries_sample,
  last_seen,
  status,
  -- Priority: recent queries weighted higher (decay factor of 7 days)
  ROUND(query_count * (1 + EXTRACT(EPOCH FROM (NOW() - last_seen)) / 604800)::numeric, 2) as calculated_priority,
  priority_score
FROM iris_kb_gaps
WHERE status NOT IN ('dismissed', 'added')
  AND query_count >= 2  -- Filter noise (at least 2 queries)
ORDER BY COALESCE(priority_score, 0) DESC, query_count DESC
LIMIT 50;

COMMENT ON VIEW iris_top_kb_gaps IS 'Top 50 missing content opportunities ranked by priority';

-- View: Failure patterns by intent and type
CREATE OR REPLACE VIEW iris_failure_patterns AS
SELECT
  q.intent,
  f.failure_type,
  COUNT(*) as occurrences,
  ROUND(AVG(f.max_score)::numeric, 3) as avg_max_score,
  ROUND(AVG(f.word_count)::numeric, 1) as avg_word_count,
  ROUND(AVG(f.filter_count)::numeric, 1) as avg_filter_count,
  COUNT(CASE WHEN f.has_negation THEN 1 END) as negation_count,
  ARRAY_AGG(q.query ORDER BY q.created_at DESC LIMIT 10) as example_queries
FROM iris_queries q
JOIN iris_failure_metadata f ON q.id = f.query_id
WHERE q.created_at > NOW() - INTERVAL '30 days'
GROUP BY q.intent, f.failure_type
HAVING COUNT(*) >= 3  -- Only show patterns with 3+ occurrences
ORDER BY occurrences DESC;

COMMENT ON VIEW iris_failure_patterns IS 'Common failure patterns grouped by intent and failure type';

-- View: Session journey analysis
CREATE OR REPLACE VIEW iris_journey_analysis AS
SELECT
  intent_sequence,
  COUNT(*) as journey_count,
  ROUND(AVG(total_queries)::numeric, 1) as avg_queries_per_session,
  ROUND(AVG(CASE WHEN ended_in_failure THEN 0 ELSE 1 END)::numeric, 3) as success_rate,
  ROUND(AVG(failures_before_success)::numeric, 1) as avg_failures_before_success,
  COUNT(CASE WHEN ended_in_contact THEN 1 END) as contact_count,
  ROUND(AVG(session_duration_ms / 1000.0)::numeric, 1) as avg_duration_seconds
FROM iris_session_flows
WHERE created_at > NOW() - INTERVAL '7 days'
  AND total_queries > 0
GROUP BY intent_sequence
HAVING COUNT(*) >= 3  -- Only show journeys with 3+ occurrences
ORDER BY journey_count DESC
LIMIT 30;

COMMENT ON VIEW iris_journey_analysis IS 'Common user journeys and their success rates';

-- View: Reformulation success patterns
CREATE OR REPLACE VIEW iris_reformulation_success AS
SELECT
  CASE
    WHEN words_added IS NOT NULL AND array_length(words_added, 1) > 0 THEN 'added_words'
    WHEN words_removed IS NOT NULL AND array_length(words_removed, 1) > 0 THEN 'removed_words'
    WHEN intent_changed THEN 'changed_intent'
    ELSE 'minor_changes'
  END as change_type,
  COUNT(*) as total_reformulations,
  COUNT(CASE WHEN improvement THEN 1 END) as successful_improvements,
  ROUND(COUNT(CASE WHEN improvement THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as success_rate,
  ROUND(AVG(time_between_ms / 1000.0)::numeric, 1) as avg_time_between_seconds,
  ROUND(AVG(similarity_score)::numeric, 3) as avg_similarity
FROM iris_reformulations
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY change_type
ORDER BY total_reformulations DESC;

COMMENT ON VIEW iris_reformulation_success IS 'Which types of query reformulations lead to better results';

-- View: Query complexity vs success
CREATE OR REPLACE VIEW iris_complexity_success AS
SELECT
  CASE
    WHEN (complexity->>'word_count')::int <= 5 THEN '1-5 words'
    WHEN (complexity->>'word_count')::int <= 10 THEN '6-10 words'
    WHEN (complexity->>'word_count')::int <= 20 THEN '11-20 words'
    ELSE '20+ words'
  END as word_count_range,
  CASE
    WHEN (complexity->>'filter_count')::int = 0 THEN '0 filters'
    WHEN (complexity->>'filter_count')::int = 1 THEN '1 filter'
    WHEN (complexity->>'filter_count')::int = 2 THEN '2 filters'
    ELSE '3+ filters'
  END as filter_count_range,
  (complexity->>'has_negation')::boolean as has_negation,
  COUNT(*) as query_count,
  ROUND(AVG(CASE WHEN results_count > 0 THEN 1 ELSE 0 END)::numeric, 3) as success_rate,
  ROUND(AVG(results_count)::numeric, 1) as avg_results,
  ROUND(AVG(latency_ms)::numeric, 0) as avg_latency_ms
FROM iris_queries
WHERE complexity IS NOT NULL
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY word_count_range, filter_count_range, has_negation
ORDER BY query_count DESC;

COMMENT ON VIEW iris_complexity_success IS 'Query success rates broken down by complexity factors';

-- View: Retrieval quality distribution
CREATE OR REPLACE VIEW iris_retrieval_quality_stats AS
SELECT
  q.intent,
  COUNT(*) as total_queries,
  ROUND(AVG((retrieval_quality->>'max_score')::decimal)::numeric, 3) as avg_max_score,
  ROUND(AVG((retrieval_quality->>'top_5_avg')::decimal)::numeric, 3) as avg_top_5_score,
  ROUND(AVG((retrieval_quality->>'score_gap')::decimal)::numeric, 3) as avg_score_gap,
  ROUND(AVG((retrieval_quality->>'total_candidates')::int)::numeric, 1) as avg_candidates,
  COUNT(CASE WHEN results_count = 0 THEN 1 END) as no_results_count,
  COUNT(CASE WHEN (retrieval_quality->>'max_score')::decimal < 0.3 THEN 1 END) as low_confidence_count
FROM iris_queries q
WHERE retrieval_quality IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY q.intent
ORDER BY total_queries DESC;

COMMENT ON VIEW iris_retrieval_quality_stats IS 'Retrieval quality metrics grouped by intent';

-- View: Daily failure trends
CREATE OR REPLACE VIEW iris_daily_failure_trends AS
SELECT
  created_at_date as date,
  COUNT(DISTINCT q.id) as total_queries,
  COUNT(DISTINCT f.id) as failed_queries,
  ROUND(COUNT(DISTINCT f.id)::numeric / NULLIF(COUNT(DISTINCT q.id), 0) * 100, 1) as failure_rate,
  JSONB_OBJECT_AGG(
    COALESCE(f.failure_type, 'no_failure'),
    COUNT(f.id)
  ) as failure_breakdown
FROM iris_queries q
LEFT JOIN iris_failure_metadata f ON q.id = f.query_id
WHERE q.created_at > NOW() - INTERVAL '30 days'
GROUP BY created_at_date
ORDER BY date DESC;

COMMENT ON VIEW iris_daily_failure_trends IS 'Daily trends showing overall failure rates and types';

-- ============================================================================
-- 7. HELPER FUNCTIONS
-- ============================================================================

-- Function to calculate KB gap priority score
CREATE OR REPLACE FUNCTION calculate_kb_gap_priority(
  p_query_count INTEGER,
  p_last_seen TIMESTAMP WITH TIME ZONE
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  days_since_last_seen INTEGER;
  recency_multiplier DECIMAL;
BEGIN
  -- Calculate days since last occurrence
  days_since_last_seen := EXTRACT(EPOCH FROM (NOW() - p_last_seen)) / 86400;

  -- Recent queries get higher multiplier
  -- 0-7 days: 2.0x, 7-14 days: 1.5x, 14-30 days: 1.2x, 30+ days: 1.0x
  recency_multiplier := CASE
    WHEN days_since_last_seen <= 7 THEN 2.0
    WHEN days_since_last_seen <= 14 THEN 1.5
    WHEN days_since_last_seen <= 30 THEN 1.2
    ELSE 1.0
  END;

  -- Priority = query_count * recency_multiplier
  RETURN FLOOR(p_query_count * recency_multiplier);
END;
$$;

COMMENT ON FUNCTION calculate_kb_gap_priority IS 'Calculates priority score for KB gaps based on frequency and recency';

-- Function to update session flow when new query added
CREATE OR REPLACE FUNCTION update_session_flow(
  p_session_id TEXT,
  p_query_id UUID,
  p_intent TEXT,
  p_success BOOLEAN,
  p_user_agent TEXT,
  p_query TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_first_query_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Insert or update session flow
  INSERT INTO iris_session_flows (
    session_id,
    query_ids,
    intent_sequence,
    success_sequence,
    total_queries,
    user_agent,
    first_query,
    last_query,
    updated_at
  )
  VALUES (
    p_session_id,
    ARRAY[p_query_id],
    ARRAY[p_intent],
    ARRAY[p_success],
    1,
    p_user_agent,
    p_query,
    p_query,
    NOW()
  )
  ON CONFLICT (session_id) DO UPDATE SET
    query_ids = iris_session_flows.query_ids || p_query_id,
    intent_sequence = iris_session_flows.intent_sequence || p_intent,
    success_sequence = iris_session_flows.success_sequence || p_success,
    total_queries = iris_session_flows.total_queries + 1,
    last_query = p_query,
    updated_at = NOW(),
    ended_in_contact = (p_intent = 'contact'),
    ended_in_failure = (NOT p_success);

  -- Update session duration
  SELECT created_at INTO v_first_query_time
  FROM iris_session_flows
  WHERE session_id = p_session_id;

  UPDATE iris_session_flows
  SET session_duration_ms = EXTRACT(EPOCH FROM (NOW() - v_first_query_time)) * 1000
  WHERE session_id = p_session_id;
END;
$$;

COMMENT ON FUNCTION update_session_flow IS 'Updates session flow record when a new query is added to the session';

-- End of migration
