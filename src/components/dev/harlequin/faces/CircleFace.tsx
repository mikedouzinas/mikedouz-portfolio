'use client';

import { useCallback, useRef } from 'react';
import { Limelight } from 'next/font/google';
import { PasscodeFields } from '../PasscodeFields';
import type { FaceProps } from './faceTypes';

// Limelight = THE HARLEQUIN wordmark.
const limelight = Limelight({ weight: '400', subsets: ['latin'], display: 'swap' });

/**
 * CIRCLE face — a verbatim port of the approved circle lockup, sized for the
 * project card per `card-comparison.html` (Option 1 — Circle): 128px diameter,
 * argyle tile 32px, ghost wordmark 11px @ rgba(231,226,212,0.32). The ring /
 * fill / veil / glow CSS and the spin/glow behavior are the same proven
 * treatment shipped in `PortalCircle.tsx`; only the dimensions are the card
 * variant from the comparison lockup. The passcode panel is centered.
 */
export function CircleFace({ passcode, spin, revealed, onLeave, onReveal }: FaceProps) {
  const {
    password,
    error,
    busy,
    filledDots,
    inputRef,
    focusInput,
    onChange,
    submit,
  } = passcode;
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const glowInnerRef = useRef<HTMLDivElement | null>(null);

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (glowInnerRef.current) {
        glowInnerRef.current.style.left = `${x}px`;
        glowInnerRef.current.style.top = `${y}px`;
      }
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const angle = Math.atan2(y - cy, x - cx); // -π .. π
      spin.feed(angle);
    },
    [spin],
  );

  return (
    <div
      ref={wrapRef}
      className="circle-portal"
      onMouseEnter={(e) => e.currentTarget.classList.add('hov')}
      onMouseLeave={(e) => {
        e.currentTarget.classList.remove('hov');
        onLeave();
      }}
      onMouseMove={onMouseMove}
      role="button"
      tabIndex={0}
      aria-label="Enter THE HARLEQUIN"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onReveal();
        }
      }}
    >
      <div className="circle-ring">
        <div className="circle-fill" aria-hidden />
        <div className="circle-veil" aria-hidden />
        <div className="circle-glow" aria-hidden>
          <div ref={glowInnerRef} className="circle-glow-inner" />
        </div>
      </div>

      <div className={`circle-ghost${revealed ? ' hidden' : ''}`} aria-hidden>
        <span className={limelight.className}>
          THE
          <br />
          HARLEQUIN
        </span>
      </div>

      {/* passcode panel — centered (verbatim from PortalCircle passcode block) */}
      <form
        className={`passcode-panel${revealed ? ' visible' : ''}`}
        onSubmit={submit}
        autoComplete="off"
        onClick={() => revealed && focusInput()}
      >
        <PasscodeFields
          ref={inputRef}
          inputId="dev-portal-code-circle"
          filledDots={filledDots}
          password={password}
          busy={busy}
          error={error}
          onChange={onChange}
        />
      </form>

      <style jsx>{`
        /* ── verbatim from card-comparison.html (Option 1 — Circle) ── */
        .circle-portal {
          position: relative;
          width: 144px;
          height: 144px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          cursor: crosshair;
          outline: none;
          transform-origin: center;
          transition: transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .circle-portal.hov {
          /* scale from center (no reflow) so it expands uniformly and never grows
             the card/row height — same fix as the diamond */
          transform: scale(1.094);
        }
        .circle-portal:focus-visible {
          box-shadow: 0 0 0 2px rgba(231, 226, 212, 0.6);
          border-radius: 50%;
        }
        .circle-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          box-shadow: 0 0 0 1px rgba(231, 226, 212, 0.5),
            0 0 0 2.5px rgba(13, 11, 17, 0.95),
            0 0 0 4px rgba(231, 226, 212, 0.16),
            0 8px 24px -6px rgba(0, 0, 0, 0.85),
            inset 0 0 24px 6px rgba(0, 0, 0, 0.65);
          overflow: hidden;
          transition: box-shadow 280ms ease;
        }
        .circle-portal.hov .circle-ring {
          box-shadow: 0 0 0 1px rgba(231, 226, 212, 0.7),
            0 0 0 2.5px rgba(13, 11, 17, 0.95),
            0 0 0 4px rgba(231, 226, 212, 0.26),
            0 10px 32px -6px rgba(0, 0, 0, 0.92),
            0 0 16px 2px rgba(200, 180, 120, 0.08),
            inset 0 0 24px 6px rgba(0, 0, 0, 0.65);
        }
        .circle-fill {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          overflow: hidden;
          background-color: #0d0b11;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Cpolygon points='16,2 30,16 16,30 2,16' fill='%23B3122B' stroke='%23EDE6D6' stroke-width='0.7'/%3E%3C/svg%3E"),
            linear-gradient(rgba(231, 226, 212, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(231, 226, 212, 0.03) 1px, transparent 1px);
          background-size: 32px 32px, 80px 80px, 80px 80px;
          animation: circle-drift 12s linear infinite;
        }
        @keyframes circle-drift {
          from {
            background-position: 0 0, 0 0, 0 0;
          }
          to {
            background-position: 32px 32px, 80px 80px, 80px 80px;
          }
        }
        .circle-veil {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: radial-gradient(
            circle at 50% 45%,
            transparent 0%,
            rgba(13, 11, 17, 0.48) 52%,
            rgba(13, 11, 17, 0.85) 100%
          );
          z-index: 2;
        }
        .circle-ghost {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 5;
          font-size: 11px;
          letter-spacing: 0.16em;
          text-align: center;
          line-height: 1.7;
          color: rgba(231, 226, 212, 0.32);
          pointer-events: none;
          user-select: none;
          transition: opacity 200ms;
        }
        .circle-ghost.hidden {
          opacity: 0;
        }
        .circle-glow {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          overflow: hidden;
          pointer-events: none;
          z-index: 3;
          opacity: 0;
          transition: opacity 250ms ease;
        }
        .circle-portal.hov .circle-glow {
          opacity: 1;
        }
        .circle-glow-inner {
          position: absolute;
          width: 90px;
          height: 90px;
          transform: translate(-50%, -50%);
          background: radial-gradient(
            circle,
            rgba(231, 220, 180, 0.28) 0%,
            transparent 70%
          );
          filter: blur(18px);
          pointer-events: none;
        }

        /* passcode panel — positioning only; inner-element styles live in PasscodeFields.tsx */
        .passcode-panel {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          z-index: 8;
          pointer-events: none;
          opacity: 0;
          transition: opacity 300ms ease;
          border: none;
          background: none;
        }
        .passcode-panel.visible {
          opacity: 1;
          pointer-events: all;
        }
        @media (prefers-reduced-motion: reduce) {
          .circle-fill {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
