"use client";
import React, { useRef, useEffect, useState } from 'react';

/**
 * Universal contained mouse glow component
 * Provides a cursor-following glow effect that is clipped to the parent element's boundaries
 * 
 * Features:
 * - Automatically detects mobile devices and disables on touch-only devices
 * - Smooth gradient falloff for natural lighting effect
 * - Customizable colors via CSS custom properties
 * - Works with any parent container (cards, sections, headers, etc.)
 * - Performance optimized with requestAnimationFrame
 * 
 * Usage:
 * Add this component as a child of any element you want to have a contained glow.
 * The parent must have `position: relative` and `overflow: hidden` for proper clipping.
 * 
 * @param color - RGB values for the glow color (e.g., "147, 197, 253" for blue)
 * @param intensity - Opacity of the glow at its center (0-1), default 0.4
 * @param size - Size of the glow circle in pixels, default 200
 */

interface ContainedMouseGlowProps {
  color?: string;
  intensity?: number;
  size?: number;
}

export default function ContainedMouseGlow({ 
  color = "147, 197, 253", // Default: light blue
  intensity = 0.4,
  size = 200
}: ContainedMouseGlowProps) {
  const glowRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [hasPointer, setHasPointer] = useState(true);
  // Store global mouse position to handle scroll events
  const mousePositionRef = useRef({ clientX: 0, clientY: 0 });

  useEffect(() => {
    // Detect if device has a fine pointer (mouse) vs coarse pointer (touch)
    // Mobile devices without mouse won't show the glow
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

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      }
    };
  }, []);

  // Track global mouse position across the entire window
  // This ensures we always know where the cursor is, even before hovering
  useEffect(() => {
    if (!hasPointer) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      // Continuously track mouse position globally
      mousePositionRef.current = { clientX: e.clientX, clientY: e.clientY };
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [hasPointer]);

  useEffect(() => {
    const parent = glowRef.current?.parentElement;
    if (!parent || !hasPointer) return;

    // Helper function to update position based on current mouse and card locations
    const updatePosition = () => {
      const rect = parent.getBoundingClientRect();
      const x = mousePositionRef.current.clientX - rect.left;
      const y = mousePositionRef.current.clientY - rect.top;
      setPosition({ x, y });
    };

    const handleMouseEnter = () => {
      setIsHovering(true);
      // Immediately update position when entering, using stored global mouse position
      updatePosition();
    };

    const handleMouseLeave = () => {
      setIsHovering(false);
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Update stored position (though global handler already does this)
      mousePositionRef.current = { clientX: e.clientX, clientY: e.clientY };
      // Direct position update for instant cursor tracking
      updatePosition();
    };

    // Handle scroll events - recalculate position as the card moves under the mouse
    // This ensures the glow follows the card during scrolling without waiting for mousemove
    const handleScroll = () => {
      if (isHovering) {
        updatePosition();
      }
    };

    parent.addEventListener('mouseenter', handleMouseEnter);
    parent.addEventListener('mouseleave', handleMouseLeave);
    parent.addEventListener('mousemove', handleMouseMove);
    // Listen to scroll on window to catch all scroll events (page scroll, container scroll)
    window.addEventListener('scroll', handleScroll, true); // useCapture=true to catch all scroll phases

    return () => {
      parent.removeEventListener('mouseenter', handleMouseEnter);
      parent.removeEventListener('mouseleave', handleMouseLeave);
      parent.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [hasPointer, isHovering]);

  // Don't render on mobile/touch devices
  if (!hasPointer) {
    return null;
  }

  return (
    <div
      ref={glowRef}
      className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden"
      style={{
        opacity: isHovering ? 1 : 0,
        transition: 'opacity 300ms ease-out',
      }}
    >
      {/* Main glow circle that follows the cursor - instant tracking with no delay, even during scroll */}
      <div
        className="absolute"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle, rgba(${color}, ${intensity}) 0%, rgba(${color}, ${intensity * 0.5}) 40%, rgba(${color}, 0) 70%)`,
          filter: 'blur(40px)',
          // No transition on position - instant cursor tracking and scroll updates
          willChange: 'transform',
        }}
      />
    </div>
  );
}

