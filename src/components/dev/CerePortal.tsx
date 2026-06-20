'use client';

import { Playfair_Display } from 'next/font/google';
import { CereSwirlCanvas } from './CereSwirlCanvas';

// The Cere wordmark face from the approved lockup (non-italic Playfair Display).
const playfair = Playfair_Display({ weight: '500', subsets: ['latin'], display: 'swap' });

/**
 * The Cere trigger — the top-right /dev entry point. This is the approved
 * lockup's "Cere mode" circle: a swirling forest-green + deep-navy animated
 * canvas behind a champagne double-stroke ring, a depth veil, and the centered
 * non-italic "Cere" wordmark. Clicking opens the Cere panel (behavior unchanged
 * from the old spinning-diamond version; only the visual was swapped).
 */
export function CerePortal({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Open Cere" className="cere-portal-v2">
      <span className="cere-portal-v2-ring" aria-hidden>
        <CereSwirlCanvas />
        <span className="cere-portal-v2-veil" aria-hidden />
      </span>
      <span className={`cere-portal-v2-mark ${playfair.className}`} aria-hidden>
        Cere
      </span>

      <style jsx>{`
        .cere-portal-v2 {
          position: relative;
          height: 28px;
          width: 28px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          border: none;
          background: none;
          padding: 0;
          cursor: pointer;
          transition: transform 0.2s ease, filter 0.2s ease;
        }
        .cere-portal-v2:hover {
          transform: scale(1.06);
          filter: drop-shadow(0 0 10px rgba(60, 168, 120, 0.45));
        }
        .cere-portal-v2:active {
          transform: scale(0.97);
        }
        .cere-portal-v2-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          overflow: hidden;
          background-color: #061612;
          box-shadow: 0 0 0 1.5px rgba(231, 226, 212, 0.55),
            0 0 0 3px rgba(6, 22, 18, 0.95), 0 0 0 4px rgba(231, 226, 212, 0.18),
            inset 0 0 14px 4px rgba(0, 0, 0, 0.6);
        }
        .cere-portal-v2-veil {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: radial-gradient(
            circle at 50% 45%,
            transparent 0%,
            rgba(6, 22, 18, 0.45) 52%,
            rgba(6, 22, 18, 0.85) 100%
          );
          z-index: 2;
        }
        .cere-portal-v2-mark {
          position: relative;
          z-index: 3;
          font-size: 9px;
          line-height: 1;
          letter-spacing: 0.04em;
          color: rgba(180, 230, 210, 0.85);
          text-shadow: 0 0 8px rgba(80, 200, 160, 0.18);
          pointer-events: none;
          user-select: none;
        }
      `}</style>
    </button>
  );
}
