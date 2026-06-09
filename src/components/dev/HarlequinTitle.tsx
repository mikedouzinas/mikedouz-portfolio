'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { GoogleText } from '@/components/ui/GoogleText';
import { GOOGLE_COLORS } from '@/lib/dev/uiMeta';

/**
 * THE HARLEQUIN wordmark. The leading diamond is a hidden back affordance:
 * on hover it crossfades into a red arrow that returns to mikeveson.com.
 */
export function HarlequinTitle() {
  return (
    <h1 className="flex items-center gap-2 select-none">
      <Link
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
      </Link>
      <GoogleText text="THE HARLEQUIN" className="text-2xl font-extrabold tracking-[0.22em]" />
      <span aria-hidden className="text-base" style={{ color: GOOGLE_COLORS[3] }}>
        ◆
      </span>
    </h1>
  );
}
