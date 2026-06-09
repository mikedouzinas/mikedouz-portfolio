-- 20260608000001_dev_hidden_repos.sql
-- Repos Mike has hidden from the secret dev-console board.

create table if not exists public.dev_hidden_repos (
  repo_slug text primary key,           -- "owner/name"
  hidden_at timestamptz not null default now()
);

-- Row-Level Security on; accessed only via the SERVICE_ROLE key (bypasses RLS).
alter table public.dev_hidden_repos enable row level security;

comment on table public.dev_hidden_repos is 'Repos hidden from the secret dev-console board.';
