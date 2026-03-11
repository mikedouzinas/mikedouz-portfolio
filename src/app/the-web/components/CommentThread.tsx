'use client';

import type { BlogComment } from '@/lib/comments';
import CommentCard from './CommentCard';
import CommentForm from './CommentForm';

interface CommentThreadProps {
  comment: BlogComment;
  onReply: (commentId: string, authorName: string) => void;
  replyingTo: string | null;
  postSlug: string;
  onCommentAdded: (comment: BlogComment) => void;
}

export default function CommentThread({
  comment,
  onReply,
  replyingTo,
  postSlug,
  onCommentAdded,
}: CommentThreadProps) {
  return (
    <div>
      {/* Top-level comment */}
      <CommentCard comment={comment} onReply={onReply} />

      {/* Reply form (shown when replying to this comment) */}
      {replyingTo === comment.id && (
        <div className="ml-10 mb-2">
          <CommentForm
            postSlug={postSlug}
            parentId={comment.id}
            parentAuthor={comment.author_name}
            onSubmit={(newComment) => {
              onCommentAdded(newComment);
            }}
            onCancel={() => onReply('', '')}
          />
        </div>
      )}

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-10 border-l border-gray-800 pl-4">
          {comment.replies.map((reply) => (
            <CommentCard key={reply.id} comment={reply} isReply />
          ))}
        </div>
      )}
    </div>
  );
}
