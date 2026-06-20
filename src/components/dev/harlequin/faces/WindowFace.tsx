'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createHoverAudio } from '../harlequinAudio';
import { PasscodeFields } from '../PasscodeFields';
import type { FaceProps } from './faceTypes';

const CROSSFADE_INTERVAL = 5000; // verbatim from window-frost.html

interface Moment {
  src: string;
  label: string;
}

/** Fisher–Yates shuffle (verbatim from window-frost.html). */
function shuffleArray<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

/**
 * WINDOW face — a verbatim port of the `window-frost.html` lockup, sized for the
 * card per `card-comparison.html` (Option 3 — Window): 172×128 frosted-glass
 * storefront. Champagne frame box-shadows and the frost backdrop-filter (rest
 * blur 8px → hover 3px, frost tint), the rotating breathing photos with a 1.4s
 * opacity crossfade, the canvas-etched solid gold "THE HARLEQUIN" signage, the
 * cursor-tracking inner glow, spin-to-open, and the bottom passcode panel are
 * all ported 1:1. Photos come from `/api/portal-images` (future-proof: Mike
 * drops files in public/portal/). Hover plays a random iTunes preview at vol
 * 0.18 after the first user gesture; pause on mouseleave.
 */
export function WindowFace({ passcode, spin, revealed, onLeave, onReveal }: FaceProps) {
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
  const glassRef = useRef<HTMLDivElement | null>(null);
  const glowInnerRef = useRef<HTMLDivElement | null>(null);
  const etchCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<ReturnType<typeof createHoverAudio> | null>(null);

  const [moments, setMoments] = useState<Moment[]>([]);
  const [currentImg, setCurrentImg] = useState(0);

  // ── load photos from the API (future-proof folder read) ──
  useEffect(() => {
    let cancelled = false;
    fetch('/api/portal-images')
      .then((r) => r.json())
      .then((data: { images?: Moment[] }) => {
        if (cancelled || !data.images || data.images.length === 0) return;
        const shuffled = shuffleArray(data.images);
        setMoments(shuffled);
        setCurrentImg(Math.floor(Math.random() * shuffled.length));
      })
      .catch(() => {
        /* no photos → frosted glass with etch text only */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── arm + dispose hover audio (gesture-gated, vol 0.18) ──
  useEffect(() => {
    const audio = createHoverAudio();
    audio.arm();
    audioRef.current = audio;
    return () => {
      audio.dispose();
      audioRef.current = null;
    };
  }, []);

  // ── crossfade images (verbatim 5000ms interval) ──
  useEffect(() => {
    if (moments.length < 2) return;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;
    const id = setInterval(() => {
      setCurrentImg((prev) => (prev + 1) % moments.length);
    }, CROSSFADE_INTERVAL);
    return () => clearInterval(id);
  }, [moments.length]);

  // ── etch canvas: "THE HARLEQUIN" solid gold text on frost (verbatim) ──
  const drawEtch = useCallback(() => {
    const canvas = etchCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    if (!W || !H) return;

    ctx.clearRect(0, 0, W, H);

    // 1. light frost veil — low opacity so image reads through
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(237,228,205,0.18)';
    ctx.fillRect(0, 0, W, H);

    const fontSizePx = Math.round(W * 0.112);
    const letterSpacingEm = 0.22;

    ctx.font = `400 ${fontSizePx}px Limelight, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${
        fontSizePx * letterSpacingEm
      }px`;
    }

    const lineGap = fontSizePx * 1.28;
    const blockTop = H / 2 - lineGap / 2;

    // 2. solid gold-leaf fill
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(200,185,138,0.92)';
    ctx.fillText('THE', W / 2, blockTop);
    ctx.fillText('HARLEQUIN', W / 2, blockTop + lineGap);

    // 3. thin gilded stroke for depth
    ctx.strokeStyle = 'rgba(200,185,138,1)';
    ctx.lineWidth = 0.7;
    ctx.strokeText('THE', W / 2, blockTop);
    ctx.strokeText('HARLEQUIN', W / 2, blockTop + lineGap);
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = etchCanvasRef.current;
    const glass = glassRef.current;
    if (!canvas || !glass) return;
    const rect = glass.getBoundingClientRect();
    if (rect.width < 1) return;
    canvas.width = Math.round(rect.width);
    canvas.height = Math.round(rect.height);
    drawEtch();
  }, [drawEtch]);

  useEffect(() => {
    const glass = glassRef.current;
    const wrap = wrapRef.current;
    if (!glass || !wrap) return;
    const ro = new ResizeObserver(() => resizeCanvas());
    ro.observe(glass);
    ro.observe(wrap);
    const t = setTimeout(resizeCanvas, 80);
    return () => {
      ro.disconnect();
      clearTimeout(t);
    };
  }, [resizeCanvas]);

  // Redraw etch when the active image changes (matches lockup advanceImage→drawEtch).
  useEffect(() => {
    drawEtch();
  }, [currentImg, drawEtch]);

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
      const angle = Math.atan2(y - cy, x - cx);
      spin.feed(angle);
    },
    [spin],
  );

  return (
    <div
      ref={wrapRef}
      className="win-portal"
      onMouseEnter={(e) => {
        e.currentTarget.classList.add('hov');
        audioRef.current?.start();
      }}
      onMouseLeave={(e) => {
        e.currentTarget.classList.remove('hov');
        audioRef.current?.stop();
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
      <div ref={glassRef} className="win-glass">
        {/* depth veil */}
        <div className="glass-veil" aria-hidden />

        {/* rotating vibe images — crossfade via opacity */}
        <div className="glass-images" aria-hidden>
          {moments.map((m, i) => (
            <div
              key={m.src}
              className={`glass-img${i === currentImg ? ' active' : ''}`}
              style={{
                backgroundImage: `url(${m.src})`,
                animationDelay: `${i * 3.1}s`,
              }}
            />
          ))}
        </div>

        {/* frost layer — backdrop blur 8px rest / 3px hover (verbatim) */}
        <div className="glass-frost" aria-hidden />

        {/* canvas etched "THE HARLEQUIN" gold-leaf signage */}
        <canvas
          ref={etchCanvasRef}
          className={`glass-etch-canvas${revealed ? ' hidden' : ''}`}
          aria-hidden
        />

        {/* cursor-tracking inner glow */}
        <div className="window-glow" aria-hidden>
          <div ref={glowInnerRef} className="window-glow-inner" />
        </div>

        {/* passcode panel — bottom 22% (verbatim from window-frost) */}
        <form
          className={`passcode-panel${revealed ? ' visible' : ''}`}
          onSubmit={submit}
          autoComplete="off"
          onClick={() => revealed && focusInput()}
        >
          <PasscodeFields
            ref={inputRef}
            inputId="dev-portal-code-window"
            filledDots={filledDots}
            password={password}
            busy={busy}
            error={error}
            onChange={onChange}
          />
        </form>
      </div>

      {/* frame molding — above glass */}
      <div className="win-frame" aria-hidden />

      <style jsx>{`
        /* ── chrome/sizing verbatim from card-comparison.html (Option 3 — Window) ── */
        .win-portal {
          position: relative;
          width: 172px;
          height: 128px;
          cursor: crosshair;
          flex-shrink: 0;
          outline: none;
          transition: transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .win-portal.hov {
          transform: scale(1.04);
        }
        .win-portal:focus-visible {
          box-shadow: 0 0 0 2px rgba(231, 226, 212, 0.6);
          border-radius: 3px;
        }
        .win-frame {
          position: absolute;
          inset: 0;
          border-radius: 3px;
          box-shadow: inset 0 0 0 2px #c8b98a,
            inset 0 0 0 5px rgba(13, 11, 17, 0.97),
            inset 0 0 0 6.5px rgba(200, 185, 138, 0.35),
            0 10px 32px -6px rgba(0, 0, 0, 0.85);
          pointer-events: none;
          z-index: 8;
          transition: box-shadow 280ms ease;
        }
        .win-portal.hov .win-frame {
          box-shadow: inset 0 0 0 2px #ddd0a8,
            inset 0 0 0 5px rgba(13, 11, 17, 0.97),
            inset 0 0 0 6.5px rgba(221, 208, 168, 0.5),
            0 14px 40px -6px rgba(0, 0, 0, 0.92),
            0 0 14px 1px rgba(200, 185, 138, 0.08);
        }
        .win-glass {
          position: absolute;
          inset: 8px;
          border-radius: 1px;
          overflow: hidden;
        }

        /* rotating images — crossfade via opacity (verbatim from window-frost) */
        .glass-images {
          position: absolute;
          inset: 0;
        }
        .glass-img {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
          opacity: 0;
          transition: opacity 1.4s ease, filter 600ms ease;
          /* Blur the image layer directly so the frost effect is strong at rest
             regardless of backdrop-filter browser support. Scale is bumped up so
             blur's soft edge stays within the overflow:hidden glass boundary. */
          filter: blur(9px);
          transform: scale(1.16);
          animation: img-breathe 18s ease-in-out infinite;
        }
        .glass-img.active {
          opacity: 1;
        }
        /* On hover: slightly clearer but still obscured — still reads as frosted. */
        .win-portal.hov .glass-img {
          filter: blur(4px);
        }
        @keyframes img-breathe {
          0% {
            transform: scale(1.16) translate(0, 0);
          }
          33% {
            transform: scale(1.18) translate(-6px, -4px);
          }
          66% {
            transform: scale(1.17) translate(4px, -2px);
          }
          100% {
            transform: scale(1.16) translate(0, 0);
          }
        }

        /* frost layer — additive sheen on top of the blurred image; strengthened tint + blur */
        .glass-frost {
          position: absolute;
          inset: 0;
          backdrop-filter: blur(14px) saturate(0.85) brightness(0.95);
          -webkit-backdrop-filter: blur(14px) saturate(0.85) brightness(0.95);
          background: rgba(237, 228, 205, 0.30);
          transition: backdrop-filter 600ms ease,
            -webkit-backdrop-filter 600ms ease, background 600ms ease;
          z-index: 2;
        }
        .win-portal.hov .glass-frost {
          backdrop-filter: blur(6px) saturate(0.9) brightness(0.98);
          -webkit-backdrop-filter: blur(6px) saturate(0.9) brightness(0.98);
          background: rgba(237, 228, 205, 0.14);
        }

        .glass-etch-canvas {
          position: absolute;
          inset: 0;
          z-index: 3;
          pointer-events: none;
          width: 100%;
          height: 100%;
          opacity: 1;
          transition: opacity 300ms ease;
        }
        /* hide the etched wordmark when the passcode shows (flip, like the
           circle/diamond ghost wordmarks) */
        .glass-etch-canvas.hidden {
          opacity: 0;
        }

        .glass-veil {
          position: absolute;
          inset: 0;
          z-index: 1;
          background: radial-gradient(
            ellipse 80% 80% at 50% 45%,
            transparent 0%,
            rgba(13, 11, 17, 0.25) 55%,
            rgba(13, 11, 17, 0.55) 100%
          );
          pointer-events: none;
        }

        .window-glow {
          position: absolute;
          inset: 0;
          z-index: 2;
          overflow: hidden;
          pointer-events: none;
          opacity: 0;
          transition: opacity 280ms ease-out;
          border-radius: 1px;
        }
        .win-portal.hov .window-glow {
          opacity: 1;
        }
        .window-glow-inner {
          position: absolute;
          width: 160px;
          height: 160px;
          transform: translate(-50%, -50%);
          background: radial-gradient(
            circle,
            rgba(200, 185, 138, 0.24) 0%,
            rgba(200, 185, 138, 0.1) 40%,
            transparent 70%
          );
          filter: blur(28px);
          pointer-events: none;
        }

        /* passcode panel — positioning only; inner-element styles live in PasscodeFields.tsx */
        .passcode-panel {
          position: absolute;
          left: 50%;
          bottom: 22%;
          transform: translateX(-50%);
          z-index: 12;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
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
          .glass-img {
            animation: none !important;
            transition: opacity 0.8s ease !important;
          }
          .win-portal,
          .win-frame,
          .window-glow {
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}
