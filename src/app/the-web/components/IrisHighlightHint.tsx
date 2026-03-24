'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

/**
 * Subtle hint at the top of blog posts telling readers they can
 * highlight text to interact with Iris.
 */
export default function IrisHighlightHint() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-500/[0.08] to-emerald-500/[0.08] border border-white/[0.06] mb-8">
      <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-blue-400 to-emerald-400 flex-shrink-0" />
      <p className="text-xs text-white/50 flex-1">
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 font-medium">Highlight any text</span>
        {' '}to share your thoughts, challenge an idea, or dig deeper with Iris — then leave a comment or message Mike directly
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
      >
        <X className="w-2.5 h-2.5 text-white/30" />
      </button>
    </div>
  );
}
