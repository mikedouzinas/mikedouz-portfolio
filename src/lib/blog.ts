/**
 * Blog data layer for "The Web"
 * Types and Supabase query functions for the blog system
 *
 * Uses the admin client (service role key) to bypass RLS.
 * Only use in API routes, server components, and server actions.
 */

import { getSupabaseAdmin } from './supabaseAdmin';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BlogPostTheme {
  accent_color?: string;
  header_style?: 'minimal' | 'cover-image' | 'full-bleed';
  background_mood?: string;
  custom_class?: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  body: string;
  tags: string[];
  published_at: string;
  updated_at: string;
  status: 'draft' | 'published';
  reading_time: number;
  cover_image: string | null;
  images: { url: string; alt?: string }[];
  theme: BlogPostTheme;
}

export interface BlogPostPreview {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  tags: string[];
  published_at: string;
  reading_time: number;
  cover_image: string | null;
  theme: BlogPostTheme;
  preview: string;
  comment_count: number;
}

export interface CreateBlogPostInput {
  slug: string;
  title: string;
  subtitle?: string;
  body: string;
  tags?: string[];
  cover_image?: string;
  images?: { url: string; alt?: string }[];
  theme?: BlogPostTheme;
  status?: 'draft' | 'published';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WORDS_PER_MINUTE = 200;

/**
 * Estimate reading time in minutes (~200 wpm, minimum 1).
 */
export function calculateReadingTime(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/**
 * Strip markdown syntax and truncate to produce a plain-text preview.
 */
export function generatePreview(body: string, maxLength = 200): string {
  const plain = body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')   // images
    .replace(/\[[^\]]*\]\([^)]*\)/g, (m) => {
      const text = m.match(/\[([^\]]*)\]/);
      return text ? text[1] : '';
    })                                        // links (keep text)
    .replace(/```[\s\S]*?```/g, '')           // fenced code blocks
    .replace(/`([^`]+)`/g, '$1')              // inline code
    .replace(/^#{1,6}\s+/gm, '')              // headings
    .replace(/(\*\*|__)(.*?)\1/g, '$2')       // bold
    .replace(/(\*|_)(.*?)\1/g, '$2')          // italic
    .replace(/~~(.*?)~~/g, '$1')              // strikethrough
    .replace(/^>\s?/gm, '')                   // blockquotes
    .replace(/^[-*+]\s+/gm, '')              // unordered list markers
    .replace(/^\d+\.\s+/gm, '')              // ordered list markers
    .replace(/\n{2,}/g, ' ')                  // collapse blank lines
    .replace(/\n/g, ' ')                      // remaining newlines
    .replace(/\s{2,}/g, ' ')                  // collapse whitespace
    .trim();

  if (plain.length <= maxLength) return plain;
  // Cut at word boundary
  const truncated = plain.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + '...';
}

// Preview columns (everything except body and search_vector)
const PREVIEW_COLUMNS =
  'id, slug, title, subtitle, tags, published_at, reading_time, cover_image, theme, body, comment_count';

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

/**
 * List published posts, newest first.
 */
export async function getPublishedPosts(options?: {
  tag?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<BlogPostPreview[]> {
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from('blog_posts')
    .select(PREVIEW_COLUMNS)
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  if (options?.tag) {
    query = query.contains('tags', [options.tag]);
  }

  if (options?.search) {
    query = query.textSearch('search_vector', options.search, { type: 'websearch' });
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(
      options.offset,
      options.offset + (options.limit || 20) - 1,
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Supabase] Error fetching published posts:', error);
    throw new Error(`Failed to fetch published posts: ${error.message}`);
  }

  return (data || []).map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    tags: row.tags,
    published_at: row.published_at,
    reading_time: row.reading_time,
    cover_image: row.cover_image,
    theme: row.theme as BlogPostTheme,
    preview: generatePreview(row.body),
    comment_count: row.comment_count ?? 0,
  }));
}

/**
 * Fetch a single post by slug. Returns null when not found.
 */
export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('blog_posts')
    .select('id, slug, title, subtitle, body, tags, published_at, updated_at, status, reading_time, cover_image, images, theme')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (error) {
    // PGRST116 = "JSON object requested, multiple (or no) rows returned"
    if (error.code === 'PGRST116') return null;
    console.error('[Supabase] Error fetching post by slug:', error);
    throw new Error(`Failed to fetch post: ${error.message}`);
  }

  return data
    ? {
        ...data,
        theme: data.theme as BlogPostTheme,
        images: data.images as { url: string; alt?: string }[],
      }
    : null;
}

/**
 * Get all unique tags from published posts, sorted alphabetically.
 */
export async function getAllTags(): Promise<string[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('blog_posts')
    .select('tags')
    .eq('status', 'published');

  if (error) {
    console.error('[Supabase] Error fetching tags:', error);
    throw new Error(`Failed to fetch tags: ${error.message}`);
  }

  const tagSet = new Set<string>();
  for (const row of data || []) {
    for (const tag of row.tags ?? []) {
      tagSet.add(tag);
    }
  }

  return Array.from(tagSet).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
}

/**
 * Insert a new blog post. Reading time is calculated automatically.
 */
export async function createBlogPost(
  input: CreateBlogPostInput,
): Promise<BlogPost> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('blog_posts')
    .insert({
      slug: input.slug,
      title: input.title,
      subtitle: input.subtitle || null,
      body: input.body,
      tags: input.tags || [],
      cover_image: input.cover_image || null,
      images: input.images || [],
      theme: input.theme || {},
      status: input.status || 'published',
      reading_time: calculateReadingTime(input.body),
    })
    .select('id, slug, title, subtitle, body, tags, published_at, updated_at, status, reading_time, cover_image, images, theme')
    .single();

  if (error) {
    console.error('[Supabase] Error creating blog post:', error);
    throw new Error(`Failed to create blog post: ${error.message}`);
  }

  return {
    ...data,
    theme: data.theme as BlogPostTheme,
    images: data.images as { url: string; alt?: string }[],
  };
}

/**
 * Update an existing blog post by slug.
 * Recalculates reading_time when body changes.
 */
export async function updateBlogPost(
  slug: string,
  updates: Partial<CreateBlogPostInput>,
): Promise<BlogPost> {
  const supabase = getSupabaseAdmin();

  const payload: Record<string, unknown> = {};

  if (updates.slug !== undefined) payload.slug = updates.slug;
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.subtitle !== undefined) payload.subtitle = updates.subtitle || null;
  if (updates.body !== undefined) {
    payload.body = updates.body;
    payload.reading_time = calculateReadingTime(updates.body);
  }
  if (updates.tags !== undefined) payload.tags = updates.tags;
  if (updates.cover_image !== undefined) payload.cover_image = updates.cover_image || null;
  if (updates.images !== undefined) payload.images = updates.images;
  if (updates.theme !== undefined) payload.theme = updates.theme;
  if (updates.status !== undefined) payload.status = updates.status;

  const { data, error } = await supabase
    .from('blog_posts')
    .update(payload)
    .eq('slug', slug)
    .select('id, slug, title, subtitle, body, tags, published_at, updated_at, status, reading_time, cover_image, images, theme')
    .single();

  if (error) {
    console.error('[Supabase] Error updating blog post:', error);
    throw new Error(`Failed to update blog post: ${error.message}`);
  }

  return {
    ...data,
    theme: data.theme as BlogPostTheme,
    images: data.images as { url: string; alt?: string }[],
  };
}

/**
 * Get the previous and next published posts relative to a given published_at
 * timestamp, for prev/next navigation.
 */
export async function getAdjacentPosts(
  publishedAt: string,
): Promise<{
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
}> {
  const supabase = getSupabaseAdmin();

  // Previous = most recent post published BEFORE this one
  const prevQuery = supabase
    .from('blog_posts')
    .select('slug, title')
    .eq('status', 'published')
    .lt('published_at', publishedAt)
    .order('published_at', { ascending: false })
    .limit(1)
    .single();

  // Next = earliest post published AFTER this one
  const nextQuery = supabase
    .from('blog_posts')
    .select('slug, title')
    .eq('status', 'published')
    .gt('published_at', publishedAt)
    .order('published_at', { ascending: true })
    .limit(1)
    .single();

  const [prevResult, nextResult] = await Promise.all([prevQuery, nextQuery]);

  return {
    prev:
      prevResult.error || !prevResult.data
        ? null
        : { slug: prevResult.data.slug, title: prevResult.data.title },
    next:
      nextResult.error || !nextResult.data
        ? null
        : { slug: nextResult.data.slug, title: nextResult.data.title },
  };
}
