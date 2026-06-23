-- 20260622000001_dev_projects_items.sql
-- Virtual (non-code) projects + their items for THE HARLEQUIN.
-- Code projects keep using GitHub Issues; this is the Supabase-backed layer.
-- dev_items mirror the GitHub ticket model exactly so they render through the
-- SAME board card: priority p1..p5, status todo/in progress/awaiting review,
-- size S/M/L, and "done" = a closed item (closed_at set).

create table if not exists public.dev_projects (
  id           text primary key,                 -- slug, e.g. "deep-work-queue"
  name         text not null,
  kind         text not null default 'virtual'
                 check (kind in ('virtual', 'code')),
  vault_path   text,                             -- folder/file in the-mv-vault (nullable)
  iris_visible boolean not null default false,   -- gates any future flow to Iris/public
  created_at   timestamptz not null default now()
);

create table if not exists public.dev_items (
  id          uuid primary key default gen_random_uuid(),
  project_id  text not null references public.dev_projects(id) on delete cascade,
  title       text not null,
  body        text not null default '',          -- markdown, supports `- [ ]` subtasks
  priority    text check (priority in ('p1', 'p2', 'p3', 'p4', 'p5')),
  status      text not null default 'todo'
                check (status in ('todo', 'in progress', 'awaiting review')),
  size        text check (size in ('S', 'M', 'L')),
  vault_ref   text,                              -- relative path to originating vault note
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  closed_at   timestamptz                        -- done = closed_at is not null
);

create index if not exists dev_items_project_id_idx on public.dev_items (project_id);

-- RLS deny-by-default: no policies => anon/public key gets ZERO access.
-- Reachable only via the SERVICE_ROLE key (site server + vault), which bypasses RLS.
alter table public.dev_projects enable row level security;
alter table public.dev_items    enable row level security;

comment on table public.dev_projects is 'Virtual (non-code) projects for the Harlequin board.';
comment on table public.dev_items    is 'Items belonging to a virtual project (mirror the GitHub ticket model).';
