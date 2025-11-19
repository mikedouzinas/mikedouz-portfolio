-- 20251027_inbox_add_context.sql
-- Add context columns to store the conversation around the inbox message.

alter table public.inbox_messages
  add column if not exists user_query text,      -- the user's original question
  add column if not exists iris_answer text;     -- Iris’s response (markdown/plaintext)