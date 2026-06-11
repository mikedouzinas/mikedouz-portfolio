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
  let i = 0;
  return (
    <span className={className}>
      {text.split('').map((ch, idx) => {
        if (ch === ' ') return <span key={idx}>&nbsp;</span>;
        const color = overrides?.[i] ?? GOOGLE_COLORS[i % GOOGLE_COLORS.length];
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
