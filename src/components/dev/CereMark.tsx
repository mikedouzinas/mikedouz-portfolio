'use client';

import { Limelight } from 'next/font/google';

// Same 1930s art-deco marquee face as THE HARLEQUIN wordmark — Cere is its twin,
// so it shares the theater typography but wears its own underworld colours.
const marquee = Limelight({ weight: '400', subsets: ['latin'], display: 'swap' });

/**
 * Three diamonds = Cerberus's three heads, rendered in the harlequin diamond
 * motif. The centre head is garnet (the dominant/analytical one), flanked by
 * two harvest-gold heads — a nod to Ceres. Deliberately NOT the Google palette.
 */
function CerberusDiamonds({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 16" className={className} aria-hidden="true">
      <polygon points="5,4 9,8 5,12 1,8" fill="#D9A441" />
      <polygon points="27,4 31,8 27,12 23,8" fill="#D9A441" />
      <polygon points="16,1 23,8 16,15 9,8" fill="#B23A48" />
    </svg>
  );
}

/**
 * The Cere wordmark — three-headed diamond glyph + the name in art-deco type.
 * `sm` for the board button, `md` for the panel header.
 */
export function CereMark({ size = 'md', className = '' }: { size?: 'sm' | 'md'; className?: string }) {
  const textClass = size === 'sm' ? 'text-base' : 'text-lg';
  const iconClass = size === 'sm' ? 'h-3' : 'h-3.5';
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <CerberusDiamonds className={`${iconClass} w-auto`} />
      <span className={`${marquee.className} ${textClass} leading-none tracking-[0.16em] text-[#E6B84C]`}>
        Cere
      </span>
    </span>
  );
}
