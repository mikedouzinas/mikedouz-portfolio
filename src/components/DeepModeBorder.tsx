"use client";
import React, { useRef, useState, useEffect } from 'react';
import { useDeepMode } from './DeepModeContext';

const INSET = 5;
const CORNER_RADIUS = 0;
const PATH_LENGTH = 1000;

// 8 bars + 8 gaps, summing to exactly PATH_LENGTH for seamless looping
const DASH_ARRAY = "70 75 40 60 90 80 30 55 60 70 50 65 80 60 45 70";

export default function DeepModeBorder() {
  const { deepMode } = useDeepMode();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setDims((prev) =>
        prev.w === Math.round(width) && prev.h === Math.round(height)
          ? prev
          : { w: Math.round(width), h: Math.round(height) }
      );
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { w, h } = dims;

  const path =
    w > 0 && h > 0
      ? `M 0 0 H ${w} V ${h} H 0 Z`
      : '';

  return (
    <div
      ref={containerRef}
      className="fixed z-40 pointer-events-none"
      style={{
        top: INSET,
        right: INSET,
        bottom: INSET,
        left: INSET,
        opacity: deepMode ? 0.8 : 0,
        transition: deepMode
          ? 'opacity 600ms ease-out 200ms'
          : 'opacity 300ms ease-in',
      }}
    >
      {w > 0 && h > 0 && (
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox={`0 0 ${w} ${h}`}
          fill="none"
        >
          <defs>
            <linearGradient
              id="deep-border-grad"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2={String(w)}
              y2={String(h)}
            >
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="33%" stopColor="#3b82f6" />
              <stop offset="66%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
          <path
            d={path}
            stroke="url(#deep-border-grad)"
            strokeWidth="8"
            pathLength={PATH_LENGTH}
            strokeDasharray={DASH_ARRAY}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="deep-orbit-stroke"
          />
        </svg>
      )}
    </div>
  );
}
