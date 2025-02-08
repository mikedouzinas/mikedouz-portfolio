"use client";
import React, { useState, useEffect } from "react";

export default function MouseGlow() {
  const [position, setPosition] = useState({ x: -100, y: -100 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div
      className="pointer-events-none fixed top-0 left-0 z-50"
      style={{
        transform: `translate(${position.x - 50}px, ${position.y - 50}px)`
      }}
    >
      <div className="w-20 h-20 bg-blue-300 dark:bg-blue-500 opacity-50 rounded-full filter blur-3xl mix-blend-screen" />
    </div>
  );
}
