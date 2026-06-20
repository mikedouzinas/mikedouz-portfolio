'use client';

import { useEffect, useState } from 'react';
import { HarlequinPortalCard } from './HarlequinPortalCard';
import { HARLEQUIN_SHAPES } from './shapes';

/**
 * Renders THE HARLEQUIN portal as ONE project card in the Projects list, showing
 * a RANDOM shape (circle / diamond / window) per page load.
 *
 * The random shape MUST be chosen post-mount, never in a useState initializer or
 * during render: that code runs on the server and the client independently, so a
 * random pick there produces different shapes → a hydration mismatch (the same
 * class of bug as the loader's). So: SSR and the first client render agree
 * (shape index null → a stable default, kept invisible), then the client picks a
 * random shape and fades it in. The card is always present in the DOM, so the
 * list layout stays put; only the chosen shape is ever visible.
 */
export function HarlequinPortalCards() {
  const [shapeIndex, setShapeIndex] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional post-mount randomization to avoid an SSR/client hydration mismatch
    setShapeIndex(Math.floor(Math.random() * HARLEQUIN_SHAPES.length));
  }, []);

  const shape = HARLEQUIN_SHAPES[shapeIndex ?? 0];

  return (
    <div
      style={{
        opacity: shapeIndex === null ? 0 : 1,
        transition: 'opacity 220ms ease',
      }}
    >
      <HarlequinPortalCard key={shape.id} shape={shape.id} />
    </div>
  );
}
