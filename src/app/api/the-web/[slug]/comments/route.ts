import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Resend } from 'resend';
import { env } from '@/lib/env';
import { getPostBySlug } from '@/lib/blog';
import {
  getCommentsForPost,
  createComment,
  checkCommentRateLimit,
  getCommentAuthor,
  hashIP,
} from '@/lib/comments';
import { sanitizeText, escapeHtml } from '@/lib/security';

/**
 * Strip control characters from body text while preserving newlines.
 * Unlike sanitizeText(), this does NOT collapse whitespace.
 */
function sanitizeBody(text: string, maxLength: number): string {
  let s = text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '').trim();
  if (s.length > maxLength) s = s.slice(0, maxLength).trim();
  return s;
}
import { getClientIp } from '@/lib/rateLimit';

export const runtime = 'nodejs';

// Lazy Resend singleton
let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    if (!env.resendApiKey) {
      throw new Error('Resend API key not configured');
    }
    resendClient = new Resend(env.resendApiKey);
  }
  return resendClient;
}

// Zod validation schema
const CreateCommentSchema = z.object({
  author_name: z.string().max(100).trim().default('Anonymous'),
  author_email: z.string().email().optional().or(z.literal('')),
  body: z
    .string()
    .min(10, 'comment must be at least 10 characters')
    .max(5000)
    .trim(),
  parent_id: z.string().uuid().optional(),
  passage_ref: z.string().max(1000).optional(),
  honeypot: z.string().max(0).optional(),
});

/**
 * GET /api/the-web/[slug]/comments
 * Public endpoint to fetch all comments for a post.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const post = await getPostBySlug(slug);

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const comments = await getCommentsForPost(post.id);
    return NextResponse.json({ comments });
  } catch (error) {
    console.error('[Comments] GET error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/the-web/[slug]/comments
 * Public endpoint to create a new comment. Rate-limited with honeypot.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    // Look up post
    const post = await getPostBySlug(slug);
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Parse and validate
    const rawBody = await req.json();
    const validation = CreateCommentSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Validation failed' },
        { status: 400 },
      );
    }

    const payload = validation.data;

    // Honeypot check — silently accept to avoid tipping off bots
    if (payload.honeypot) {
      console.warn('[Comments] Honeypot triggered');
      return NextResponse.json(
        { comment: { id: 'ok', post_id: post.id } },
        { status: 201 },
      );
    }

    // Rate limit (DB-based)
    const ip = getClientIp(req);
    const ipHash = hashIP(ip);
    const allowed = await checkCommentRateLimit(ipHash);
    if (!allowed) {
      return NextResponse.json(
        { error: 'slow down — max 3 comments per 5 minutes' },
        { status: 429 },
      );
    }

    // Check admin auth (optional — lets Mike comment via API with badge)
    const adminKey = req.headers.get('x-admin-key');
    const isAdmin = !!(adminKey && adminKey === env.adminApiKey);

    // Sanitize inputs (sanitizeText for name, sanitizeBody for body to preserve newlines)
    const authorName = sanitizeText(payload.author_name, 100);
    const body = sanitizeBody(payload.body, 5000);

    // Create comment
    const comment = await createComment({
      post_id: post.id,
      parent_id: payload.parent_id,
      author_name: authorName,
      author_email: payload.author_email || undefined,
      body,
      passage_ref: payload.passage_ref,
      ip_hash: ipHash,
      is_admin: isAdmin,
    });

    // Send notification email (non-blocking)
    sendCommentNotification({
      slug,
      postTitle: post.title,
      commentId: comment.id,
      authorName,
      body,
      parentId: payload.parent_id,
    }).catch((err) =>
      console.error('[Comments] Email notification failed:', err),
    );

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error('[Comments] POST error:', error);

    // Surface known user-facing errors, hide internal details
    const message = error instanceof Error ? error.message : '';
    const safeMessages = [
      'Parent comment not found',
      'Cannot reply to a reply (single-level nesting only)',
    ];
    const userMessage = safeMessages.includes(message)
      ? message
      : 'something went wrong';

    return NextResponse.json({ error: userMessage }, { status: 500 });
  }
}

/**
 * Send a notification email to Mike when a new comment is posted.
 */
async function sendCommentNotification(data: {
  slug: string;
  postTitle: string;
  commentId: string;
  authorName: string;
  body: string;
  parentId?: string;
}) {
  const resend = getResendClient();

  let replyContext = '';
  if (data.parentId) {
    const parentAuthor = await getCommentAuthor(data.parentId);
    if (parentAuthor) {
      replyContext = `<p style="color: #6b7280; font-style: italic;">In reply to ${escapeHtml(parentAuthor)}'s comment</p>`;
    }
  }

  const deleteCmd = `curl -X DELETE https://mikeveson.com/api/the-web/comments/${data.commentId} -H "x-admin-key: $ADMIN_API_KEY"`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="margin: 0 0 4px 0;">New comment on "${escapeHtml(data.postTitle)}"</h2>
  <p style="margin: 0 0 16px 0; color: #6b7280;">${escapeHtml(data.authorName)}</p>
  ${replyContext}
  <blockquote style="margin: 16px 0; padding: 12px 16px; background: #f3f4f6; border-left: 3px solid #a78bfa; border-radius: 4px; white-space: pre-wrap;">${escapeHtml(data.body)}</blockquote>
  <p><a href="https://mikeveson.com/the-web/${data.slug}#comment-${data.commentId}" style="color: #a78bfa;">View on site</a></p>
  <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">Delete:<br><code style="font-size: 11px; background: #f3f4f6; padding: 4px 8px; border-radius: 4px; word-break: break-all;">${escapeHtml(deleteCmd)}</code></p>
</body>
</html>`;

  await resend.emails.send({
    from: 'The Web <comments@iris.mikeveson.com>',
    to: env.inboxRecipientEmail,
    subject: `New comment on "${data.postTitle}"`,
    html,
  });
}
