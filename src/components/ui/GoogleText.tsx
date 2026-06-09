'use client';

import { GOOGLE_COLORS } from '@/lib/dev/uiMeta';

/**
 * Renders text with letters cycling the Google palette — the recurring
 * HARLEQUIN accent (wordmark, "File it", etc.).
 */
export function GoogleText({ text, className = '' }: { text: string; className?: string }) {
  let i = 0;
  return (
    <span className={className}>
      {text.split('').map((ch, idx) => {
        if (ch === ' ') return <span key={idx}>&nbsp;</span>;
        const color = GOOGLE_COLORS[i % GOOGLE_COLORS.length];
        i += 1;
        return (
          <span key={idx} style={{ color }}>
            {ch}
          </span>
        );
      })}
    </span>
  );
}
