'use client';

import { HarlequinPortalCard } from './HarlequinPortalCard';
import { HARLEQUIN_SHAPES } from './shapes';

/**
 * Renders THE HARLEQUIN portal as project card(s) in the Projects list.
 *
 * ── STAGE 1 (current): render ALL THREE shapes (circle, diamond, window),
 *    grouped together so Mike can compare them live on the homepage.
 *
 * ── STAGE 2 (seam): swap to ONE random entry per load. The registry is already
 *    ordered and the card is shape-agnostic, so Stage 2 is a one-line change —
 *    replace the map below with the commented pick. Kept here (not in page.tsx)
 *    so the projects list wiring never changes between stages.
 *
 *    // STAGE 2 — render one random shape per page load:
 *    // const [shape] = useState(
 *    //   () => HARLEQUIN_SHAPES[Math.floor(Math.random() * HARLEQUIN_SHAPES.length)],
 *    // );
 *    // return <HarlequinPortalCard shape={shape.id} />;
 */
export function HarlequinPortalCards() {
  // STAGE 1 — all three, in registry order.
  return (
    <>
      {HARLEQUIN_SHAPES.map((shape) => (
        <HarlequinPortalCard key={shape.id} shape={shape.id} />
      ))}
    </>
  );
}
