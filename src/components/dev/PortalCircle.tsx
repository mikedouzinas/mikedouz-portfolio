'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Limelight, Space_Mono } from 'next/font/google';

// Faces from the approved lockup. Limelight = THE HARLEQUIN wordmark,
// Space Mono = the "enter code" label and the spin hint.
const limelight = Limelight({ weight: '400', subsets: ['latin'], display: 'swap' });
const spaceMono = Space_Mono({ weight: '400', subsets: ['latin'], display: 'swap' });

const LONG_PRESS_MS = 600;
const TAP_COUNT_TO_OPEN = 5;
const TAP_WINDOW_MS = 1500; // taps must land within this rolling window

// ── lockup geometry (single source of truth, ported verbatim) ──
// The lockup uses --pd:140 / --pd-hover:160 and radius math off 70 / 80.
const SIZES = {
  md: { rest: 140, hover: 160, rRest: 70, rHover: 80 },
  sm: { rest: 56, hover: 64, rRest: 28, rHover: 32 },
} as const;

const SPIN_THRESHOLD = 680; // degrees needed (~almost two full rotations)
const SPIN_RESET_MS = 1800; // reset if idle > this

/**
 * The portal circle — the secret entrance to THE HARLEQUIN board.
 *
 * This is a faithful port of the approved `ref-portal-circle-v2.html` lockup:
 * a circle with the harlequin argyle fill, a double-stroke champagne ring, a
 * centered Limelight "THE HARLEQUIN" wordmark, a hover that GROWS the circle in
 * place (no upward jump) and reveals a cursor-tracking champagne glow, and a
 * SPIN-to-open gesture (~680° clockwise) that fills the progress arc, flickers
 * the Google rainbow, and reveals a passcode panel.
 *
 * The only thing changed from the lockup is the open action: entering the
 * passcode submits to the real server auth (`POST /api/dev/auth`) and, on
 * success, redirects to /dev. The lockup's 4-digit auto-close demo is replaced
 * by a real password field; the four dots become a discreet length indicator.
 *
 * Legacy entrypoints are preserved: global ⌘⇧K (Ctrl+Shift+K), mobile
 * long-press (~600ms), and 5 quick taps — all reveal the passcode panel.
 */
export function PortalCircle({
  size = 'md',
  className = '',
}: {
  size?: 'sm' | 'md';
  className?: string;
}) {
  const dims = SIZES[size];

  // ── auth / passcode state ──
  const [revealed, setRevealed] = useState(false); // passcode panel visible
  const [opened, setOpened] = useState(false); // spin completed (arc flicker)
  const [hovered, setHovered] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // ── refs to imperative DOM (ported from the lockup's vanilla JS) ──
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const arcSvgRef = useRef<SVGSVGElement | null>(null);
  const arcPathRef = useRef<SVGCircleElement | null>(null);
  const glowInnerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // mobile triggers
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const tapTimes = useRef<number[]>([]);

  // spin tracking
  const lastAngle = useRef<number | null>(null);
  const spinAccumulated = useRef(0);
  const spinResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedRef = useRef(false);

  // Arc circumference: 2π·79 (matches the lockup's r=79 on a 162 viewBox).
  const ARC_CIRC = 2 * Math.PI * 79;

  const reveal = useCallback(() => {
    setPassword(''); // never reopen pre-filled (browser/password-manager autofill)
    setError('');
    setRevealed(true);
    // focus the hidden input after the panel transitions in
    setTimeout(() => inputRef.current?.focus(), 320);
  }, []);

  const resetSpinState = useCallback(() => {
    lastAngle.current = null;
    spinAccumulated.current = 0;
    if (arcPathRef.current) arcPathRef.current.style.strokeDashoffset = String(ARC_CIRC);
    arcSvgRef.current?.classList.remove('visible');
    if (spinResetTimer.current) clearTimeout(spinResetTimer.current);
  }, [ARC_CIRC]);

  const resetPortal = useCallback(() => {
    openedRef.current = false;
    setOpened(false);
    setRevealed(false);
    setPassword('');
    setError('');
    resetSpinState();
  }, [resetSpinState]);

  // ── OPEN (spin completed) → reveal passcode panel ──
  const openPortal = useCallback(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    setOpened(true);
    arcSvgRef.current?.classList.add('visible');
    if (arcPathRef.current) arcPathRef.current.style.strokeDashoffset = '0';
    // hide the arc after the rainbow flicker plays
    setTimeout(() => arcSvgRef.current?.classList.remove('visible'), 700);
    reveal();
    resetSpinState();
  }, [reveal, resetSpinState]);

  // ── SPIN-TO-OPEN detection (verbatim math from the lockup) ──
  const trackSpin = useCallback(
    (angle: number) => {
      if (lastAngle.current === null) {
        lastAngle.current = angle;
        return;
      }
      let delta = angle - lastAngle.current;
      if (delta > Math.PI) delta -= 2 * Math.PI;
      if (delta < -Math.PI) delta += 2 * Math.PI;

      const deltaDeg = delta * (180 / Math.PI);
      if (deltaDeg > 0) {
        spinAccumulated.current += deltaDeg;
      } else if (deltaDeg < -15) {
        // significant counter-clockwise = soft reset
        spinAccumulated.current = Math.max(
          0,
          spinAccumulated.current - Math.abs(deltaDeg) * 0.5,
        );
      }
      lastAngle.current = angle;

      const pct = Math.min(spinAccumulated.current / SPIN_THRESHOLD, 1);
      if (arcPathRef.current) {
        arcPathRef.current.style.strokeDashoffset = String(ARC_CIRC * (1 - pct));
      }
      if (pct > 0.02) arcSvgRef.current?.classList.add('visible');

      if (spinResetTimer.current) clearTimeout(spinResetTimer.current);
      spinResetTimer.current = setTimeout(resetSpinState, SPIN_RESET_MS);

      if (spinAccumulated.current >= SPIN_THRESHOLD && !openedRef.current) {
        openPortal();
      }
    },
    [ARC_CIRC, openPortal, resetSpinState],
  );

  // cursor-tracking glow + spin detection (lockup's mousemove handler)
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
      if (openedRef.current) return;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const angle = Math.atan2(y - cy, x - cx); // -π .. π
      trackSpin(angle);
    },
    [trackSpin],
  );

  const onMouseEnter = useCallback(() => setHovered(true), []);
  const onMouseLeave = useCallback(() => {
    setHovered(false);
    // Full reset on leave, exactly like the lockup.
    if (!openedRef.current) {
      resetSpinState();
    } else {
      resetPortal();
    }
  }, [resetPortal, resetSpinState]);

  // Global ⌘⇧K (Ctrl+Shift+K) reveals the passcode from anywhere on the page.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const modifier = e.metaKey || e.ctrlKey;
      if (modifier && e.shiftKey && e.code === 'KeyK') {
        e.preventDefault();
        e.stopPropagation();
        reveal();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [reveal]);

  // Mobile secret trigger: long-press (~600ms) OR 5 quick taps.
  const onTouchStart = () => {
    longPressFired.current = false;
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      reveal();
    }, LONG_PRESS_MS);
  };
  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };
  const onTouchEnd = () => {
    cancelPress();
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    const now = Date.now();
    tapTimes.current = [...tapTimes.current, now].filter((t) => now - t <= TAP_WINDOW_MS);
    if (tapTimes.current.length >= TAP_COUNT_TO_OPEN) {
      tapTimes.current = [];
      reveal();
    }
  };

  // cleanup timers on unmount
  useEffect(
    () => () => {
      cancelPress();
      if (spinResetTimer.current) clearTimeout(spinResetTimer.current);
    },
    [],
  );

  async function submitPassword(pw: string) {
    if (!pw || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/dev/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        window.location.href = '/dev';
        return;
      }
      setError(res.status === 429 ? 'Too many attempts. Try later.' : 'Nope.');
      setPassword('');
    } catch {
      setError('Network error. Try again.');
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  // Enter key / explicit form submit
  function submit(e: React.FormEvent) {
    e.preventDefault();
    void submitPassword(password);
  }

  // 6 dots fill as digits are typed — a discreet length indicator
  const filledDots = Math.min(password.length, 6);

  // Auto-submit when the 6th digit lands (post-render, state is committed).
  // `submitPassword` is a plain function declaration — recreated every render —
  // so listing it as a dep would create an infinite loop (submit → setPassword('')
  // → re-render → new fn ref → effect re-runs). Intentionally narrow dep array.
  useEffect(() => {
    if (password.length === 6) {
      void submitPassword(password);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password]); // intentionally omit submitPassword — see comment above

  return (
    <div className={`portal-root flex justify-center ${className}`}>
      <div
        ref={wrapRef}
        className={`portal-wrap${hovered ? ' hovered' : ''}${opened ? ' opened' : ''}`}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onMouseMove={onMouseMove}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={cancelPress}
        onTouchMove={cancelPress}
        role="button"
        tabIndex={0}
        aria-label="Enter THE HARLEQUIN — spin to open"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            reveal();
          }
        }}
      >
        {/* spin hint — only visible on hover via CSS */}
        <div className={`spin-hint ${spaceMono.className}`}>spin cursor to open</div>

        {/* circle fill + ring */}
        <div className="portal-ring">
          <div className="portal-fill" aria-hidden />
          <div className="portal-veil" aria-hidden />
          <div className="portal-glint" aria-hidden />
          <div className="portal-glow" aria-hidden>
            <div ref={glowInnerRef} className="portal-glow-inner" />
          </div>
        </div>

        {/* spin progress arc */}
        <svg ref={arcSvgRef} className="portal-arc-svg" viewBox="0 0 162 162" aria-hidden>
          <circle
            ref={arcPathRef}
            className="portal-arc-path"
            cx="81"
            cy="81"
            r="79"
            transform="rotate(-90 81 81)"
            style={{ strokeDasharray: ARC_CIRC, strokeDashoffset: ARC_CIRC }}
          />
        </svg>

        {/* ghost wordmark — Harlequin, centered */}
        <div className={`portal-ghost${revealed ? ' hidden' : ''}`} aria-hidden>
          <span className={limelight.className}>
            THE
            <br />
            HARLEQUIN
          </span>
        </div>

        {/* passcode panel (after spin-to-open) */}
        <form
          className={`passcode-panel${revealed ? ' visible' : ''}`}
          onSubmit={submit}
          autoComplete="off"
          onClick={() => revealed && inputRef.current?.focus()}
        >
          <div className="passcode-dots" aria-hidden>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`passcode-dot${i < filledDots ? ' filled' : ''}`} />
            ))}
          </div>
          <input
            ref={inputRef}
            className="passcode-input"
            type="password"
            inputMode="numeric"
            id="dev-portal-code"
            name="dev-portal-code"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-bwignore="true"
            data-form-type="other"
            aria-label="Enter 6-digit passcode"
            value={password}
            disabled={busy}
            maxLength={6}
            onChange={(e) => {
              // Accept only digits, cap at 6
              const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
              setPassword(digits);
            }}
          />
          <div className={`passcode-label ${spaceMono.className}`}>
            {error ? error : 'enter code'}
          </div>
          <button type="submit" className="sr-only">
            Enter
          </button>
        </form>
      </div>

      <style jsx>{`
        .portal-root {
          --pd: ${dims.rest}px;
          --pd-hover: ${dims.hover}px;
        }
        .portal-wrap {
          position: relative;
          width: var(--pd);
          height: var(--pd);
          display: grid;
          place-items: center;
          cursor: crosshair;
          transition: width 300ms cubic-bezier(0.34, 1.56, 0.64, 1),
            height 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
          flex-shrink: 0;
          outline: none;
        }
        .portal-wrap:focus-visible {
          box-shadow: 0 0 0 2px rgba(231, 226, 212, 0.6);
          border-radius: 50%;
        }
        .portal-wrap.hovered {
          width: var(--pd-hover);
          height: var(--pd-hover);
        }

        /* double-stroke ring */
        .portal-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          box-shadow: 0 0 0 1.5px rgba(231, 226, 212, 0.55),
            0 0 0 3px rgba(13, 11, 17, 0.95), 0 0 0 4.5px rgba(231, 226, 212, 0.18),
            0 16px 48px -12px rgba(0, 0, 0, 0.9), inset 0 0 40px 10px rgba(0, 0, 0, 0.7);
          overflow: hidden;
          transition: box-shadow 300ms ease;
        }
        .portal-wrap.hovered .portal-ring {
          box-shadow: 0 0 0 1.5px rgba(231, 226, 212, 0.7),
            0 0 0 3px rgba(13, 11, 17, 0.95), 0 0 0 4.5px rgba(231, 226, 212, 0.28),
            0 20px 60px -12px rgba(0, 0, 0, 0.95), 0 0 28px 4px rgba(231, 220, 180, 0.1),
            inset 0 0 40px 10px rgba(0, 0, 0, 0.7);
        }

        /* Harlequin variant: argyle fill */
        .portal-fill {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          overflow: hidden;
          background-color: #0d0b11;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='44' height='44'%3E%3Cpolygon points='22,2 42,22 22,42 2,22' fill='%23B3122B' stroke='%23EDE6D6' stroke-width='0.8'/%3E%3C/svg%3E"),
            linear-gradient(rgba(231, 226, 212, 0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(231, 226, 212, 0.035) 1px, transparent 1px);
          background-size: 44px 44px, 80px 80px, 80px 80px;
          animation: portal-drift 12s linear infinite;
        }
        @keyframes portal-drift {
          from {
            background-position: 0 0, 0 0, 0 0;
          }
          to {
            background-position: 44px 44px, 80px 80px, 80px 80px;
          }
        }

        /* depth veil */
        .portal-veil {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: radial-gradient(
            circle at 50% 45%,
            transparent 0%,
            rgba(13, 11, 17, 0.5) 52%,
            rgba(13, 11, 17, 0.88) 100%
          );
          z-index: 2;
        }

        /* glass glint */
        .portal-glint {
          position: absolute;
          top: 12%;
          left: 18%;
          width: 44%;
          height: 22%;
          background: linear-gradient(
            135deg,
            rgba(231, 226, 212, 0.07) 0%,
            transparent 100%
          );
          border-radius: 50%;
          pointer-events: none;
          z-index: 3;
        }

        /* cursor-tracking glow */
        .portal-glow {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          overflow: hidden;
          pointer-events: none;
          z-index: 2;
          opacity: 0;
          transition: opacity 280ms ease-out;
        }
        .portal-wrap.hovered .portal-glow {
          opacity: 1;
        }
        .portal-glow-inner {
          position: absolute;
          width: 120px;
          height: 120px;
          transform: translate(-50%, -50%);
          background: radial-gradient(
            circle,
            rgba(231, 220, 180, 0.32) 0%,
            rgba(231, 220, 180, 0.12) 40%,
            transparent 70%
          );
          filter: blur(24px);
          pointer-events: none;
        }

        /* ghost wordmark — Harlequin, centered */
        .portal-ghost {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 5;
          font-size: ${size === 'sm' ? 5 : 10}px;
          letter-spacing: 0.22em;
          text-align: center;
          line-height: 1.7;
          color: rgba(231, 226, 212, 0.22);
          text-shadow: 0 0 16px rgba(231, 226, 212, 0.06);
          pointer-events: none;
          user-select: none;
          transition: opacity 200ms;
        }
        .portal-ghost.hidden {
          opacity: 0;
        }

        /* spin progress arc */
        .portal-arc-svg {
          position: absolute;
          inset: -6px;
          z-index: 6;
          pointer-events: none;
          opacity: 0;
          transition: opacity 200ms;
        }
        .portal-arc-svg.visible {
          opacity: 1;
        }
        .portal-arc-path {
          fill: none;
          stroke: #e7e2d4;
          stroke-width: 1.5;
          stroke-linecap: round;
          transition: stroke-dashoffset 0.1s linear;
        }
        .portal-wrap.opened .portal-arc-path {
          animation: rainbow-flicker 0.6s steps(3, end) both;
        }
        @keyframes rainbow-flicker {
          0% {
            stroke: #4285f4;
          }
          25% {
            stroke: #ea4335;
          }
          50% {
            stroke: #fbbc05;
          }
          75% {
            stroke: #34a853;
          }
          100% {
            stroke: #e7e2d4;
            opacity: 0;
          }
        }

        /* passcode entry */
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

        /* spin instruction hint — only on hover */
        .spin-hint {
          position: absolute;
          top: -26px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 7px;
          letter-spacing: 0.16em;
          color: rgba(231, 226, 212, 0);
          white-space: nowrap;
          text-transform: uppercase;
          transition: color 400ms ease 600ms;
          pointer-events: none;
          z-index: 20;
        }
        .portal-wrap.hovered .spin-hint {
          color: rgba(231, 226, 212, 0.28);
        }
        .portal-wrap.opened .spin-hint {
          color: rgba(231, 226, 212, 0) !important;
        }

        .sr-only {
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
          .portal-fill {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
