-- Add client_query_id to iris_queries for joining with Google Analytics events.
-- The same id is streamed to the browser (first SSE chunk) and emitted on
-- iris_query_submit / iris_answer_received GA events as `client_query_id`.

ALTER TABLE iris_queries
  ADD COLUMN IF NOT EXISTS client_query_id TEXT;

CREATE INDEX IF NOT EXISTS idx_iris_queries_client_query_id
  ON iris_queries(client_query_id);
