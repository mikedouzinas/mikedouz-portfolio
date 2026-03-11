/**
 * Comments data layer for "The Web"
 * Types and Supabase query functions for the blog comments system
 *
 * Uses the admin client (service role key) to bypass RLS.
 * Only use in API routes, server components, and server actions.
 */

import { createHash } from 'crypto';
import { getSupabaseAdmin } from './supabaseAdmin';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BlogComment {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_name: string;
  body: string;
  created_at: string;
  is_admin: boolean;
  is_deleted: boolean;
  replies?: BlogComment[];
}

export interface CreateCommentInput {
  post_id: string;
  parent_id?: string;
  author_name: string;
  author_email?: string;
  body: string;
  ip_hash?: string;
  is_admin?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Hash an IP address for privacy-preserving rate limiting.
 * Uses a salt to prevent rainbow table attacks.
 */
export function hashIP(ip: string): string {
  return createHash('sha256')
    .update(ip + (process.env.IP_HASH_SALT || 'the-web-comments'))
    .digest('hex')
    .slice(0, 16);
}

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

const COMMENT_COLUMNS =
  'id, post_id, parent_id, author_name, body, created_at, is_admin, is_deleted';

/**
 * Fetch all comments for a post, ordered by created_at ASC.
 * Returns a flat array — client-side nesting groups replies under parents.
 */
export async function getCommentsForPost(
  postId: string,
): Promise<BlogComment[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('blog_comments')
    .select(COMMENT_COLUMNS)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[Comments] Error fetching comments:', error);
    throw new Error(`Failed to fetch comments: ${error.message}`);
  }

  return (data || []) as BlogComment[];
}

/**
 * Insert a new comment.
 * If parent_id is provided, validates the parent exists and has no parent_id
 * itself (single-level nesting only).
 */
export async function createComment(
  input: CreateCommentInput,
): Promise<BlogComment> {
  const supabase = getSupabaseAdmin();

  // Enforce single-level nesting in the API layer
  if (input.parent_id) {
    const { data: parent, error: parentError } = await supabase
      .from('blog_comments')
      .select('id, parent_id')
      .eq('id', input.parent_id)
      .single();

    if (parentError || !parent) {
      throw new Error('Parent comment not found');
    }

    if (parent.parent_id) {
      throw new Error('Cannot reply to a reply (single-level nesting only)');
    }
  }

  const { data, error } = await supabase
    .from('blog_comments')
    .insert({
      post_id: input.post_id,
      parent_id: input.parent_id || null,
      author_name: input.author_name,
      author_email: input.author_email || null,
      body: input.body,
      ip_hash: input.ip_hash || null,
      is_admin: input.is_admin || false,
    })
    .select(COMMENT_COLUMNS)
    .single();

  if (error) {
    console.error('[Comments] Error creating comment:', error);
    throw new Error(`Failed to create comment: ${error.message}`);
  }

  return data as BlogComment;
}

/**
 * Soft delete a comment (sets is_deleted = true).
 * Preserves thread structure so replies remain visible.
 */
export async function deleteComment(commentId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('blog_comments')
    .update({ is_deleted: true })
    .eq('id', commentId);

  if (error) {
    console.error('[Comments] Error deleting comment:', error);
    throw new Error(`Failed to delete comment: ${error.message}`);
  }
}

/**
 * Get the comment count for a post from the cached column on blog_posts.
 */
export async function getCommentCount(postId: string): Promise<number> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('blog_posts')
    .select('comment_count')
    .eq('id', postId)
    .single();

  if (error) {
    console.error('[Comments] Error fetching comment count:', error);
    return 0;
  }

  return data?.comment_count ?? 0;
}

/**
 * Check if an IP hash is under the rate limit.
 * Max 3 comments per 5 minutes per IP hash.
 * Returns true if the request is allowed.
 */
export async function checkCommentRateLimit(
  ipHash: string,
): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  const fiveMinutesAgo = new Date(
    Date.now() - 5 * 60 * 1000,
  ).toISOString();

  const { count, error } = await supabase
    .from('blog_comments')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', fiveMinutesAgo);

  if (error) {
    console.error('[Comments] Error checking rate limit:', error);
    // Fail open — allow the comment if rate limit check fails
    return true;
  }

  return (count ?? 0) < 3;
}

/**
 * Get the author name of a comment by ID.
 * Used for notification emails when someone replies.
 */
export async function getCommentAuthor(
  commentId: string,
): Promise<string | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('blog_comments')
    .select('author_name')
    .eq('id', commentId)
    .single();

  if (error) return null;
  return data?.author_name ?? null;
}
