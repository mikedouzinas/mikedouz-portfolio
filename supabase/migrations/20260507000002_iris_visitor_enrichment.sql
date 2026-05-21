-- Visitor enrichment columns for iris_queries.
-- Populated server-side at log time using the request headers + ipinfo.io.
-- ip is stored as a salted SHA-256 hash so we can cluster rows from the
-- same visitor across sessions without retaining raw IPs.

ALTER TABLE iris_queries
  ADD COLUMN IF NOT EXISTS referrer        TEXT,
  ADD COLUMN IF NOT EXISTS ip_hash         TEXT,
  ADD COLUMN IF NOT EXISTS org             TEXT,
  ADD COLUMN IF NOT EXISTS city            TEXT,
  ADD COLUMN IF NOT EXISTS region          TEXT,
  ADD COLUMN IF NOT EXISTS country         TEXT,
  ADD COLUMN IF NOT EXISTS timezone        TEXT,
  ADD COLUMN IF NOT EXISTS utm_source      TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium      TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign    TEXT,
  ADD COLUMN IF NOT EXISTS utm_content     TEXT,
  ADD COLUMN IF NOT EXISTS utm_term        TEXT;

CREATE INDEX IF NOT EXISTS idx_iris_queries_ip_hash      ON iris_queries(ip_hash);
CREATE INDEX IF NOT EXISTS idx_iris_queries_org          ON iris_queries(org);
CREATE INDEX IF NOT EXISTS idx_iris_queries_utm_campaign ON iris_queries(utm_campaign);
