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

  function handleReply(commentId: string, _authorName: string) {
    setReplyingTo(commentId === replyingTo ? null : commentId);
  }

  function handleCommentAdded(newComment: BlogComment) {
    setComments((prev) => [...prev, newComment]);
    setReplyingTo(null);
    setShowForm(false);
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
            className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            {hasComments ? 'add comment' : 'start the discussion'}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
