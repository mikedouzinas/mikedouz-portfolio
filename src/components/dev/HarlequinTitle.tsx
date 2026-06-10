'use client';

import { Limelight } from 'next/font/google';
import { ArrowLeft } from 'lucide-react';
import { GOOGLE_COLORS } from '@/lib/dev/uiMeta';

// Art Deco / 1930s-marquee display face for the wordmark only.
const marquee = Limelight({ weight: '400', subsets: ['latin'], display: 'swap' });

/**
 * THE HARLEQUIN wordmark — champagne duotone. The Google palette no longer
 * floods the letters; it only *flickers* in: the trailing diamond cycles the
 * four hues once on load, then settles to champagne. The leading diamond is a
 * hidden back affordance: on hover it crossfades into a red arrow home.
 */
export function HarlequinTitle() {
  return (
    <h1 className="flex items-center gap-2 select-none">
      {/* Full navigation (not client-side) so home loads completely. */}
      <a
        href="/"
        aria-label="Back to mikeveson.com"
        className="group relative grid h-6 w-6 place-items-center"
      >
        <span
          aria-hidden
          className="absolute text-base transition-opacity duration-200 group-hover:opacity-0"
          style={{ color: GOOGLE_COLORS[1] }}
        >
          ◆
        </span>
        <ArrowLeft
          aria-hidden
          className="absolute h-5 w-5 text-red-500 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        />
      </a>
      <span className={`${marquee.className} text-3xl tracking-[0.18em] text-[#E7E2D4]`}>
        THE HARLEQUIN
      </span>
      <span aria-hidden className="harlequin-diamond-flicker text-base">
        ◆
      </span>
    </h1>
  );
}
