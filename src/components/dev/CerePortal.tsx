'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Playfair_Display } from 'next/font/google';
import { CereSwirlCanvas } from './CereSwirlCanvas';

// The Cere wordmark face from the approved lockup (non-italic Playfair Display).
const playfair = Playfair_Display({ weight: '500', subsets: ['latin'], display: 'swap' });

/**
 * The Cere trigger — the /dev header's right-rail element. A CIRCLE whose
 * diameter equals the two-row header height: `self-stretch` takes the flex row
 * height, `aspect-square` makes width == height, `rounded-full` rounds it, and
 * `shrink-0` (no grow) stops it eating bar width. A green/navy swirl
 * (CereSwirlCanvas) fills the circle behind a champagne double-stroke ring, a
 * depth veil, and the centered non-italic "Cere" wordmark.
 *
 * Critical layout uses Tailwind + inline styles (NOT styled-jsx): a `<style jsx>`
 * block placed on a Framer `motion.button` does not get scoped/applied, which
 * previously dropped `position:relative` and let the absolute canvas escape to
 * full-page width. `relative` here keeps the swirl/ring/veil contained.
 *
 * Hover: Framer `whileHover` spring on transform only — no width/height
 * animation, so zero layout thrash. No glow, no spin. onClick opens Cere.
 */
export function CerePortal({ onClick }: { onClick: () => void }) {
  const ref = useRef<HTMLButtonElement | null>(null);
  // The circle's diameter = the stretched flex-row height. `aspect-ratio` loses
  // to content-based width in a flex row, so measure the height and set width to
  // match. setState only inside the ResizeObserver callback (external signal).
  const [diameter, setDiameter] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDiameter(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label="Open Cere"
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18, mass: 0.8 }}
      className="relative grid shrink-0 cursor-pointer place-items-center self-stretch overflow-hidden rounded-full border-0 bg-transparent p-0"
      style={{ transformOrigin: '50% 50%', width: diameter ? `${diameter}px` : undefined }}
    >
      {/* swirl fill (absolute, contained by this relative+overflow-hidden circle) */}
      <CereSwirlCanvas />

      {/* champagne double-stroke ring */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          boxShadow:
            '0 0 0 1.5px rgba(231,226,212,0.55), 0 0 0 3px rgba(6,22,18,0.95), 0 0 0 4px rgba(231,226,212,0.18), inset 0 0 28px 8px rgba(0,0,0,0.55)',
        }}
      />

      {/* depth veil */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(ellipse at 50% 45%, transparent 0%, rgba(6,22,18,0.38) 52%, rgba(6,22,18,0.78) 100%)',
        }}
      />

      {/* wordmark */}
      <span
        aria-hidden
        className={`relative z-[3] leading-none ${playfair.className}`}
        style={{
          fontSize: 13,
          letterSpacing: '0.05em',
          color: 'rgba(180,230,210,0.9)',
          textShadow: '0 0 10px rgba(80,200,160,0.25)',
          userSelect: 'none',
        }}
      >
        Cere
      </span>
    </motion.button>
  );
}
