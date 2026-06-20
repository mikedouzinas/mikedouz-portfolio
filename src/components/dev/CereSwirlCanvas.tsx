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
 */
export function CereSwirlCanvas({ className = '' }: { className?: string }) {
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

      // Dark base
      ctx.fillStyle = '#061612';
      ctx.fillRect(0, 0, w, h);

      // Soft gradient blobs that shift position over time → organic swirl feel.
      const blobs = [
        { x: 0.45 + 0.28 * Math.sin(time * 0.31), y: 0.38 + 0.22 * Math.cos(time * 0.19), r: 0.48, col: 'rgba(20, 90, 60, 0.72)' },
        { x: 0.55 + 0.22 * Math.cos(time * 0.27), y: 0.62 + 0.28 * Math.sin(time * 0.23), r: 0.44, col: 'rgba(10, 38, 80, 0.65)' },
        { x: 0.32 + 0.26 * Math.sin(time * 0.17 + 1), y: 0.55 + 0.2 * Math.cos(time * 0.29 + 2), r: 0.38, col: 'rgba(14, 68, 44, 0.55)' },
        { x: 0.68 + 0.18 * Math.cos(time * 0.21 + 3), y: 0.42 + 0.24 * Math.sin(time * 0.13 + 1), r: 0.4, col: 'rgba(8,  28, 68, 0.60)' },
        { x: 0.5 + 0.14 * Math.sin(time * 0.37 + 2), y: 0.5 + 0.14 * Math.cos(time * 0.31 + 4), r: 0.3, col: 'rgba(34,120, 80, 0.45)' },
      ];

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

      // Subtle noise streaks via thin arcs.
      ctx.save();
      ctx.globalAlpha = 0.07;
      ctx.strokeStyle = 'rgba(60,180,120,1)';
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

    function tick() {
      if (!running) return;
      t += 0.012;
      drawCereSwirl(t);
      animId = requestAnimationFrame(tick);
    }
    animId = requestAnimationFrame(tick);

    return () => {
      running = false;
      if (animId) cancelAnimationFrame(animId);
      ro.disconnect();
    };
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
