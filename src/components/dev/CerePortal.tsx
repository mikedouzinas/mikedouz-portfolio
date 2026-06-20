'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Playfair_Display } from 'next/font/google';
import { CereSwirlCanvas, type CereSwirlVariant } from './CereSwirlCanvas';

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
 * animation, so zero layout thrash. Cursor position is tracked inside the circle
 * and drives a teal radial glow that fades in (opacity 0→1) on mouseenter —
 * matching the lockup's `.cere-mode .portal-glow-inner` behavior. onClick opens Cere.
 *
 * Swirl variant: one of three color moods (0=Forest Deep, 1=Teal Drift,
 * 2=Midnight Moss) is chosen once at random per page load for visual variety.
 */
export function CerePortal({ onClick }: { onClick: () => void }) {
  const ref = useRef<HTMLButtonElement | null>(null);
  // The circle's diameter = the stretched flex-row height. `aspect-ratio` loses
  // to content-based width in a flex row, so measure the height and set width to
  // match. setState only inside the ResizeObserver callback (external signal).
  const [diameter, setDiameter] = useState<number | null>(null);

  // Hover state — drives inside glow opacity.
  const [hovered, setHovered] = useState(false);

  // Cursor position relative to the button, for glow tracking.
  const [glowPos, setGlowPos] = useState<{ x: number; y: number } | null>(null);

  // Random swirl variant chosen once per page load (lives in state so it's
  // stable across re-renders but varies session-to-session for visual variety).
  const [variant] = useState<CereSwirlVariant>(
    () => (Math.floor(Math.random() * 3) as CereSwirlVariant),
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDiameter(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function handleMouseMove(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setGlowPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label="Open Cere"
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18, mass: 0.8 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setGlowPos(null); }}
      onMouseMove={handleMouseMove}
      className="relative grid shrink-0 cursor-pointer place-items-center self-stretch overflow-hidden rounded-full border-0 bg-transparent p-0"
      style={{
        transformOrigin: '50% 50%',
        width: diameter ? `${diameter}px` : undefined,
        // Champagne double-stroke ring on the BUTTON itself — an element's own
        // box-shadow is NOT clipped by its overflow-hidden (which only clips
        // children), so the border is actually visible. Matches the home circle.
        boxShadow:
          '0 0 0 1.5px rgba(231,226,212,0.6), 0 0 0 3px rgba(6,22,18,0.95), 0 0 0 4.5px rgba(231,226,212,0.22)',
      }}
    >
      {/* swirl fill (absolute, contained by this relative+overflow-hidden circle) */}
      <CereSwirlCanvas variant={variant} />

      {/* depth veil — matches lockup's .cere-mode .portal-veil */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 50% 45%, transparent 0%, rgba(6,22,18,0.45) 52%, rgba(6,22,18,0.85) 100%)',
          zIndex: 1,
        }}
      />

      {/*
       * Cursor-tracking inside glow — matches lockup's .portal-glow + .cere-mode .portal-glow-inner.
       * Clipped to the circle by parent overflow-hidden. Fades opacity 0→1 on hover.
       * The radial spot follows the mouse within the circle.
       */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
        style={{
          opacity: hovered ? 1 : 0,
          transition: 'opacity 280ms ease-out',
          zIndex: 2,
          // A radial-gradient BACKGROUND (no filter:blur) clips cleanly to the
          // circle — a blurred child bleeds past an overflow:hidden border-radius,
          // which made the highlight appear OUTSIDE the circle. This keeps it inside.
          background: glowPos
            ? `radial-gradient(circle 72px at ${glowPos.x}px ${glowPos.y}px, rgba(110,225,185,0.32) 0%, rgba(60,160,140,0.13) 45%, transparent 72%)`
            : 'none',
        }}
      />

      {/* champagne double-stroke ring — on top of glow */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          boxShadow: 'inset 0 0 28px 8px rgba(0,0,0,0.55)',
          zIndex: 3,
        }}
      />

      {/* wordmark */}
      <span
        aria-hidden
        className={`relative leading-none ${playfair.className}`}
        style={{
          fontSize: 13,
          letterSpacing: '0.05em',
          color: 'rgba(180,230,210,0.9)',
          textShadow: '0 0 10px rgba(80,200,160,0.25)',
          userSelect: 'none',
          zIndex: 4,
        }}
      >
        Cere
      </span>
    </motion.button>
  );
}
