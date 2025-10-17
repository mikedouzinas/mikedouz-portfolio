"use client";
import React, { useRef, useEffect } from 'react';

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
  const isAnimating = useRef(false);

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
    if (!buttonRef.current || isAnimating.current) return;
    
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
    // Using 15% for a more compact, focused green highlight that matches the animation size
    if (glowRef.current) {
      glowRef.current.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(34, 197, 94, 0.9), rgba(34, 197, 94, 0.5) 15%, transparent 40%)`;
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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey && event.key === 'k' && !isAnimating.current) {
        event.preventDefault();

        if (buttonRef.current && glowRef.current) {
          isAnimating.current = true;
          const button = buttonRef.current;
          const glow = glowRef.current;
          const { width, height } = button.getBoundingClientRect();
          const y = height / 2;

          // Animation duration in milliseconds - increased for a smoother, more noticeable effect
          const duration = 600;
          let startTime: number | null = null;
          
          button.style.transition = 'none';
          // Keep the original gradient background during animation instead of solid blue
          // This matches the pre-animation state with the from-blue-600 via-green-600 to-blue-600 gradient

          glow.style.transition = 'opacity 100ms ease-out';
          glow.style.opacity = '1';

          const animationStep = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const firstAnimationEnd = 0.6;
            const secondAnimationStart = 0.4;
            
            const backgrounds = [];

            // Use 15% to match the compact, focused green highlight from the hover state
            // This ensures consistent visual size between hover and animation gradients
            if (progress < firstAnimationEnd) {
                const p = progress / firstAnimationEnd;
                const easedP = p * p;
                const x = (width / 2) + (width / 2) * easedP;
                backgrounds.push(`radial-gradient(circle at ${x}px ${y}px, rgba(34, 197, 94, 0.9), rgba(34, 197, 94, 0.5) 15%, transparent 40%)`);
            }

            if (progress > secondAnimationStart) {
                const p = (progress - secondAnimationStart) / (1.0 - secondAnimationStart);
                const easedP = 1 - (1 - p) * (1 - p);
                const x = 0 + (width / 2) * easedP;
                backgrounds.push(`radial-gradient(circle at ${x}px ${y}px, rgba(34, 197, 94, 0.9), rgba(34, 197, 94, 0.5) 15%, transparent 40%)`);
            }

            glow.style.background = backgrounds.join(', ');
            if (glow.style.transition !== 'none') {
                glow.style.transition = 'none';
            }

            if (progress < 1) {
              requestAnimationFrame(animationStep);
            } else {
              glow.style.transition = 'opacity 300ms ease-out';
              glow.style.opacity = '0';
              button.style.transition = '';
              button.style.background = '';
              isAnimating.current = false;
            }
          };

          requestAnimationFrame(animationStep);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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

