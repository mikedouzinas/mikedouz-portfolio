import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import {
  getPublishedPosts,
  getAllTags,
  createBlogPost,
} from '@/lib/blog';
import { notifySubscribers } from '@/lib/notifySubscribers';

export const runtime = 'nodejs';

const CreatePostSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  body: z.string().min(1),
  tags: z.array(z.string()).optional(),
  cover_image: z.string().url().optional(),
  images: z
    .array(z.object({ url: z.string().url(), alt: z.string().optional() }))
    .optional(),
  theme: z
    .object({
      accent_color: z.string().optional(),
      header_style: z
        .enum(['minimal', 'cover-image', 'full-bleed'])
        .optional(),
      background_mood: z.string().optional(),
      custom_class: z.string().optional(),
    })
    .optional(),
  status: z.enum(['draft', 'published']).optional(),
  iris_context: z.string().optional(),
  soundtrack: z
    .array(
      z.object({
        trackUri: z.string().startsWith('spotify:track:'),
        trackName: z.string().min(1),
        artist: z.string().min(1),
        albumArtUrl: z.string().url(),
      }),
    )
    .optional(),
});

/**
 * GET /api/blog
 * Public endpoint to list published posts or fetch all tags.
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;

    // If tags_only, return just the tag list
    if (searchParams.get('tags_only') === 'true') {
      const tags = await getAllTags();
      return NextResponse.json({ tags });
    }

    const tag = searchParams.get('tag') || undefined;
    const search = searchParams.get('search') || undefined;
    const limit = searchParams.has('limit')
      ? parseInt(searchParams.get('limit')!, 10)
      : undefined;
    const offset = searchParams.has('offset')
      ? parseInt(searchParams.get('offset')!, 10)
      : undefined;

    const posts = await getPublishedPosts({ tag, search, limit, offset });
    return NextResponse.json({ posts });
  } catch (error) {
    console.error('[Blog] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/blog
 * Protected endpoint to create a new blog post.
 * Requires x-admin-key header.
 */
export async function POST(req: NextRequest) {
  try {
    // Check admin authentication
    const adminKey = req.headers.get('x-admin-key');
    if (!adminKey || adminKey !== env.adminApiKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const body = await req.json();

    // Validate with Zod schema
    const validation = CreatePostSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: `Validation failed: ${validation.error.message}` },
        { status: 400 },
      );
    }

    const post = await createBlogPost(validation.data);

    // Send subscriber notifications (non-blocking)
    if (post.status === 'published') {
      notifySubscribers({
        title: post.title,
        subtitle: post.subtitle,
        slug: post.slug,
        body: post.body,
        reading_time: post.reading_time,
        tags: post.tags,
      }).catch((err) => console.error('[Blog] Failed to notify subscribers:', err));
    }

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    console.error('[Blog] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
