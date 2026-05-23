-- Persist Iris response bodies alongside the prompt.
-- `answer_length` is kept as a cheap aggregate; `answer_text` is the full text.
ALTER TABLE iris_queries
  ADD COLUMN IF NOT EXISTS answer_text TEXT;
