# The Web — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build "The Web," a blog system on mikeveson.com where Mike publishes research and thinking from his Obsidian vault, with a Claude Code `/publish` skill for frictionless publishing.

**Architecture:** Posts stored in Supabase (runtime fetched, no rebuild needed). Next.js App Router pages for the stream (`/blog`) and individual posts (`/blog/[slug]`). Protected API routes for CRUD. Markdown rendered client-side with `react-markdown` (already installed). Custom Claude Code skill reads vault files and publishes via API.

**Tech Stack:** Next.js 15 (App Router), Supabase (PostgreSQL + Storage), react-markdown, Framer Motion, Tailwind CSS, Zod validation

---

### Task 1: Supabase Migration — Posts Table

**Files:**
- Create: `supabase/migrations/20260309_blog_posts.sql`

**Step 1: Write the migration SQL**

```sql
-- Create blog posts table
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  body TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  published_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  reading_time INTEGER DEFAULT 1,
  cover_image TEXT,
  images JSONB DEFAULT '[]'
);

-- Index for common queries
CREATE INDEX idx_blog_posts_status ON blog_posts(status);
CREATE INDEX idx_blog_posts_published_at ON blog_posts(published_at DESC);
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_tags ON blog_posts USING GIN(tags);

-- Full text search index
ALTER TABLE blog_posts ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(subtitle, '') || ' ' || coalesce(body, ''))) STORED;
CREATE INDEX idx_blog_posts_search ON blog_posts USING GIN(search_vector);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_blog_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_blog_posts_updated_at();
```

**Step 2: Run migration against Supabase**

Run the SQL in the Supabase dashboard SQL editor (or via `supabase db push` if CLI is configured).

**Step 3: Commit**

```bash
git add supabase/migrations/20260309_blog_posts.sql
git commit -m "feat(blog): add blog_posts table migration with full-text search"
```

---

### Task 2: Blog Types and Supabase Data Layer

**Files:**
- Create: `src/lib/blog.ts`
- Modify: `src/lib/env.ts` (no changes needed — already has Supabase config)

**Step 1: Create the blog data layer**

Create `src/lib/blog.ts` with types and Supabase query functions:

```typescript
import { getSupabaseAdmin } from './supabaseAdmin';

// ============================================================================
// TYPES
// ============================================================================

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
  preview: string; // First ~200 chars of body
}

export interface CreateBlogPostInput {
  slug: string;
  title: string;
  subtitle?: string;
  body: string;
  tags?: string[];
  cover_image?: string;
  images?: { url: string; alt?: string }[];
  status?: 'draft' | 'published';
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Calculate reading time from markdown body
 * ~200 words per minute average reading speed
 */
export function calculateReadingTime(body: string): number {
  const words = body.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

/**
 * Generate a preview from markdown body
 * Strips markdown syntax and truncates
 */
function generatePreview(body: string, maxLength = 200): string {
  const stripped = body
    .replace(/#{1,6}\s/g, '')       // headers
    .replace(/\*\*|__/g, '')         // bold
    .replace(/\*|_/g, '')            // italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')   // images
    .replace(/`{1,3}[^`]*`{1,3}/g, '')       // code
    .replace(/>\s/g, '')             // blockquotes
    .replace(/[-*+]\s/g, '')         // list items
    .replace(/\n+/g, ' ')           // newlines
    .trim();

  if (stripped.length <= maxLength) return stripped;
  return stripped.slice(0, maxLength).replace(/\s\S*$/, '') + '...';
}

/**
 * Get all published posts (newest first)
 * Optional: filter by tag, search text
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
    .select('id, slug, title, subtitle, tags, published_at, reading_time, cover_image, body')
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
    query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Blog] Error fetching posts:', error);
    throw new Error(`Failed to fetch posts: ${error.message}`);
  }

  return (data || []).map(post => ({
    id: post.id,
    slug: post.slug,
    title: post.title,
    subtitle: post.subtitle,
    tags: post.tags || [],
    published_at: post.published_at,
    reading_time: post.reading_time,
    cover_image: post.cover_image,
    preview: generatePreview(post.body),
  }));
}

/**
 * Get a single post by slug
 */
export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('[Blog] Error fetching post:', error);
    throw new Error(`Failed to fetch post: ${error.message}`);
  }

  return data;
}

/**
 * Get all unique tags from published posts
 */
export async function getAllTags(): Promise<string[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('blog_posts')
    .select('tags')
    .eq('status', 'published');

  if (error) {
    console.error('[Blog] Error fetching tags:', error);
    return [];
  }

  const tagSet = new Set<string>();
  (data || []).forEach(post => {
    (post.tags || []).forEach((tag: string) => tagSet.add(tag));
  });

  return Array.from(tagSet).sort();
}

/**
 * Create a new blog post
 */
export async function createBlogPost(input: CreateBlogPostInput): Promise<BlogPost> {
  const supabase = getSupabaseAdmin();

  const readingTime = calculateReadingTime(input.body);

  const { data, error } = await supabase
    .from('blog_posts')
    .insert({
      slug: input.slug,
      title: input.title,
      subtitle: input.subtitle || null,
      body: input.body,
      tags: input.tags || [],
      reading_time: readingTime,
      cover_image: input.cover_image || null,
      images: input.images || [],
      status: input.status || 'published',
    })
    .select('*')
    .single();

  if (error) {
    console.error('[Blog] Error creating post:', error);
    throw new Error(`Failed to create post: ${error.message}`);
  }

  return data;
}

/**
 * Update an existing blog post
 */
export async function updateBlogPost(slug: string, updates: Partial<CreateBlogPostInput>): Promise<BlogPost> {
  const supabase = getSupabaseAdmin();

  const updateData: Record<string, unknown> = {};
  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.subtitle !== undefined) updateData.subtitle = updates.subtitle || null;
  if (updates.body !== undefined) {
    updateData.body = updates.body;
    updateData.reading_time = calculateReadingTime(updates.body);
  }
  if (updates.tags !== undefined) updateData.tags = updates.tags;
  if (updates.cover_image !== undefined) updateData.cover_image = updates.cover_image || null;
  if (updates.images !== undefined) updateData.images = updates.images;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.slug !== undefined) updateData.slug = updates.slug;

  const { data, error } = await supabase
    .from('blog_posts')
    .update(updateData)
    .eq('slug', slug)
    .select('*')
    .single();

  if (error) {
    console.error('[Blog] Error updating post:', error);
    throw new Error(`Failed to update post: ${error.message}`);
  }

  return data;
}

/**
 * Get adjacent posts for next/previous navigation
 */
export async function getAdjacentPosts(publishedAt: string): Promise<{
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
}> {
  const supabase = getSupabaseAdmin();

  const [prevResult, nextResult] = await Promise.all([
    supabase
      .from('blog_posts')
      .select('slug, title')
      .eq('status', 'published')
      .lt('published_at', publishedAt)
      .order('published_at', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('blog_posts')
      .select('slug, title')
      .eq('status', 'published')
      .gt('published_at', publishedAt)
      .order('published_at', { ascending: true })
      .limit(1)
      .single(),
  ]);

  return {
    prev: prevResult.data || null,
    next: nextResult.data || null,
  };
}
```

**Step 2: Commit**

```bash
git add src/lib/blog.ts
git commit -m "feat(blog): add blog types and Supabase data layer"
```

---

### Task 3: Blog API Routes

**Files:**
- Create: `src/app/api/blog/route.ts` (list posts, create post)
- Create: `src/app/api/blog/[slug]/route.ts` (get/update single post)

**Step 1: Create the main blog API route**

`src/app/api/blog/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPublishedPosts, createBlogPost, getAllTags } from '@/lib/blog';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

const CreatePostSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  body: z.string().min(1),
  tags: z.array(z.string()).optional(),
  cover_image: z.string().url().optional(),
  images: z.array(z.object({ url: z.string().url(), alt: z.string().optional() })).optional(),
  status: z.enum(['draft', 'published']).optional(),
});

/**
 * GET /api/blog
 * Public endpoint to list published posts
 * Query params: tag, search, limit, offset, tags_only
 */
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;

    // Special mode: just return all tags
    if (params.get('tags_only') === 'true') {
      const tags = await getAllTags();
      return NextResponse.json({ tags });
    }

    const posts = await getPublishedPosts({
      tag: params.get('tag') || undefined,
      search: params.get('search') || undefined,
      limit: params.has('limit') ? parseInt(params.get('limit')!) : 20,
      offset: params.has('offset') ? parseInt(params.get('offset')!) : 0,
    });

    return NextResponse.json({ posts });
  } catch (error) {
    console.error('[Blog API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/blog
 * Protected endpoint to create a new post
 * Requires x-admin-key header
 */
export async function POST(req: NextRequest) {
  try {
    const adminKey = req.headers.get('x-admin-key');
    if (!adminKey || adminKey !== env.adminApiKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validation = CreatePostSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: `Validation failed: ${validation.error.message}` },
        { status: 400 }
      );
    }

    const post = await createBlogPost(validation.data);
    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    console.error('[Blog API] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Step 2: Create the single post API route**

`src/app/api/blog/[slug]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getPostBySlug, updateBlogPost } from '@/lib/blog';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

/**
 * GET /api/blog/[slug]
 * Public endpoint to get a single post
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const post = await getPostBySlug(slug);

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json({ post });
  } catch (error) {
    console.error('[Blog API] GET slug error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/blog/[slug]
 * Protected endpoint to update a post
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const adminKey = req.headers.get('x-admin-key');
    if (!adminKey || adminKey !== env.adminApiKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = await params;
    const body = await req.json();
    const post = await updateBlogPost(slug, body);

    return NextResponse.json({ post });
  } catch (error) {
    console.error('[Blog API] PUT error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/blog/
git commit -m "feat(blog): add blog API routes with admin auth"
```

---

### Task 4: The Stream Page (`/blog`)

**Files:**
- Create: `src/app/blog/page.tsx`
- Create: `src/app/blog/layout.tsx`
- Create: `src/app/blog/components/PostCard.tsx`
- Create: `src/app/blog/components/TagFilter.tsx`
- Create: `src/app/blog/components/SearchBar.tsx`

This is the main blog page. Server-rendered, fetches posts from Supabase at request time.

**Step 1: Create the blog layout**

`src/app/blog/layout.tsx`:

```tsx
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The Web | Mike Veson',
  description: 'Research, philosophy, and thinking — one stream.',
  openGraph: {
    title: 'The Web | Mike Veson',
    description: 'Research, philosophy, and thinking — one stream.',
    url: 'https://mikeveson.com/blog',
    siteName: 'Mike Veson',
    type: 'website',
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

**Step 2: Create PostCard component**

`src/app/blog/components/PostCard.tsx`:

```tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import ContainedMouseGlow from '@/components/ContainedMouseGlow';
import type { BlogPostPreview } from '@/lib/blog';

interface PostCardProps {
  post: BlogPostPreview;
  index: number;
}

export default function PostCard({ post, index }: PostCardProps) {
  const date = new Date(post.published_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Link href={`/blog/${post.slug}`}>
        <div
          className="relative rounded-xl overflow-hidden cursor-pointer group
            hover:shadow-lg transition-shadow duration-300
            hover:bg-gradient-to-br hover:from-gray-800 hover:to-gray-700"
          data-has-contained-glow="true"
        >
          <ContainedMouseGlow color="168, 85, 247" intensity={0.25} />

          <div className="relative z-10 px-5 py-5 sm:px-6 sm:py-6">
            {/* Date + Reading time */}
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-2">
              <span>{date}</span>
              <span className="w-1 h-1 rounded-full bg-gray-500" />
              <span>{post.reading_time} min read</span>
            </div>

            {/* Title */}
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 group-hover:text-purple-300 transition-colors">
              {post.title}
            </h2>

            {/* Subtitle */}
            {post.subtitle && (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {post.subtitle}
              </p>
            )}

            {/* Preview */}
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              {post.preview}
            </p>

            {/* Tags */}
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {post.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 text-xs rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
```

**Step 3: Create TagFilter component**

`src/app/blog/components/TagFilter.tsx`:

```tsx
'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TagFilterProps {
  tags: string[];
  activeTag: string | null;
  onTagClick: (tag: string | null) => void;
}

export default function TagFilter({ tags, activeTag, onTagClick }: TagFilterProps) {
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <AnimatePresence>
        {tags.map(tag => (
          <motion.button
            key={tag}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={() => onTagClick(activeTag === tag ? null : tag)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              activeTag === tag
                ? 'bg-purple-500 text-white border-purple-500'
                : 'bg-transparent text-gray-400 border-gray-600 hover:border-purple-500/50 hover:text-purple-300'
            }`}
          >
            {tag}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
```

**Step 4: Create SearchBar component**

`src/app/blog/components/SearchBar.tsx`:

```tsx
'use client';

import React, { useState, useCallback } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
}

export default function SearchBar({ onSearch }: SearchBarProps) {
  const [value, setValue] = useState('');

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    // Debounce: only search after user stops typing
    const timeout = setTimeout(() => onSearch(newValue), 300);
    return () => clearTimeout(timeout);
  }, [onSearch]);

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder="Search the web..."
        className="w-full px-4 py-2.5 text-sm bg-gray-800/50 border border-gray-700 rounded-lg
          text-gray-200 placeholder-gray-500
          focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20
          transition-colors"
      />
      {value && (
        <button
          onClick={() => { setValue(''); onSearch(''); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-sm"
        >
          clear
        </button>
      )}
    </div>
  );
}
```

**Step 5: Create the main blog page**

`src/app/blog/page.tsx`:

```tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import MouseGlow from '@/components/mouse_glow';
import PostCard from './components/PostCard';
import TagFilter from './components/TagFilter';
import SearchBar from './components/SearchBar';
import type { BlogPostPreview } from '@/lib/blog';

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPostPreview[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeTag) params.set('tag', activeTag);
    if (searchQuery) params.set('search', searchQuery);

    try {
      const res = await fetch(`/api/blog?${params}`);
      const data = await res.json();
      setPosts(data.posts || []);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTag, searchQuery]);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch('/api/blog?tags_only=true');
      const data = await res.json();
      setTags(data.tags || []);
    } catch (err) {
      console.error('Failed to fetch tags:', err);
    }
  }, []);

  useEffect(() => { fetchTags(); }, [fetchTags]);
  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <MouseGlow />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 sm:mb-14"
        >
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-300 transition-colors mb-6 block">
            &larr; mikeveson.com
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            the web
          </h1>
          <p className="mt-2 text-gray-400 text-sm sm:text-base">
            research, reactions, and thinking. all connected.
          </p>
        </motion.div>

        {/* Search + Filters */}
        <div className="space-y-4 mb-8 sm:mb-10">
          <SearchBar onSearch={setSearchQuery} />
          <TagFilter tags={tags} activeTag={activeTag} onTagClick={setActiveTag} />
        </div>

        {/* Posts */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-gray-500">loading...</div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {searchQuery || activeTag ? 'no posts match that filter.' : 'nothing here yet.'}
            </div>
          ) : (
            posts.map((post, i) => (
              <PostCard key={post.id} post={post} index={i} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 6: Commit**

```bash
git add src/app/blog/
git commit -m "feat(blog): add The Web stream page with search and tag filtering"
```

---

### Task 5: Individual Post Page (`/blog/[slug]`)

**Files:**
- Create: `src/app/blog/[slug]/page.tsx`
- Create: `src/app/blog/components/MarkdownRenderer.tsx`
- Create: `src/app/blog/components/ShareButton.tsx`

**Step 1: Create the MarkdownRenderer component**

`src/app/blog/components/MarkdownRenderer.tsx`:

```tsx
'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import Image from 'next/image';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => (
          <h1 className="text-2xl sm:text-3xl font-bold mt-10 mb-4 text-gray-100">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-3 text-gray-100">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-lg sm:text-xl font-semibold mt-6 mb-2 text-gray-200">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="text-base leading-7 text-gray-300 mb-4">{children}</p>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 underline underline-offset-2"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-purple-500/50 pl-4 my-4 text-gray-400 italic">
            {children}
          </blockquote>
        ),
        code: ({ className, children }) => {
          const isBlock = className?.includes('language-');
          if (isBlock) {
            return (
              <pre className="bg-gray-800 rounded-lg p-4 my-4 overflow-x-auto">
                <code className="text-sm text-gray-300">{children}</code>
              </pre>
            );
          }
          return (
            <code className="bg-gray-800 px-1.5 py-0.5 rounded text-sm text-purple-300">
              {children}
            </code>
          );
        },
        ul: ({ children }) => (
          <ul className="list-disc list-outside pl-5 space-y-1 mb-4 text-gray-300">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-outside pl-5 space-y-1 mb-4 text-gray-300">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="leading-7">{children}</li>
        ),
        hr: () => (
          <hr className="border-gray-700 my-8" />
        ),
        img: ({ src, alt }) => (
          <span className="block my-6">
            <Image
              src={src || ''}
              alt={alt || ''}
              width={800}
              height={450}
              className="rounded-lg w-full h-auto"
              unoptimized // For external URLs
            />
            {alt && (
              <span className="block text-center text-xs text-gray-500 mt-2">{alt}</span>
            )}
          </span>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
```

**Step 2: Create ShareButton component**

`src/app/blog/components/ShareButton.tsx`:

```tsx
'use client';

import React, { useState } from 'react';

export default function ShareButton() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
    >
      {copied ? 'copied!' : 'share link'}
    </button>
  );
}
```

**Step 3: Create the post page**

`src/app/blog/[slug]/page.tsx`:

```tsx
import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPostBySlug, getAdjacentPosts } from '@/lib/blog';
import MarkdownRenderer from '../components/MarkdownRenderer';
import ShareButton from '../components/ShareButton';
import type { Metadata } from 'next';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) return { title: 'Not Found | Mike Veson' };

  return {
    title: `${post.title} | The Web`,
    description: post.subtitle || post.body.slice(0, 160),
    openGraph: {
      title: post.title,
      description: post.subtitle || post.body.slice(0, 160),
      url: `https://mikeveson.com/blog/${slug}`,
      type: 'article',
      publishedTime: post.published_at,
      ...(post.cover_image ? { images: [post.cover_image] } : {}),
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) notFound();

  const adjacent = await getAdjacentPosts(post.published_at);

  const date = new Date(post.published_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <article className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        {/* Back link */}
        <Link href="/blog" className="text-sm text-gray-500 hover:text-gray-300 transition-colors mb-8 block">
          &larr; the web
        </Link>

        {/* Header */}
        <header className="mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">
            {post.title}
          </h1>
          {post.subtitle && (
            <p className="mt-2 text-lg text-gray-400">{post.subtitle}</p>
          )}
          <div className="flex items-center gap-3 mt-4 text-xs text-gray-500">
            <span>{date}</span>
            <span className="w-1 h-1 rounded-full bg-gray-600" />
            <span>{post.reading_time} min read</span>
            <span className="w-1 h-1 rounded-full bg-gray-600" />
            <ShareButton />
          </div>
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {post.tags.map(tag => (
                <Link
                  key={tag}
                  href={`/blog?tag=${encodeURIComponent(tag)}`}
                  className="px-2 py-0.5 text-xs rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-colors"
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}
        </header>

        {/* Body */}
        <div className="prose-custom">
          <MarkdownRenderer content={post.body} />
        </div>

        {/* Navigation */}
        <nav className="mt-16 pt-8 border-t border-gray-800 flex justify-between text-sm">
          {adjacent.prev ? (
            <Link href={`/blog/${adjacent.prev.slug}`} className="text-gray-400 hover:text-purple-300 transition-colors">
              &larr; {adjacent.prev.title}
            </Link>
          ) : <span />}
          {adjacent.next ? (
            <Link href={`/blog/${adjacent.next.slug}`} className="text-gray-400 hover:text-purple-300 transition-colors text-right">
              {adjacent.next.title} &rarr;
            </Link>
          ) : <span />}
        </nav>
      </article>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/app/blog/
git commit -m "feat(blog): add individual post page with markdown rendering and navigation"
```

---

### Task 6: Homepage Media Section Update

**Files:**
- Modify: `src/app/page.tsx` — Add "The Web" link in the Media section
- Modify: `src/app/blogs/blogs_section.tsx` — Optional: add link to /blog

**Step 1: Add a link to The Web from the Media section header**

In `src/app/page.tsx`, the Media section currently just renders blog cards. Add a subtle "See all in The Web" link. This is a minimal change: just add a link element after the blog cards in the media section, inside the `max-w-3xl mx-auto space-y-6` div.

```tsx
// Inside the Media section's inner div, after blogCards:
<div className="text-center mt-4">
  <a href="/blog" className="text-sm text-gray-500 hover:text-purple-400 transition-colors">
    explore the web &rarr;
  </a>
</div>
```

**Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(blog): link homepage Media section to The Web"
```

---

### Task 7: Claude Code Publish Skill

**Files:**
- Create: `~/.claude/skills/publish/SKILL.md` (in the vault's Claude Code skill location or global)

The publish skill is a Claude Code custom command. When Mike says `/publish`, Iris reads the vault file, adapts it, and publishes via the API.

**Step 1: Create the publish skill**

Location: In the vault project's `.claude/skills/publish/SKILL.md` (or wherever Mike's Claude Code skills live — check existing skill structure).

```markdown
---
name: publish
description: Publish a vault document to The Web (mikeveson.com/blog)
---

# Publish to The Web

Publish an Obsidian vault document as a blog post on mikeveson.com.

## Workflow

1. **Identify the source file.** The user will either specify a file path or you should ask which vault file to publish. Read the file.

2. **Adapt for public audience.**
   - Remove any overly personal context, internal vault references, or private notes
   - Preserve Mike's voice and thinking style (informal, direct, philosophical)
   - Keep the analytical structure intact
   - Clean up any Obsidian-specific syntax (wikilinks → plain text, dataview queries → remove)
   - Images: if the document references local vault images, note them for manual upload

3. **Present the draft to Mike.**
   Show:
   - **Title** (suggest one based on content, Mike can override)
   - **Subtitle** (optional, suggest if appropriate)
   - **Tags** (suggest 2-4 based on content)
   - **Slug** (auto-generated from title, lowercase-hyphenated)
   - **Full body** (the adapted markdown)

   Ask Mike to review and approve or request changes.

4. **Publish via API.**
   Once approved, call the mikeveson.com blog API:

   ```bash
   curl -X POST https://mikeveson.com/api/blog \
     -H "Content-Type: application/json" \
     -H "x-admin-key: $ADMIN_API_KEY" \
     -d '{
       "slug": "the-slug",
       "title": "The Title",
       "subtitle": "Optional subtitle",
       "body": "Full markdown body...",
       "tags": ["philosophy", "ethics"],
       "status": "published"
     }'
   ```

   The ADMIN_API_KEY should be read from environment or from the site's .env file at `~/Downloads/Dev/mikedouz-portfolio/.env`.

5. **Confirm publication.** Show the live URL: `https://mikeveson.com/blog/{slug}`

## Update Flow

If Mike says "update [post name]":
1. Fetch current post via `GET /api/blog/{slug}`
2. Show current version
3. Apply changes
4. `PUT /api/blog/{slug}` with updates

## Tag Suggestions by Domain

| Content Domain | Suggested Tags |
|---------------|---------------|
| Tree of Human Flourishing | flourishing, philosophy |
| De Botton / relationships | relationships, love, philosophy |
| Computer Ethics / CRP | ethics, technology |
| Personal reactions | personal, reflection |
| Academic work | research, [specific field] |
```

**Step 2: Register the skill in CLAUDE.md or skill index**

Add to the vault's CLAUDE.md quick commands section:
```
| **"/publish"** | Publish a vault document to The Web on mikeveson.com |
```

**Step 3: Commit the skill**

```bash
git add .claude/skills/publish/
git commit -m "feat(blog): add /publish Claude Code skill for vault-to-web publishing"
```

---

### Task 8: Integration Testing

**Step 1: Test the full flow locally**

```bash
cd ~/Downloads/Dev/mikedouz-portfolio
npm run dev
```

1. Visit `http://localhost:3000/blog` — should show empty state "nothing here yet."
2. Create a test post via curl against local API (port 3000)
3. Refresh `/blog` — post should appear
4. Click into post — full markdown should render
5. Test tag filtering and search
6. Test share/copy link button
7. Visit homepage — "explore the web" link should appear in Media section

**Step 2: Test the publish skill**

From the vault Claude Code session, run `/publish` pointing to the de Botton analysis file. Verify the full workflow works end-to-end.

**Step 3: Deploy**

Push to main branch. Vercel auto-deploys. Run the Supabase migration in production. Add any missing env vars in Vercel dashboard (should already have SUPABASE and ADMIN_API_KEY from inbox).

---

## Task Summary

| Task | What | Key Files |
|------|------|-----------|
| 1 | Supabase migration | `supabase/migrations/20260309_blog_posts.sql` |
| 2 | Types + data layer | `src/lib/blog.ts` |
| 3 | API routes | `src/app/api/blog/route.ts`, `src/app/api/blog/[slug]/route.ts` |
| 4 | Stream page | `src/app/blog/page.tsx` + components |
| 5 | Post page | `src/app/blog/[slug]/page.tsx` + MarkdownRenderer + ShareButton |
| 6 | Homepage link | `src/app/page.tsx` |
| 7 | Publish skill | `.claude/skills/publish/SKILL.md` |
| 8 | Integration testing | Manual testing flow |
