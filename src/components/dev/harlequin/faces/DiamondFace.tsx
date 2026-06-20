'use client';

import { useCallback, useRef } from 'react';
import { Limelight } from 'next/font/google';
import { PasscodeFields } from '../PasscodeFields';
import type { FaceProps } from './faceTypes';

const limelight = Limelight({ weight: '400', subsets: ['latin'], display: 'swap' });

/**
 * DIAMOND face — a verbatim port of the `variant-c2.html` lockup (a square
 * rotated 45° with counter-rotated content), sized for the card per
 * `card-comparison.html` (Option 2 — Diamond): 104px square side, 148px
 * bounding box, argyle tile 22px, ghost 10px @ rgba(231,226,212,0.32). The
 * cursor-tracking glow uses the lockup's exact ring-local rotation math
 * (rotate the cursor offset -45° into diamond-local coords); spin detection
 * uses wrap-relative coords. The passcode panel is counter-rotated -45°.
 */
export function DiamondFace({ passcode, spin, revealed, onLeave, onReveal }: FaceProps) {
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
  const ringRef = useRef<HTMLDivElement | null>(null);
  const glowInnerRef = useRef<HTMLDivElement | null>(null);

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // cursor-tracking glow inside diamond — rotate -45° into diamond-local
      // coords (verbatim from variant-c2.html mousemove handler).
      const ring = ringRef.current;
      if (ring) {
        const ringRect = ring.getBoundingClientRect();
        const cx = ringRect.left + ringRect.width / 2;
        const cy = ringRect.top + ringRect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const rad = -Math.PI / 4;
        const lx = dx * Math.cos(rad) - dy * Math.sin(rad) + ringRect.width / 2;
        const ly = dx * Math.sin(rad) + dy * Math.cos(rad) + ringRect.height / 2;
        if (glowInnerRef.current) {
          glowInnerRef.current.style.left = `${lx}px`;
          glowInnerRef.current.style.top = `${ly}px`;
        }
      }

      // spin detection uses wrap-relative coords (verbatim from variant-c2).
      const wrap = wrapRef.current;
      if (!wrap) return;
      const wrapRect = wrap.getBoundingClientRect();
      const wx = e.clientX - wrapRect.left;
      const wy = e.clientY - wrapRect.top;
      const wcx = wrapRect.width / 2;
      const wcy = wrapRect.height / 2;
      const angle = Math.atan2(wy - wcy, wx - wcx);
      spin.feed(angle);
    },
    [spin],
  );

  return (
    <div
      ref={wrapRef}
      className="diamond-portal"
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
      {/* the rotated square that IS the diamond */}
      <div className="portal-diamond">
        <div ref={ringRef} className="diamond-ring">
          <div className="diamond-fill" aria-hidden />
          <div className="diamond-veil" aria-hidden />
          <div className="diamond-glow" aria-hidden>
            <div ref={glowInnerRef} className="diamond-glow-inner" />
          </div>
        </div>

        {/* ghost wordmark — counter-rotated -45° to read upright */}
        <div className={`diamond-ghost${revealed ? ' hidden' : ''}`} aria-hidden>
          <span className={limelight.className}>
            THE
            <br />
            HARLEQUIN
          </span>
        </div>

        {/* passcode panel — counter-rotated -45° inside the diamond */}
        <form
          className={`passcode-panel${revealed ? ' visible' : ''}`}
          onSubmit={submit}
          autoComplete="off"
          onClick={() => revealed && focusInput()}
        >
          <PasscodeFields
            ref={inputRef}
            inputId="dev-portal-code-diamond"
            filledDots={filledDots}
            password={password}
            busy={busy}
            error={error}
            onChange={onChange}
          />
        </form>
      </div>

      <style jsx>{`
        /* ── verbatim from card-comparison.html (Option 2 — Diamond) ── */
        .diamond-portal {
          position: relative;
          /* bounding box = diagonal of square: 104*√2 ≈ 147px → 148 */
          width: 148px;
          height: 148px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          cursor: crosshair;
          outline: none;
          transition: width 280ms cubic-bezier(0.34, 1.56, 0.64, 1),
            height 280ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .diamond-portal.hov {
          width: 166px;
          height: 166px;
        }
        .diamond-portal:focus-visible {
          box-shadow: 0 0 0 2px rgba(231, 226, 212, 0.6);
        }
        .portal-diamond {
          position: absolute;
          width: 104px;
          height: 104px;
          transform: rotate(45deg);
          transition: width 280ms cubic-bezier(0.34, 1.56, 0.64, 1),
            height 280ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .diamond-portal.hov .portal-diamond {
          width: 116px;
          height: 116px;
        }
        .diamond-ring {
          position: absolute;
          inset: 0;
          box-shadow: 0 0 0 1px rgba(231, 226, 212, 0.5),
            0 0 0 2.5px rgba(13, 11, 17, 0.95),
            0 0 0 4px rgba(231, 226, 212, 0.16),
            0 8px 24px -6px rgba(0, 0, 0, 0.85),
            inset 0 0 24px 6px rgba(0, 0, 0, 0.65);
          overflow: hidden;
          transition: box-shadow 280ms ease;
        }
        .diamond-portal.hov .diamond-ring {
          box-shadow: 0 0 0 1px rgba(231, 226, 212, 0.7),
            0 0 0 2.5px rgba(13, 11, 17, 0.95),
            0 0 0 4px rgba(231, 226, 212, 0.26),
            0 10px 32px -6px rgba(0, 0, 0, 0.92),
            0 0 16px 2px rgba(200, 180, 120, 0.08),
            inset 0 0 24px 6px rgba(0, 0, 0, 0.65);
        }
        .diamond-fill {
          position: absolute;
          inset: 0;
          overflow: hidden;
          background-color: #0d0b11;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='22'%3E%3Cpolygon points='11,1 21,11 11,21 1,11' fill='%23B3122B' stroke='%23EDE6D6' stroke-width='0.6'/%3E%3C/svg%3E"),
            linear-gradient(rgba(231, 226, 212, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(231, 226, 212, 0.03) 1px, transparent 1px);
          background-size: 22px 22px, 80px 80px, 80px 80px;
          /* counter-rotate the pattern so argyle diamonds read right-side up */
          transform: rotate(-45deg) scale(1.45);
          transform-origin: center;
          animation: diamond-drift 6s linear infinite;
        }
        @keyframes diamond-drift {
          from {
            background-position: 0 0, 0 0, 0 0;
          }
          to {
            background-position: 22px 22px, 80px 80px, 80px 80px;
          }
        }
        .diamond-veil {
          position: absolute;
          inset: 0;
          background: radial-gradient(
            circle at 50% 45%,
            transparent 0%,
            rgba(13, 11, 17, 0.48) 52%,
            rgba(13, 11, 17, 0.85) 100%
          );
          z-index: 2;
        }
        .diamond-ghost {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 5;
          font-size: 10px;
          letter-spacing: 0.2em;
          text-align: center;
          line-height: 1.7;
          color: rgba(231, 226, 212, 0.32);
          pointer-events: none;
          user-select: none;
          transform: rotate(-45deg);
          transition: opacity 200ms;
        }
        .diamond-ghost.hidden {
          opacity: 0;
        }
        .diamond-glow {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 3;
          opacity: 0;
          transition: opacity 250ms ease;
        }
        .diamond-portal.hov .diamond-glow {
          opacity: 1;
        }
        .diamond-glow-inner {
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

        /* passcode entry — counter-rotated -45° inside diamond (from variant-c2) */
        .passcode-panel {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          z-index: 7;
          pointer-events: none;
          opacity: 0;
          transition: opacity 300ms ease;
          border: none;
          background: none;
          transform: rotate(-45deg);
        }
        .passcode-panel.visible {
          opacity: 1;
          pointer-events: all;
        }
        .passcode-dots {
          display: flex;
          gap: 8px;
        }
        .passcode-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          border: 1px solid rgba(231, 226, 212, 0.5);
          background: transparent;
          transition: background 150ms;
        }
        .passcode-dot.filled {
          background: rgba(231, 226, 212, 0.55);
        }
        .passcode-input {
          position: absolute;
          opacity: 0;
          width: 1px;
          height: 1px;
          pointer-events: all;
        }
        .passcode-label {
          font-size: 7px;
          letter-spacing: 0.22em;
          color: rgba(231, 226, 212, 0.35);
          text-transform: uppercase;
          margin-top: 2px;
        }
        .hq-sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        @media (prefers-reduced-motion: reduce) {
          .diamond-fill {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
