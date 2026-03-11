'use client';

import { motion } from 'framer-motion';
import type { BlogComment } from '@/lib/comments';

interface CommentCardProps {
  comment: BlogComment;
  isReply?: boolean;
  onReply?: (commentId: string, authorName: string) => void;
}

/**
 * Deterministic color from author name hash.
 */
function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    'bg-purple-500/60',
    'bg-blue-500/60',
    'bg-emerald-500/60',
    'bg-amber-500/60',
    'bg-rose-500/60',
    'bg-cyan-500/60',
    'bg-indigo-500/60',
    'bg-pink-500/60',
  ];
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Simple relative time formatter.
 */
function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;

  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export default function CommentCard({
  comment,
  isReply,
  onReply,
}: CommentCardProps) {
  const avatarSize = isReply ? 'w-7 h-7 text-xs' : 'w-8 h-8 text-sm';

  if (comment.is_deleted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-3 py-3"
      >
        <div
          className={`${avatarSize} rounded-full bg-gray-800 flex items-center justify-center shrink-0`}
        >
          <span className="text-gray-600">?</span>
        </div>
        <p className="text-sm text-gray-600 italic">
          this comment was removed
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      id={`comment-${comment.id}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 py-3"
    >
      {/* Avatar */}
      <div
        className={`${avatarSize} ${avatarColor(comment.author_name)} rounded-full flex items-center justify-center shrink-0 font-medium text-white`}
      >
        {comment.author_name[0].toUpperCase()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-200">
            {comment.author_name}
          </span>
          {comment.is_admin && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-medium">
              author
            </span>
          )}
          <span className="text-xs text-gray-600">
            {timeAgo(comment.created_at)}
          </span>
        </div>

        <p className="mt-1 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
          {comment.body}
        </p>

        {onReply && (
          <button
            onClick={() => onReply(comment.id, comment.author_name)}
            className="mt-1.5 text-xs text-gray-500 hover:text-purple-400 transition-colors"
          >
            reply
          </button>
        )}
      </div>
    </motion.div>
  );
}
