'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

interface WebPatternProps {
  className?: string;
}

/**
 * Full-page spider web pattern that reveals on mouse hover.
 * The web is nearly invisible by default; moving the mouse acts like a
 * flashlight that illuminates the web strands underneath the cursor.
 */
export default function WebPattern({ className }: WebPatternProps) {
  const [mounted, setMounted] = useState(false);
  const [mousePos, setMousePos] = useState({ x: -200, y: -200 });
  const rafRef = useRef<number>(0);

  useEffect(() => setMounted(true), []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setMousePos({ x: e.clientX, y: e.clientY });
    });
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, [handleMouseMove]);

  if (!mounted) return null;

  // Full web centered on the page
  const cx = 500;
  const cy = 500;
  const numRadials = 16;
  const numArcs = 10;
  const maxRadius = 480;

  const radialAngles = Array.from({ length: numRadials }, (_, i) =>
    (i / numRadials) * Math.PI * 2
  );

  // Radial lines from center
  const radialLines = radialAngles.map((angle) => {
    const endX = cx + Math.cos(angle) * maxRadius;
    const endY = cy + Math.sin(angle) * maxRadius;
    return `M ${cx} ${cy} L ${endX} ${endY}`;
  });

  // Concentric arcs with organic sag
  const arcPaths: string[] = [];
  for (let arcIdx = 1; arcIdx <= numArcs; arcIdx++) {
    const radius = (arcIdx / numArcs) * maxRadius;
    const jitter = (i: number) => {
      const seed = (arcIdx * 7 + i * 13) % 17;
      return 1 + (seed - 8.5) * 0.008;
    };

    let d = '';
    for (let i = 0; i < radialAngles.length; i++) {
      const a1 = radialAngles[i];
      const a2 = radialAngles[(i + 1) % radialAngles.length];
      const r1 = radius * jitter(i);
      const r2 = radius * jitter((i + 1) % radialAngles.length);

      const x1 = cx + Math.cos(a1) * r1;
      const y1 = cy + Math.sin(a1) * r1;
      const x2 = cx + Math.cos(a2) * r2;
      const y2 = cy + Math.sin(a2) * r2;

      const midAngle = (a1 + a2 + (a2 < a1 ? Math.PI * 2 : 0)) / 2;
      const sagRadius = ((r1 + r2) / 2) * 0.94;
      const qx = cx + Math.cos(midAngle) * sagRadius;
      const qy = cy + Math.sin(midAngle) * sagRadius;

      if (i === 0) d += `M ${x1} ${y1} `;
      d += `Q ${qx} ${qy} ${x2} ${y2} `;
    }
    arcPaths.push(d);
  }

  // Intersection dots
  const dots: { x: number; y: number }[] = [];
  for (const angle of radialAngles) {
    for (let ai = 1; ai <= numArcs; ai++) {
      const r = (ai / numArcs) * maxRadius;
      dots.push({
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
      });
    }
  }

  return (
    <div
      className={`fixed inset-0 pointer-events-none overflow-hidden ${className ?? ''}`}
      aria-hidden="true"
      style={{
        // The mask: a radial gradient centered on the mouse that reveals the web
        WebkitMaskImage: `radial-gradient(circle 180px at ${mousePos.x}px ${mousePos.y}px, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.12) 40%, transparent 100%)`,
        maskImage: `radial-gradient(circle 180px at ${mousePos.x}px ${mousePos.y}px, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.12) 40%, transparent 100%)`,
      }}
    >
      <svg
        viewBox="0 0 1000 1000"
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Radial structural lines */}
        {radialLines.map((d, i) => (
          <path
            key={`r-${i}`}
            d={d}
            fill="none"
            stroke="#a78bfa"
            strokeWidth="0.5"
            strokeLinecap="round"
          />
        ))}

        {/* Concentric arcs */}
        {arcPaths.map((d, i) => (
          <path
            key={`a-${i}`}
            d={d}
            fill="none"
            stroke="#a78bfa"
            strokeWidth="0.4"
            strokeLinecap="round"
          />
        ))}

        {/* Intersection dots */}
        {dots.map((dot, i) => (
          <circle
            key={`d-${i}`}
            cx={dot.x}
            cy={dot.y}
            r="1"
            fill="#a78bfa"
            opacity="0.6"
          />
        ))}
      </svg>
    </div>
  );
}
