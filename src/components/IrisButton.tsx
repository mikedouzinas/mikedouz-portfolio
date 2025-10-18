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
  // Track palette open state to detect close actions immediately
  const isPaletteOpen = useRef(false);

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

  /**
   * Animation effect when Cmd+K is pressed
   * Forward animation: Small green gradient in center expands outward to both edges
   * - Background becomes solid blue
   * - Green gradient starts in center and splits, moving to left and right edges
   * - Results in two small gradients at edges with blue interior
   * - Gradients stay at edges while palette is open
   * 
   * Reverse animation when palette closes:
   * - Two gradients at edges contract back toward center
   * - Merge in center and fade out
   * - Background returns to original gradient
   * 
   * Close detection strategy (Clean & Professional):
   * - IrisPalette dispatches 'mv-close-cmdk' event synchronously when closing starts
   * - This event is fired BEFORE any React state updates, ensuring immediate animation
   * - No fragile DOM inspection, no event interception needed
   * - Simple event-driven architecture with clear component boundaries
   */
  useEffect(() => {
    /**
     * Trigger reverse animation
     * Called when IrisPalette dispatches the close event
     */
    const triggerReverseAnimation = () => {
      if (!isPaletteOpen.current || !buttonRef.current || !glowRef.current) return;
      
      isPaletteOpen.current = false;
      const button = buttonRef.current;
      const glow = glowRef.current;
      const { width, height } = button.getBoundingClientRect();
      const y = height / 2;
      const centerX = width / 2;

      // Remove any existing transitions for immediate start
      glow.style.transition = 'none';
      button.style.transition = 'none';

      // Reverse animation duration
      const duration = 350;
      let startTime: number | null = null;

      /**
       * Reverse animation step
       * Contracts two gradients from edges back to center, then fades out
       */
      const reverseAnimationStep = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease-in cubic for smooth acceleration toward center
        const easedProgress = Math.pow(progress, 3);
        
        // Calculate distance - starts at max (edges), contracts to 0 (center)
        const maxDistance = centerX;
        const currentDistance = maxDistance * (1 - easedProgress);
        
        // Two gradients moving from edges back to center
        const leftX = centerX - currentDistance; // Moves from left edge back to center
        const rightX = centerX + currentDistance; // Moves from right edge back to center
        
        glow.style.background = `
          radial-gradient(circle at ${leftX}px ${y}px, rgba(34, 197, 94, 0.9), rgba(34, 197, 94, 0.5) 15%, transparent 40%),
          radial-gradient(circle at ${rightX}px ${y}px, rgba(34, 197, 94, 0.9), rgba(34, 197, 94, 0.5) 15%, transparent 40%)
        `;

        if (progress < 1) {
          requestAnimationFrame(reverseAnimationStep);
        } else {
          // Reverse animation complete - fade out and reset
          glow.style.transition = 'opacity 150ms ease-out';
          glow.style.opacity = '0';
          button.style.transition = 'background 150ms ease-out';
          button.style.background = ''; // Return to original gradient
        }
      };

      // Start animation immediately on next frame
      requestAnimationFrame(reverseAnimationStep);
    };

    /**
     * Global keydown handler
     * Handles Cmd+K to open palette and start forward animation
     */
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd+K to open palette and start forward animation
      if (event.metaKey && event.key === 'k' && !isAnimating.current) {
        event.preventDefault();

        if (buttonRef.current && glowRef.current) {
          isAnimating.current = true;
          isPaletteOpen.current = true; // Track that palette is opening
          
          const button = buttonRef.current;
          const glow = glowRef.current;
          const { width, height } = button.getBoundingClientRect();
          const y = height / 2;
          const centerX = width / 2;

          // Animation duration in milliseconds
          const duration = 600;
          let startTime: number | null = null;
          
          // Set background to solid blue for animation
          button.style.transition = 'background 200ms ease-out';
          button.style.background = '#2563eb'; // Solid blue-600

          // Ensure glow layer is visible
          glow.style.transition = 'opacity 100ms ease-out';
          glow.style.opacity = '1';

          /**
           * Forward animation step
           * Starts with a single gradient in center, expands it outward to create two gradients at edges
           * Uses easing for smooth acceleration
           */
          const animationStep = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease-out cubic for smooth deceleration as gradients reach edges
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            
            // Calculate distance from center to edges
            const maxDistance = centerX;
            const currentDistance = maxDistance * easedProgress;
            
            // Two gradients moving symmetrically from center to edges
            const leftX = centerX - currentDistance; // Moves from center to left edge (0)
            const rightX = centerX + currentDistance; // Moves from center to right edge (width)
            
            // Create two radial gradients at symmetric positions
            // Using 15% for compact, focused green highlights
            glow.style.background = `
              radial-gradient(circle at ${leftX}px ${y}px, rgba(34, 197, 94, 0.9), rgba(34, 197, 94, 0.5) 15%, transparent 40%),
              radial-gradient(circle at ${rightX}px ${y}px, rgba(34, 197, 94, 0.9), rgba(34, 197, 94, 0.5) 15%, transparent 40%)
            `;
            glow.style.transition = 'none';

            if (progress < 1) {
              requestAnimationFrame(animationStep);
            } else {
              // Animation complete - keep gradients at edges while palette is open
              // Leave glow visible with gradients at edges
              isAnimating.current = false;
            }
          };

          requestAnimationFrame(animationStep);
        }
      }
    };

    /**
     * Listen for close event from IrisPalette
     * IrisPalette dispatches this event synchronously when closing begins,
     * ensuring immediate animation start without waiting for React state updates
     */
    const handlePaletteClose = () => {
      triggerReverseAnimation();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mv-close-cmdk', handlePaletteClose);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mv-close-cmdk', handlePaletteClose);
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

