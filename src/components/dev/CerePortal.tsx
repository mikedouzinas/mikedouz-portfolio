'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Playfair_Display } from 'next/font/google';
import { CereSwirlCanvas } from './CereSwirlCanvas';

// The Cere wordmark face from the approved lockup (non-italic Playfair Display).
const playfair = Playfair_Display({ weight: '500', subsets: ['latin'], display: 'swap' });

/**
 * The Cere trigger — the /dev header's tall right-rail element. A green/navy
 * swirl (CereSwirlCanvas) fills a tall rounded pill spanning both header rows,
 * behind a champagne double-stroke ring, a depth veil, and the centered
 * non-italic "Cere" wordmark.
 *
 * Hover: spring bounce that grows the pill in-place — matching PortalCircle's
 * cubic-bezier(0.34, 1.56, 0.64, 1) character via Framer Motion's spring.
 * No ContainedMouseGlow, no spin gesture. onClick opens the Cere panel.
 */
export function CerePortal({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label="Open Cere"
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      animate={hovered ? { scale: 1.055 } : { scale: 1 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 18,
        mass: 0.8,
      }}
      whileTap={{ scale: 0.97 }}
      className={`cere-portal-tall ${playfair.className}`}
      style={{ originX: '50%', originY: '50%' }}
    >
      {/* swirl fill */}
      <span className="cere-tall-ring" aria-hidden>
        <CereSwirlCanvas />
        <span className="cere-tall-veil" aria-hidden />
      </span>

      {/* wordmark */}
      <span className={`cere-tall-mark ${playfair.className}`} aria-hidden>
        Cere
      </span>

      <style jsx>{`
        .cere-portal-tall {
          position: relative;
          /* width is fixed; height is set to 100% so it stretches with the parent */
          width: 64px;
          height: 100%;
          min-height: 56px;
          display: grid;
          place-items: center;
          border-radius: 18px;
          border: none;
          background: none;
          padding: 0;
          cursor: pointer;
          /* filter glow on hover handled inline via filter style below */
          filter: drop-shadow(0 0 0px rgba(60, 168, 120, 0));
          transition: filter 220ms ease;
          flex-shrink: 0;
        }
        .cere-portal-tall:hover {
          filter: drop-shadow(0 0 12px rgba(60, 168, 120, 0.5));
        }
        .cere-tall-ring {
          position: absolute;
          inset: 0;
          border-radius: 18px;
          overflow: hidden;
          background-color: #061612;
          box-shadow:
            0 0 0 1.5px rgba(231, 226, 212, 0.55),
            0 0 0 3px rgba(6, 22, 18, 0.95),
            0 0 0 4px rgba(231, 226, 212, 0.18),
            inset 0 0 28px 8px rgba(0, 0, 0, 0.55);
        }
        .cere-tall-veil {
          position: absolute;
          inset: 0;
          border-radius: 18px;
          background: radial-gradient(
            ellipse at 50% 45%,
            transparent 0%,
            rgba(6, 22, 18, 0.38) 52%,
            rgba(6, 22, 18, 0.78) 100%
          );
          z-index: 2;
        }
        .cere-tall-mark {
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
