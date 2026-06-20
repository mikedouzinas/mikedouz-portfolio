'use client';

import { Poiret_One } from 'next/font/google';

// Cere's wordmark face: a thin art-deco geometric — a quiet companion to THE
// HARLEQUIN's Limelight marquee, distinct enough not to twin it. (Not Marcellus.)
const wordmark = Poiret_One({ weight: '400', subsets: ['latin'], display: 'swap' });

/**
 * The Cere wordmark — just the name, in champagne. `sm` for the board button,
 * `md` for the panel header. The old Cerberus-diamond glyph was dropped.
 */
export function CereMark({ size = 'md', className = '' }: { size?: 'sm' | 'md'; className?: string }) {
  const textClass = size === 'sm' ? 'text-base' : 'text-lg';
  return (
    <span className={`${wordmark.className} ${textClass} leading-none tracking-[0.22em] text-[#E7E2D4] ${className}`}>
      Cere
    </span>
  );
}
