'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BlogComment } from '@/lib/comments';
import CommentForm from './CommentForm';
import CommentThread from './CommentThread';
import WebLoader from './WebLoader';

interface CommentSectionProps {
  postSlug: string;
}

/**
 * Nest flat comments into a tree structure (single level only).
 */
function nestComments(flat: BlogComment[]): BlogComment[] {
  const topLevel: BlogComment[] = [];
  const replyMap = new Map<string, BlogComment[]>();

  for (const c of flat) {
    if (c.parent_id) {
      const replies = replyMap.get(c.parent_id) || [];
      replies.push(c);
      replyMap.set(c.parent_id, replies);
    } else {
      topLevel.push(c);
    }
  }

  return topLevel.map((c) => ({
    ...c,
    replies: replyMap.get(c.id) || [],
  }));
}

export default function CommentSection({
  postSlug,
}: CommentSectionProps) {
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Admin affordances (inline comment deletion) light up whenever the visitor
  // holds a valid dev_session — the same portal login that unlocks /dev. The
  // cookie is httpOnly, so we ask the auth endpoint instead of reading it.
  // No more ?admin=key URL param or localStorage admin key.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/dev/auth')
      .then((res) => (res.ok ? res.json() : { authed: false }))
      .then((data: { authed?: boolean }) => {
        if (!cancelled) setIsAdmin(!!data.authed);
      })
      .catch(() => { /* not authed */ });
    return () => { cancelled = true; };
  }, []);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/the-web/${postSlug}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch (err) {
      console.error('[Comments] Fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [postSlug]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Refresh comments when a new one is posted via Blog Iris
  useEffect(() => {
    const handler = () => fetchComments();
    window.addEventListener('iris-comment-posted', handler);
    return () => window.removeEventListener('iris-comment-posted', handler);
  }, [fetchComments]);

  function handleReply(commentId: string) {
    setReplyingTo(commentId === replyingTo ? null : commentId);
  }

  function handleCommentAdded(newComment: BlogComment) {
    setComments((prev) => [...prev, newComment]);
    setReplyingTo(null);
    setShowForm(false);
  }

  async function handleDelete(commentId: string): Promise<boolean> {
    if (!isAdmin) return false;
    try {
      // Auth rides the dev_session cookie (sent automatically); no header.
      const res = await fetch(`/api/the-web/comments/${commentId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, is_deleted: true } : c))
        );
        return true;
      }
      console.error('[Comments] Delete returned', res.status);
      if (res.status === 401 || res.status === 404) {
        // Session expired/absent — drop the admin affordances.
        setIsAdmin(false);
      }
      return false;
    } catch (err) {
      console.error('[Comments] Delete failed:', err);
      return false;
    }
  }

  const nested = useMemo(() => nestComments(comments), [comments]);
  const visibleCount = comments.filter((c) => !c.is_deleted).length;
  const hasComments = visibleCount > 0;

  return (
    <div>
      {/* Header */}
      {hasComments && (
        <h3 className="text-lg font-semibold text-gray-200 mb-6">
          {visibleCount} comment{visibleCount !== 1 ? 's' : ''}
        </h3>
      )}

      {/* Comment threads */}
      {loading ? (
        <WebLoader />
      ) : (
        hasComments && (
          <div className="space-y-1 mb-6">
            {nested.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                onReply={handleReply}
                replyingTo={replyingTo}
                postSlug={postSlug}
                onCommentAdded={handleCommentAdded}
                isAdmin={isAdmin}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )
      )}

      {/* Add comment button / form at the bottom */}
      <AnimatePresence mode="wait">
        {showForm ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
          >
            <CommentForm
              postSlug={postSlug}
              onSubmit={handleCommentAdded}
              onCancel={() => setShowForm(false)}
            />
          </motion.div>
        ) : (
          <motion.button
            key="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setShowForm(true)}
            className="text-sm text-teal-400 hover:text-teal-300 transition-colors"
          >
            {hasComments ? 'add comment' : 'start the discussion'}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
