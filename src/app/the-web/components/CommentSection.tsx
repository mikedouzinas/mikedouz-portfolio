'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  }

  const nested = useMemo(() => nestComments(comments), [comments]);
  const visibleCount = comments.filter((c) => !c.is_deleted).length;

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-200 mb-6">
        {visibleCount > 0
          ? `${visibleCount} comment${visibleCount !== 1 ? 's' : ''}`
          : 'join the discussion'}
      </h3>

      {/* New top-level comment form */}
      <div className="mb-8">
        <CommentForm postSlug={postSlug} onSubmit={handleCommentAdded} />
      </div>

      {/* Comment threads */}
      {loading ? (
        <WebLoader />
      ) : (
        <div className="space-y-1">
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
      )}
    </div>
  );
}
