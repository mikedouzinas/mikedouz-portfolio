"use client";
import React, { useState, useEffect } from "react";

export default function MouseGlow() {
  const [position, setPosition] = useState({ x: -100, y: -100 });
  // Track whether cursor is over an element with custom glow (to hide global glow)
  const [isOverCustomGlow, setIsOverCustomGlow] = useState(false);
  // Track if device has a pointer (mouse) - mobile devices without mouse won't show glow
  const [hasPointer, setHasPointer] = useState(true);

  useEffect(() => {
    // Detect if device has a fine pointer (mouse) vs coarse pointer (touch)
    // This ensures glow only appears on devices with actual mouse cursors
    const checkPointerType = () => {
      const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
      setHasPointer(hasFinePointer);
    };

    checkPointerType();

    const mediaQuery = window.matchMedia('(pointer: fine)');
    const handleChange = () => checkPointerType();
    
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    }

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
      
      // Check if the element under the cursor (or any parent) has a custom or contained glow
      // Walk up the DOM tree to check for data-has-custom-glow or data-has-contained-glow attributes
      let element = e.target as HTMLElement | null;
      let hasCustomGlow = false;
      
      while (element && element !== document.body) {
        if (element.dataset?.hasCustomGlow === "true" || element.dataset?.hasContainedGlow === "true") {
          hasCustomGlow = true;
          break;
        }
        element = element.parentElement;
      }
      
      // Update visibility state if it changed
      // This prevents unnecessary re-renders when moving within same glow context
      if (hasCustomGlow !== isOverCustomGlow) {
        setIsOverCustomGlow(hasCustomGlow);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      }
    };
  }, [isOverCustomGlow]);

  // Don't render glow on mobile/touch devices - only show on devices with mouse pointers
  if (!hasPointer) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed top-0 left-0 z-50"
      style={{
        transform: `translate(${position.x - 50}px, ${position.y - 50}px)`,
        // Hide global glow when hovering over elements with custom/contained glow effects
        opacity: isOverCustomGlow ? 0 : 1,
        // Smooth transition when hiding/showing to avoid jarring visual changes
        transition: 'opacity 150ms ease-out'
      }}
    >
      {/* Simple ring-style glow that looked better than the gradient approach */}
      <div className="w-20 h-20 bg-blue-300 dark:bg-blue-500 opacity-50 rounded-full filter blur-3xl mix-blend-screen" />
    </div>
  );
}
