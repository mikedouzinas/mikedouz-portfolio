"use client";
import React, { useEffect, useRef, useState } from "react";

/**
 * Spider web pattern contained within a parent element.
 *
 * Adapts the full-page WebPattern (src/app/the-web/components/WebPattern.tsx)
 * into a card-bounded version: the parent must have position: relative + overflow: hidden,
 * the cursor reveals the web through a radial mask that tracks local mouse position.
 */
interface ContainedWebPatternProps {
  color?: string;
  revealRadius?: number;
}

export default function ContainedWebPattern({
  color = "#2dd4bf",
  revealRadius = 220,
}: ContainedWebPatternProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [pos, setPos] = useState({ x: -500, y: -500 });
  const [hasPointer, setHasPointer] = useState(true);
  const [size, setSize] = useState({ w: 800, h: 400 });
  const rafRef = useRef<number>(0);

  // Defer all rendering until after mount to prevent SSR hydration mismatch on the SVG.
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine)");
    const update = () => setHasPointer(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const parent = rootRef.current?.parentElement;
    if (!parent || !hasPointer) return;

    const updateSize = () => {
      const rect = parent.getBoundingClientRect();
      setSize({ w: rect.width, h: rect.height });
    };
    updateSize();

    const ro = new ResizeObserver(updateSize);
    ro.observe(parent);

    const onEnter = () => setIsHovering(true);
    const onLeave = () => setIsHovering(false);
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const rect = parent.getBoundingClientRect();
        setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      });
    };

    parent.addEventListener("mouseenter", onEnter);
    parent.addEventListener("mouseleave", onLeave);
    parent.addEventListener("mousemove", onMove);
    return () => {
      ro.disconnect();
      parent.removeEventListener("mouseenter", onEnter);
      parent.removeEventListener("mouseleave", onLeave);
      parent.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, [hasPointer, mounted]);

  if (!mounted || !hasPointer) return null;

  // Build the web geometry. The center floats relative to the parent;
  // we anchor it at the parent's center so the web composes nicely
  // regardless of card shape.
  const cx = size.w / 2;
  const cy = size.h / 2;
  const numRadials = 14;
  const numArcs = 9;
  // Reach the far corner so the web fully covers the card.
  const maxRadius = Math.hypot(size.w, size.h) / 2;

  const radialAngles = Array.from({ length: numRadials }, (_, i) =>
    (i / numRadials) * Math.PI * 2
  );

  const radialLines = radialAngles.map((angle) => {
    const endX = cx + Math.cos(angle) * maxRadius;
    const endY = cy + Math.sin(angle) * maxRadius;
    return `M ${cx} ${cy} L ${endX} ${endY}`;
  });

  const arcPaths: string[] = [];
  for (let arcIdx = 1; arcIdx <= numArcs; arcIdx++) {
    const radius = (arcIdx / numArcs) * maxRadius;
    const jitter = (i: number) => {
      const seed = (arcIdx * 7 + i * 13) % 17;
      return 1 + (seed - 8.5) * 0.008;
    };
    let d = "";
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

  const maskImage = `radial-gradient(circle ${revealRadius}px at ${pos.x}px ${pos.y}px, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.22) 45%, transparent 100%)`;

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none rounded-[inherit] overflow-hidden"
      style={{
        opacity: isHovering ? 1 : 0,
        transition: "opacity 300ms ease-out",
        WebkitMaskImage: maskImage,
        maskImage,
      }}
    >
      <svg
        width={size.w}
        height={size.h}
        viewBox={`0 0 ${size.w} ${size.h}`}
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        {radialLines.map((d, i) => (
          <path
            key={`r-${i}`}
            d={d}
            fill="none"
            stroke={color}
            strokeWidth="0.9"
            strokeLinecap="round"
            opacity="0.55"
          />
        ))}
        {arcPaths.map((d, i) => (
          <path
            key={`a-${i}`}
            d={d}
            fill="none"
            stroke={color}
            strokeWidth="0.75"
            strokeLinecap="round"
            opacity="0.5"
          />
        ))}
        {dots.map((dot, i) => (
          <circle key={`d-${i}`} cx={dot.x} cy={dot.y} r="1.2" fill={color} opacity="0.6" />
        ))}
      </svg>
    </div>
  );
}
