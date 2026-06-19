'use client';

import { Poiret_One } from 'next/font/google';

// Cere's wordmark face: a thin art-deco geometric — a quiet companion to THE
// HARLEQUIN's Limelight marquee, distinct enough not to twin it. (Not Marcellus.)
const wordmark = Poiret_One({ weight: '400', subsets: ['latin'], display: 'swap' });

// Size presets echo the portal circle: a champagne-ringed disc with "Cere" at center.
const SIZES = {
  sm: { box: 28, fontPx: 9 },
  md: { box: 36, fontPx: 12 },
} as const;

/**
 * The Cere mark — a small circular badge that echoes the portal circle: a
 * champagne-ringed disc over the dark ink, with "Cere" centered (non-italic).
 * `sm` for the board button, `md` for the panel header.
 */
export function CereMark({ size = 'md', className = '' }: { size?: 'sm' | 'md'; className?: string }) {
  const dims = SIZES[size];
  return (
    <span
      aria-label="Cere"
      role="img"
      className={`relative inline-grid place-items-center overflow-hidden rounded-full ${className}`}
      style={{
        width: dims.box,
        height: dims.box,
        backgroundColor: '#0d0b11',
        boxShadow:
          '0 0 0 1.5px rgba(231,226,212,0.65), 0 0 0 3px rgba(13,11,17,0.9), 0 0 0 4px rgba(231,226,212,0.22)',
      }}
    >
      <span
        aria-hidden
        className={`${wordmark.className} leading-none tracking-[0.12em] text-[#E7E2D4]`}
        style={{ fontSize: dims.fontPx }}
      >
        Cere
      </span>
    </span>
  );
}
