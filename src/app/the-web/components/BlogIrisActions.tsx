'use client';

import { MessageSquare, Send } from 'lucide-react';

interface BlogIrisActionsProps {
  onComment: () => void;
  onMessage: () => void;
  disabled?: boolean;
}

export default function BlogIrisActions({ onComment, onMessage, disabled }: BlogIrisActionsProps) {
  return (
    <div className="flex gap-1.5 flex-wrap mb-2.5">
      <button
        onClick={onComment}
        disabled={disabled}
        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 transform bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:scale-105 disabled:opacity-50 disabled:scale-100"
      >
        <MessageSquare className="w-3.5 h-3.5" />
        Leave a comment
      </button>
      <button
        onClick={onMessage}
        disabled={disabled}
        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 transform bg-gradient-to-r from-sky-500 to-indigo-600 text-white hover:scale-105 disabled:opacity-50 disabled:scale-100"
      >
        <Send className="w-3.5 h-3.5" />
        Message Mike
      </button>
    </div>
  );
}
