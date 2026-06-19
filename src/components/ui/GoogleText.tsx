'use client';

import { GOOGLE_COLORS } from '@/lib/dev/uiMeta';

/**
 * Renders text with letters cycling the Google palette — the recurring
 * HARLEQUIN accent (wordmark, "File it", etc.).
 *
 * `overrides` pins specific visible-letter indices (spaces don't count) to an
 * exact color, e.g. {1: '#FBBC05', 2: '#EA4335'} to make "File it"'s first "i"
 * yellow and its "l" red.
 */
export function GoogleText({
  text,
  className = '',
  overrides,
}: {
  text: string;
  className?: string;
  overrides?: Record<number, string>;
}) {
  const chars = text.split('');
  return (
    <span className={className}>
      {chars.map((ch, idx) => {
        if (ch === ' ') return <span key={idx}>&nbsp;</span>;
        // Visible-letter index (spaces don't count) computed without mutation.
        const i = chars.slice(0, idx).filter((c) => c !== ' ').length;
        const color = overrides?.[i] ?? GOOGLE_COLORS[i % GOOGLE_COLORS.length];
        return (
          <span key={idx} style={{ color }}>
            {ch}
          </span>
        );
      })}
    </span>
  );
}
