-- 20251027_inbox.sql
-- Create the inbox_messages table for portfolio "Ask Mike" messages.

create extension if not exists pgcrypto;

create table if not exists public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source varchar(24) not null,                 -- 'iris-explicit' | 'iris-suggested' | 'auto-insufficient'
  draft_message text not null,                 -- the user’s final message
  contact_method varchar(8) not null,          -- 'email' | 'phone' | 'anon'
  contact_value text,                          -- nullable if anon
  user_agent text,
  ip_hash text,
  status varchar(16) not null default 'new'    -- 'new' | 'read' | 'replied'
);

-- Row-Level Security: keep it locked by default.
alter table public.inbox_messages enable row level security;

-- The API route will use the Supabase SERVICE_ROLE key, which bypasses RLS.
-- So no policies needed for public access.

comment on table public.inbox_messages is 'Stores messages sent to Mike via the Iris assistant.';