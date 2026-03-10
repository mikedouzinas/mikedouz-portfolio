import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { getPostBySlug, updateBlogPost } from '@/lib/blog';

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

    const post = await updateBlogPost(slug, body);
    return NextResponse.json({ post });
  } catch (error) {
    console.error('[Blog] PUT [slug] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
