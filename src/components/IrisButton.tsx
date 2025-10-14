"use client";
import React, { useRef } from 'react';

/**
 * Interactive button component for Iris AI assistant
 * Features a cursor-following green light effect that responds to mouse movement
 * Similar to the profile picture's interactive glow, but with green highlight
 */
export default function IrisButton() {
  // Refs to control the button container and the cursor-following light effect
  const buttonRef = useRef<HTMLButtonElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const isFirstHover = useRef(true);

  /**
   * Handle mouse enter event
   * Sets up smooth transition for the initial hover state
   */
  const handleMouseEnter = () => {
    if (buttonRef.current) {
      buttonRef.current.style.transition = 'transform 300ms ease-out';
      buttonRef.current.style.background = '#2563eb'; // Solid blue-600
    }
    if (glowRef.current) {
      glowRef.current.style.transition = 'opacity 300ms ease-out';
    }
    isFirstHover.current = true;
  };

  /**
   * Handle mouse move event
   * Creates a cursor-following green light effect using radial gradient
   * The green highlight appears at cursor position, creating a dynamic gradient
   * Position is calculated relative to the button's bounding box
   */
  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current) return;
    
    // Get button position and calculate cursor position relative to button
    const rect = buttonRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // After first hover, use faster transitions for smoother cursor tracking
    if (!isFirstHover.current) {
      if (glowRef.current) {
        glowRef.current.style.transition = 'background 75ms ease-out, opacity 75ms ease-out';
      }
    } else {
      isFirstHover.current = false;
    }

    // Apply the raise effect on hover
    buttonRef.current.style.transform = 'scale(1.05) translateY(-2px)';
    
    // Create a radial gradient centered at cursor position with prominent green highlight
    // The green color is strong at cursor position and gradually fades, blending with blue
    if (glowRef.current) {
      glowRef.current.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(34, 197, 94, 0.9), rgba(34, 197, 94, 0.5) 40%, transparent 70%)`;
      glowRef.current.style.opacity = "1";
    }
  };

  /**
   * Handle mouse leave event
   * Resets button to default state with smooth transition
   */
  const handleMouseLeave = () => {
    if (buttonRef.current) {
      buttonRef.current.style.transition = 'transform 300ms ease-out';
      buttonRef.current.style.transform = 'scale(1) translateY(0)';
      buttonRef.current.style.background = ''; // Revert to CSS gradient
    }
    if (glowRef.current) {
      glowRef.current.style.transition = 'opacity 300ms ease-out';
      glowRef.current.style.opacity = "0";
    }
    isFirstHover.current = true;
  };

  /**
   * Dispatches custom event to open the Iris command palette
   */
  const handleClick = () => {
    window.dispatchEvent(new CustomEvent('mv-open-cmdk'));
  };

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="group relative inline-flex items-center justify-between px-4 py-2 bg-gradient-to-r from-blue-600 via-green-600 to-blue-600 text-white font-semibold rounded-xl shadow-lg transition-all duration-200 hover:shadow-xl w-full overflow-hidden"
    >
      {/* Cursor-following green glow overlay - creates dynamic gradient effect on hover */}
      <div 
        ref={glowRef} 
        className="absolute inset-0 rounded-xl pointer-events-none" 
        style={{ opacity: 0 }} 
      />
      
      {/* Button content - positioned above the glow effect */}
      <span className="text-xs relative z-10">Questions? Ask Iris</span>
      
      {/* Keyboard shortcut hint - desktop only, positioned above glow */}
      <div className="hidden sm:flex items-center gap-1 text-xs opacity-90 group-hover:opacity-100 transition-opacity relative z-10">
        <span className="font-mono bg-black/20 px-1.5 py-0.5 rounded text-xs flex items-center gap-1">
          <span className="text-xs">⌘</span>
          <span className="text-[10px]">K</span>
        </span>
      </div>
    </button>
  );
}

