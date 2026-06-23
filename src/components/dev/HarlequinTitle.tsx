'use client';

import { Limelight } from 'next/font/google';
import { ArrowLeft } from 'lucide-react';
import { GOOGLE_COLORS } from '@/lib/dev/uiMeta';
import { TypeIn } from '@/components/dev/entrance/TypeIn';

// Art Deco / 1930s-marquee display face for the wordmark only.
const marquee = Limelight({ weight: '400', subsets: ['latin'], display: 'swap' });

/**
 * THE HARLEQUIN wordmark — champagne duotone. The Google palette no longer
 * floods the letters; it only *flickers* in: the trailing diamond cycles the
 * four hues once on load, then settles to champagne. The leading diamond is a
 * hidden back affordance: on hover it crossfades into a red arrow home.
 */
export function HarlequinTitle({
  onBack,
  onBackHover,
  entrance = false,
}: {
  onBack?: () => void;
  onBackHover?: () => void;
  entrance?: boolean;
}) {
  return (
    <h1 className="flex items-center gap-2 select-none">
      {/* The back-diamond plays the diamond-ash exit (which then navigates to
          `/`); the session is kept. The leading diamond crossfades to a red
          arrow home on hover. Hovering also refreshes the eager board snapshot
          so the disintegration cover is instant on click. */}
      <button
        type="button"
        onClick={onBack}
        onMouseEnter={onBackHover}
        onFocus={onBackHover}
        aria-label="Back to mikeveson.com"
        className="group relative grid h-6 w-6 cursor-pointer place-items-center"
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
      </button>
      <span className={`${marquee.className} text-3xl tracking-[0.18em] text-[#E7E2D4]`}>
        {entrance ? <TypeIn text="THE HARLEQUIN" active durationMs={520} startDelayMs={260} caret={false} /> : 'THE HARLEQUIN'}
      </span>
      <span aria-hidden className="harlequin-diamond-flicker text-base">
        ◆
      </span>
    </h1>
  );
}
