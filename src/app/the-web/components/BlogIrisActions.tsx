'use client';

interface BlogIrisActionsProps {
  onComment: () => void;
  onMessage: () => void;
  disabled?: boolean;
}

export default function BlogIrisActions({ onComment, onMessage, disabled }: BlogIrisActionsProps) {
  return (
    <div className="flex gap-1.5 mb-2">
      <button
        onClick={onComment}
        disabled={disabled}
        className="flex items-center px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all duration-200 bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:scale-105 disabled:opacity-50 disabled:scale-100"
      >
        Add a comment
      </button>
      <button
        onClick={onMessage}
        disabled={disabled}
        className="flex items-center px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all duration-200 bg-gradient-to-r from-sky-500 to-indigo-600 text-white hover:scale-105 disabled:opacity-50 disabled:scale-100"
      >
        Message Mike
      </button>
    </div>
  );
}
