-- 20260310_blog_posts.sql
-- Create the blog_posts table for "The Web" blog system.

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  subtitle text,
  body text not null,
  tags text[] not null default '{}',
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'published'
    check (status in ('draft', 'published')),
  reading_time integer not null default 1,
  cover_image text,
  images jsonb not null default '[]'::jsonb,
  theme jsonb not null default '{}'::jsonb,
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(subtitle, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'C')
  ) stored
);

-- Indexes
create index idx_blog_posts_status on public.blog_posts (status);
create index idx_blog_posts_published_at on public.blog_posts (published_at desc);
create index idx_blog_posts_slug on public.blog_posts (slug);
create index idx_blog_posts_tags on public.blog_posts using gin (tags);
create index idx_blog_posts_search on public.blog_posts using gin (search_vector);

-- Auto-update updated_at on row modification
create or replace function public.blog_posts_update_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_blog_posts_updated_at
  before update on public.blog_posts
  for each row
  execute function public.blog_posts_update_timestamp();

-- Row-Level Security: locked by default.
alter table public.blog_posts enable row level security;

-- The API routes use the Supabase SERVICE_ROLE key, which bypasses RLS.

comment on table public.blog_posts is 'Blog posts for The Web on mikeveson.com.';
