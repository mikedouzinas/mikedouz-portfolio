import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { getPostBySlug, updateBlogPost } from '@/lib/blog';
import { notifySubscribers } from '@/lib/notifySubscribers';

export const runtime = 'nodejs';

/**
 * GET /api/blog/[slug]
 * Public endpoint to fetch a single published post by slug.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const post = await getPostBySlug(slug);

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ post });
  } catch (error) {
    console.error('[Blog] GET [slug] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/blog/[slug]
 * Protected endpoint to update an existing blog post.
 * Requires x-admin-key header.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    // Check admin authentication
    const adminKey = req.headers.get('x-admin-key');
    if (!adminKey || adminKey !== env.adminApiKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const { slug } = await params;
    const body = await req.json();

    // Check if this is a draft->published transition
    const existingPost = body.status === 'published' ? await getPostBySlug(slug) : null;
    const wasDraft = existingPost === null; // getPostBySlug only returns published posts, so null means it was draft

    const post = await updateBlogPost(slug, body);

    // Notify subscribers when a post transitions to published
    if (body.status === 'published' && wasDraft) {
      notifySubscribers({
        title: post.title,
        subtitle: post.subtitle,
        slug: post.slug,
        body: post.body,
        reading_time: post.reading_time,
        tags: post.tags,
      }).catch((err) => console.error('[Blog] Failed to notify subscribers:', err));
    }

    return NextResponse.json({ post });
  } catch (error) {
    console.error('[Blog] PUT [slug] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
