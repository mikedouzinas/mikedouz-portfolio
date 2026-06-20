'use client';

import { motion } from 'framer-motion';
import { Playfair_Display } from 'next/font/google';
import { CereSwirlCanvas } from './CereSwirlCanvas';

// The Cere wordmark face from the approved lockup (non-italic Playfair Display).
const playfair = Playfair_Display({ weight: '500', subsets: ['latin'], display: 'swap' });

/**
 * The Cere trigger — the /dev header's tall right-rail element. A circle whose
 * diameter equals the two-row header height (via `aspect-ratio: 1 / 1` +
 * `align-self: stretch`). A green/navy swirl (CereSwirlCanvas) fills the
 * circle behind a champagne double-stroke ring, a depth veil, and the centered
 * non-italic "Cere" wordmark.
 *
 * Layout: the parent `<div class="flex items-stretch gap-4">` gives this button
 * its height. `aspect-ratio: 1 / 1` makes width equal height automatically,
 * yielding a true circle. `flex-shrink: 0` and NO flex-grow prevent it from
 * taking up bar width.
 *
 * Hover: Framer `whileHover={{ scale }}` spring on transform only — no
 * width/height animation, so there's zero layout thrash or glitch.
 * No ContainedMouseGlow, no spin gesture. onClick opens the Cere panel.
 */
export function CerePortal({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label="Open Cere"
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.97 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 18,
        mass: 0.8,
      }}
      className={`cere-portal-circle ${playfair.className}`}
      style={{ originX: '50%', originY: '50%' }}
    >
      {/* swirl fill + double-stroke ring */}
      <span className="cere-ring" aria-hidden>
        <CereSwirlCanvas />
        <span className="cere-veil" aria-hidden />
      </span>

      {/* wordmark */}
      <span className={`cere-mark ${playfair.className}`} aria-hidden>
        Cere
      </span>

      <style jsx>{`
        .cere-portal-circle {
          /* Circle sizing: stretch to the flex row height, aspect-ratio keeps
             width == height so it's always a perfect circle.            */
          align-self: stretch;
          aspect-ratio: 1 / 1;
          flex-shrink: 0;
          /* NO flex-grow — must not fill the bar */
          position: relative;
          display: grid;
          place-items: center;
          border-radius: 9999px;
          border: none;
          background: none;
          padding: 0;
          cursor: pointer;
          filter: drop-shadow(0 0 0px rgba(60, 168, 120, 0));
          transition: filter 220ms ease;
          /* transform-origin is set via Framer style prop above */
        }
        .cere-portal-circle:hover {
          filter: drop-shadow(0 0 14px rgba(60, 168, 120, 0.5));
        }
        .cere-ring {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          overflow: hidden;
          background-color: #061612;
          box-shadow:
            0 0 0 1.5px rgba(231, 226, 212, 0.55),
            0 0 0 3px rgba(6, 22, 18, 0.95),
            0 0 0 4px rgba(231, 226, 212, 0.18),
            inset 0 0 28px 8px rgba(0, 0, 0, 0.55);
        }
        .cere-veil {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          background: radial-gradient(
            ellipse at 50% 45%,
            transparent 0%,
            rgba(6, 22, 18, 0.38) 52%,
            rgba(6, 22, 18, 0.78) 100%
          );
          z-index: 2;
        }
        .cere-mark {
          position: relative;
          z-index: 3;
          font-size: 13px;
          line-height: 1;
          letter-spacing: 0.05em;
          color: rgba(180, 230, 210, 0.9);
          text-shadow: 0 0 10px rgba(80, 200, 160, 0.25);
          pointer-events: none;
          user-select: none;
        }
      `}</style>
    </motion.button>
  );
}
