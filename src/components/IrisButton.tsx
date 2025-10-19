"use client";
import React, { useRef, useEffect } from 'react';

// Final margin: stop the reverse animation this many px short of exact center
// This allows us to restore the base gradient under a faint green band, masking the handoff
const FINAL_MARGIN_PX = 8;

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
   * Does not change base background to avoid dimming
   */
  const handleMouseEnter = () => {
    if (buttonRef.current) {
      buttonRef.current.style.transition = 'transform 300ms ease-out';
      // Keep base gradient intact - hover glow happens on overlay only
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
    // Suppress hover writes while animating or while palette is open
    if (!buttonRef.current || isAnimating.current || isPaletteOpen.current) return;
    
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
    // The green color is strong at cursor position and gradually fades to transparent green
    // Using 15% for a more compact, focused green highlight that matches the animation size
    // Fade to transparent green (not transparent black) to avoid dimming the blue base
    // Use backgroundImage (not background shorthand) to avoid implicit background-color changes
    if (glowRef.current) {
      glowRef.current.style.backgroundImage = `radial-gradient(circle at ${x}px ${y}px, rgba(34, 197, 94, 0.9), rgba(34, 197, 94, 0.5) 15%, rgba(34, 197, 94, 0) 40%, rgba(34, 197, 94, 0) 100%)`;
      glowRef.current.style.opacity = "1";
    }
  };

  /**
   * Handle mouse leave event
   * Resets button to default state with smooth transition
   * Only resets transform and glow, not background (it was never changed)
   */
  const handleMouseLeave = () => {
    if (buttonRef.current) {
      buttonRef.current.style.transition = 'transform 300ms ease-out';
      buttonRef.current.style.transform = 'scale(1) translateY(0)';
      // Background was never changed, so no need to reset it
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
   * - Base gradient background remains unchanged (no dimming)
   * - Green gradient starts in center and splits, moving to left and right edges
   * - Results in two small gradients at edges overlaid on the base gradient
   * - Gradients stay at edges while palette is open
   * 
   * Reverse animation when palette closes:
   * - Two gradients at edges contract back toward center
   * - Merge in center and fade out
   * - Base gradient background remains unchanged throughout
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
      isAnimating.current = true; // Prevent hover from reintroducing green during reverse
      const button = buttonRef.current;
      const glow = glowRef.current;
      const { width, height } = button.getBoundingClientRect();
      const y = height / 2;
      const centerX = width / 2;

      // Keep blue-only background throughout reverse animation
      // Do NOT restore original gradient yet - wait until glow fully fades out

      // Remove any existing transitions for immediate start
      glow.style.transition = 'none';
      button.style.transition = 'none';

      // Reverse animation duration
      const duration = 350;
      let startTime: number | null = null;

      /**
       * Reverse animation step
       * Contracts two gradients from edges back toward center, stopping short by FINAL_MARGIN_PX
       * This leaves a faint green band that masks the base gradient handoff
       */
      const reverseAnimationStep = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease-in cubic for smooth acceleration toward center
        const easedProgress = Math.pow(progress, 3);
        
        // Calculate distance - starts at max (edges), contracts toward center
        // Clamp to FINAL_MARGIN_PX to keep a faint green band for seamless handoff
        const maxDistance = centerX;
        const stopDistance = Math.max(0, FINAL_MARGIN_PX);
        const currentDistance = Math.max(
          stopDistance,
          maxDistance * (1 - easedProgress)
        );
        
        // Two gradients moving from edges back toward center (but stopping short)
        const leftX = centerX - currentDistance; // Moves from left edge toward center
        const rightX = centerX + currentDistance; // Moves from right edge toward center
        
        // Use hue-matched transparent stops to avoid dimming blue areas
        // Use backgroundImage (not background shorthand) to avoid implicit background-color changes
        glow.style.backgroundImage = `
          radial-gradient(circle at ${leftX}px ${y}px, rgba(34, 197, 94, 0.9), rgba(34, 197, 94, 0.5) 15%, rgba(34, 197, 94, 0) 40%, rgba(34, 197, 94, 0) 100%),
          radial-gradient(circle at ${rightX}px ${y}px, rgba(34, 197, 94, 0.9), rgba(34, 197, 94, 0.5) 15%, rgba(34, 197, 94, 0) 40%, rgba(34, 197, 94, 0) 100%)
        `;

        if (progress < 1) {
          requestAnimationFrame(reverseAnimationStep);
        } else {
          // Reverse animation complete - gradients frozen at FINAL_MARGIN_PX from center
          // Overlay now shows a faint green band; restore base gradient under it invisibly
          
          // Restore original gradient from Tailwind class while overlay is still visible
          // The green band masks this change
          button.style.backgroundImage = '';
          
          // Now fade out the overlay (freeze: do not update backgroundImage anymore)
          glow.style.transition = 'opacity 150ms ease-out';
          
          // Force reflow to ensure browser recognizes new transition before opacity change
          void glow.offsetWidth;
          
          // Fade out
          glow.style.opacity = '0';
          
          // Wait for opacity transition to complete before final cleanup
          const handleGlowFadeComplete = (e: TransitionEvent) => {
            // Only act on the opacity transition (not any other properties)
            if (e.propertyName !== 'opacity') return;
            
            // Final cleanup: clear the glow background
            glow.style.backgroundImage = 'none';
            glow.style.transition = 'none';
            
            // Re-enable hover interactions
            isAnimating.current = false;
            isPaletteOpen.current = false;
            
            // Remove this one-time listener
            glow.removeEventListener('transitionend', handleGlowFadeComplete);
          };
          
          glow.addEventListener('transitionend', handleGlowFadeComplete);
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
          
          // Set base to pure blue gradient during animation (no green via-color)
          // This prevents green wash while the animation runs
          button.style.backgroundImage = 'linear-gradient(90deg, #2563EB, #2563EB)';

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
            // Use hue-matched transparent stops to avoid dimming blue areas
            // Use backgroundImage (not background shorthand) to avoid implicit background-color changes
            glow.style.backgroundImage = `
              radial-gradient(circle at ${leftX}px ${y}px, rgba(34, 197, 94, 0.9), rgba(34, 197, 94, 0.5) 15%, rgba(34, 197, 94, 0) 40%, rgba(34, 197, 94, 0) 100%),
              radial-gradient(circle at ${rightX}px ${y}px, rgba(34, 197, 94, 0.9), rgba(34, 197, 94, 0.5) 15%, rgba(34, 197, 94, 0) 40%, rgba(34, 197, 94, 0) 100%)
            `;
            glow.style.transition = 'none';

            if (progress < 1) {
              requestAnimationFrame(animationStep);
            } else {
              // Animation complete - keep gradients at edges while palette is open
              // Keep isAnimating true to hold the edge frame and prevent hover repaints
              // It will be set to false only after reverse animation completes
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
      className="group relative inline-flex items-center justify-center sm:justify-between px-3 py-2 bg-gradient-to-r from-blue-600 via-green-600 to-blue-600 text-white font-semibold rounded-xl shadow-lg transition-all duration-200 hover:shadow-xl w-full overflow-hidden"
    >
      {/* Cursor-following green glow overlay - creates dynamic gradient effect on hover */}
      {/* Uses hue-matched transparent stops to prevent dimming of base gradient */}
      {/* Layer stability: compositor layer pinning to prevent repaint jitter */}
      <div 
        ref={glowRef} 
        className="absolute inset-0 rounded-xl pointer-events-none" 
        style={{ 
          opacity: 0,
          backgroundColor: 'transparent',
          willChange: 'opacity, background-image',
          backfaceVisibility: 'hidden',
          transform: 'translateZ(0)'
        }} 
      />
      
      {/* Button content - positioned above the glow effect */}
      <span className="text-xs relative z-10 whitespace-nowrap">Questions? Ask Iris</span>
      
      {/* Keyboard shortcut hint - two separate key tiles for ⌘ and K */}
      {/* Hidden on mobile (sm: breakpoint and below), visible on desktop */}
      {/* Each tile styled like a keyboard key with rounded corners, border, and shadow */}
      <div className="hidden sm:flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity relative z-10">
        {/* Command key tile */}
        <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] rounded-md border border-white/20 bg-white/10 shadow-inner text-[11px] font-medium leading-none">
          ⌘
        </span>
        {/* K key tile */}
        <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] rounded-md border border-white/20 bg-white/10 shadow-inner text-[11px] font-medium leading-none">
          K
        </span>
      </div>
    </button>
  );
}

