'use client';

import React from 'react';

interface WebPatternProps {
  className?: string;
}

export default function WebPattern({ className }: WebPatternProps) {
  // Generate radial lines from the origin point
  const origin = { x: 100, y: 0 };
  const numRadials = 8;
  const maxRadius = 140;
  const angleStart = Math.PI * 0.5; // straight down
  const angleEnd = Math.PI * 1.0; // straight left
  const numArcs = 6;

  const radialAngles = Array.from({ length: numRadials }, (_, i) => {
    return angleStart + (i / (numRadials - 1)) * (angleEnd - angleStart);
  });

  // Build radial lines
  const radialLines = radialAngles.map((angle) => {
    const endX = origin.x + Math.cos(angle) * maxRadius;
    const endY = origin.y + Math.sin(angle) * maxRadius;
    return `M ${origin.x} ${origin.y} L ${endX} ${endY}`;
  });

  // Build concentric arcs between radial lines
  const arcPaths: string[] = [];
  for (let arcIdx = 1; arcIdx <= numArcs; arcIdx++) {
    const radius = (arcIdx / numArcs) * maxRadius;
    // Slight irregularity for organic feel
    const jitter = (i: number) => {
      const seed = (arcIdx * 7 + i * 13) % 17;
      return 1 + (seed - 8.5) * 0.012;
    };

    let d = '';
    for (let i = 0; i < radialAngles.length - 1; i++) {
      const a1 = radialAngles[i];
      const a2 = radialAngles[i + 1];
      const r1 = radius * jitter(i);
      const r2 = radius * jitter(i + 1);

      const x1 = origin.x + Math.cos(a1) * r1;
      const y1 = origin.y + Math.sin(a1) * r1;
      const x2 = origin.x + Math.cos(a2) * r2;
      const y2 = origin.y + Math.sin(a2) * r2;

      // Use a quadratic bezier for slight sag between radials
      const midAngle = (a1 + a2) / 2;
      const sagRadius = ((r1 + r2) / 2) * 0.92;
      const cx = origin.x + Math.cos(midAngle) * sagRadius;
      const cy = origin.y + Math.sin(midAngle) * sagRadius;

      if (i === 0) {
        d += `M ${x1} ${y1} `;
      }
      d += `Q ${cx} ${cy} ${x2} ${y2} `;
    }
    arcPaths.push(d);
  }

  return (
    <div
      className={`absolute top-0 right-0 pointer-events-none overflow-hidden ${className ?? ''}`}
      style={{ width: '320px', height: '320px' }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMaxYMin meet"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Radial fade from origin corner */}
          <radialGradient
            id="web-fade"
            cx="100%"
            cy="0%"
            r="100%"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="40%" stopColor="white" stopOpacity="0.6" />
            <stop offset="70%" stopColor="white" stopOpacity="0.2" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="web-mask">
            <rect width="100" height="100" fill="url(#web-fade)" />
          </mask>
        </defs>

        <g mask="url(#web-mask)" opacity="0.18">
          {/* Radial structural lines */}
          {radialLines.map((d, i) => (
            <path
              key={`radial-${i}`}
              d={d}
              fill="none"
              stroke="#8b7fc7"
              strokeWidth="0.25"
              strokeLinecap="round"
            />
          ))}

          {/* Concentric arc connections */}
          {arcPaths.map((d, i) => (
            <path
              key={`arc-${i}`}
              d={d}
              fill="none"
              stroke="#9ca3af"
              strokeWidth="0.2"
              strokeLinecap="round"
            />
          ))}

          {/* Tiny dots at intersections for detail */}
          {radialAngles.map((angle, ri) =>
            Array.from({ length: numArcs }, (_, ai) => {
              const radius = ((ai + 1) / numArcs) * maxRadius;
              const x = origin.x + Math.cos(angle) * radius;
              const y = origin.y + Math.sin(angle) * radius;
              return (
                <circle
                  key={`dot-${ri}-${ai}`}
                  cx={x}
                  cy={y}
                  r="0.3"
                  fill="#a78bfa"
                  opacity="0.5"
                />
              );
            })
          )}
        </g>
      </svg>
    </div>
  );
}
