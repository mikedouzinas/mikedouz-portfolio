'use client';

import { useEffect, useRef } from 'react';

/**
 * Cere swirl — an organic, slow-moving swirl of forest green + deep navy painted
 * to a <canvas>. Ported verbatim from the approved portal-circle v2 lockup
 * (`drawCereSwirl` / `startCereSwirl`): soft gradient blobs that drift over time
 * plus faint green arc streaks. Used by the portal's Cere mode and by the
 * top-right Cere trigger on /dev.
 *
 * Canvas sizing: a ResizeObserver keeps canvas.width/height in sync with the
 * element's real rendered pixel size (devicePixelRatio-adjusted) so the swirl
 * fills the circle at any size and always animates — the rAF loop reads the
 * live canvas dimensions each frame.
 *
 * Swirl variants (one chosen at random per page load via CerePortal):
 *   0 — "Forest Deep"    — green + navy (lockup default)
 *   1 — "Teal Drift"     — brighter teal + midnight blue, slightly lighter feel
 *   2 — "Midnight Moss"  — deep charcoal-green + near-black navy, very moody
 */

export type CereSwirlVariant = 0 | 1 | 2;

// ─── Per-variant blob definitions ────────────────────────────────────────────

type Blob = { x: number; y: number; r: number; col: string };

function getBlobsForVariant(variant: CereSwirlVariant, t: number): Blob[] {
  switch (variant) {
    case 1:
      // "Teal Drift" — brighter teal + midnight blue
      return [
        { x: 0.45 + 0.28 * Math.sin(t * 0.31),       y: 0.38 + 0.22 * Math.cos(t * 0.19),       r: 0.48, col: 'rgba(28, 130, 95, 0.70)'  },
        { x: 0.55 + 0.22 * Math.cos(t * 0.27),       y: 0.62 + 0.28 * Math.sin(t * 0.23),       r: 0.44, col: 'rgba(15, 28, 100, 0.65)'  },
        { x: 0.32 + 0.26 * Math.sin(t * 0.17 + 1),   y: 0.55 + 0.20 * Math.cos(t * 0.29 + 2),  r: 0.38, col: 'rgba(20, 110, 75, 0.52)'  },
        { x: 0.68 + 0.18 * Math.cos(t * 0.21 + 3),   y: 0.42 + 0.24 * Math.sin(t * 0.13 + 1),  r: 0.40, col: 'rgba(10,  20, 80, 0.58)'  },
        { x: 0.50 + 0.14 * Math.sin(t * 0.37 + 2),   y: 0.50 + 0.14 * Math.cos(t * 0.31 + 4),  r: 0.30, col: 'rgba(50, 160, 110, 0.42)' },
      ];
    case 2:
      // "Midnight Moss" — deep charcoal-green + near-black navy, moody
      return [
        { x: 0.45 + 0.28 * Math.sin(t * 0.31),       y: 0.38 + 0.22 * Math.cos(t * 0.19),       r: 0.50, col: 'rgba(12, 55, 36, 0.78)'  },
        { x: 0.55 + 0.22 * Math.cos(t * 0.27),       y: 0.62 + 0.28 * Math.sin(t * 0.23),       r: 0.46, col: 'rgba(6,  18, 48, 0.72)'  },
        { x: 0.32 + 0.26 * Math.sin(t * 0.17 + 1),   y: 0.55 + 0.20 * Math.cos(t * 0.29 + 2),  r: 0.40, col: 'rgba(8,  40, 28, 0.60)'  },
        { x: 0.68 + 0.18 * Math.cos(t * 0.21 + 3),   y: 0.42 + 0.24 * Math.sin(t * 0.13 + 1),  r: 0.42, col: 'rgba(4,  14, 38, 0.65)'  },
        { x: 0.50 + 0.14 * Math.sin(t * 0.37 + 2),   y: 0.50 + 0.14 * Math.cos(t * 0.31 + 4),  r: 0.28, col: 'rgba(20, 70, 45, 0.48)'  },
      ];
    default:
      // "Forest Deep" — lockup default (variant 0)
      return [
        { x: 0.45 + 0.28 * Math.sin(t * 0.31),       y: 0.38 + 0.22 * Math.cos(t * 0.19),       r: 0.48, col: 'rgba(20,  90,  60, 0.72)' },
        { x: 0.55 + 0.22 * Math.cos(t * 0.27),       y: 0.62 + 0.28 * Math.sin(t * 0.23),       r: 0.44, col: 'rgba(10,  38,  80, 0.65)' },
        { x: 0.32 + 0.26 * Math.sin(t * 0.17 + 1),   y: 0.55 + 0.20 * Math.cos(t * 0.29 + 2),  r: 0.38, col: 'rgba(14,  68,  44, 0.55)' },
        { x: 0.68 + 0.18 * Math.cos(t * 0.21 + 3),   y: 0.42 + 0.24 * Math.sin(t * 0.13 + 1),  r: 0.40, col: 'rgba( 8,  28,  68, 0.60)' },
        { x: 0.50 + 0.14 * Math.sin(t * 0.37 + 2),   y: 0.50 + 0.14 * Math.cos(t * 0.31 + 4),  r: 0.30, col: 'rgba(34, 120,  80, 0.45)' },
      ];
  }
}

// ─── Background color per variant ────────────────────────────────────────────
function getBaseFill(variant: CereSwirlVariant): string {
  switch (variant) {
    case 1: return '#051814';
    case 2: return '#040c0a';
    default: return '#061612';
  }
}

// ─── Arc streak color per variant ────────────────────────────────────────────
function getStreakColor(variant: CereSwirlVariant): string {
  switch (variant) {
    case 1: return 'rgba(70,200,140,1)';
    case 2: return 'rgba(40,120,80,1)';
    default: return 'rgba(60,180,120,1)';
  }
}

export function CereSwirlCanvas({
  className = '',
  variant = 0,
}: {
  className?: string;
  variant?: CereSwirlVariant;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let t = 0;
    let animId = 0;
    let running = true;

    /** Resize canvas backing store to match real rendered size × dpr. */
    function syncSize() {
      const dpr = window.devicePixelRatio ?? 1;
      const rect = canvas!.getBoundingClientRect();
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (w > 0 && h > 0 && (canvas!.width !== w || canvas!.height !== h)) {
        canvas!.width = w;
        canvas!.height = h;
        ctx!.scale(dpr, dpr);
      }
    }

    function drawCereSwirl(time: number) {
      if (!ctx) return;
      // Use the CSS pixel size (undone from dpr) for coordinate calculations.
      const dpr = window.devicePixelRatio ?? 1;
      const w = canvas!.width / dpr;
      const h = canvas!.height / dpr;
      if (w <= 0 || h <= 0) return;

      // Dark base — variant-specific background
      ctx.fillStyle = getBaseFill(variant);
      ctx.fillRect(0, 0, w, h);

      // Soft gradient blobs that shift position over time → organic swirl feel.
      // Blob definitions are identical to the approved lockup's drawCereSwirl(t).
      const blobs = getBlobsForVariant(variant, time);

      blobs.forEach((b) => {
        const gx = b.x * w;
        const gy = b.y * h;
        const gr = b.r * w;
        const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        grad.addColorStop(0, b.col);
        grad.addColorStop(1, 'rgba(6,22,18,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(gx, gy, gr, 0, Math.PI * 2);
        ctx.fill();
      });

      // Subtle noise streaks via thin arcs — matches lockup exactly.
      ctx.save();
      ctx.globalAlpha = 0.07;
      ctx.strokeStyle = getStreakColor(variant);
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 6; i++) {
        const ang = time * 0.08 + i * ((Math.PI * 2) / 6);
        const cx2 = w / 2 + Math.min(w, h) * 0.27 * Math.cos(ang);
        const cy2 = h / 2 + Math.min(w, h) * 0.27 * Math.sin(ang);
        ctx.beginPath();
        ctx.arc(cx2, cy2, Math.min(w, h) * 0.14 + i * 3, ang, ang + Math.PI * 0.9);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Sync canvas size on mount and whenever the element resizes.
    syncSize();

    if (reduce) {
      drawCereSwirl(0);
      return;
    }

    // ResizeObserver keeps the canvas backing store matched to rendered size.
    const ro = new ResizeObserver(() => {
      syncSize();
    });
    ro.observe(canvas);

    // ── Animation loop ──────────────────────────────────────────────────────
    // Time increment 0.009 — clearly moving but graceful (0.005 read as static;
    // the lockup uses 0.012). A visible, slow drift.
    function tick() {
      if (!running) return;
      t += 0.009;
      drawCereSwirl(t);
      animId = requestAnimationFrame(tick);
    }
    animId = requestAnimationFrame(tick);

    return () => {
      running = false;
      if (animId) cancelAnimationFrame(animId);
      ro.disconnect();
    };
    // variant is set once at mount (random pick in parent); no need to re-run effect on change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
      }}
    />
  );
}
