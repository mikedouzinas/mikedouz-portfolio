"use client";
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface PageTransitionProps {
  children: React.ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
}

// Hook for triggering page transitions
export function usePageTransition() {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const router = useRouter();

  const transitionTo = (path: string) => {
    setIsTransitioning(true);
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: var(--tw-bg-opacity) ? rgb(249 250 251 / var(--tw-bg-opacity)) : rgb(249 250 251);
      z-index: 9999;
      opacity: 0;
      transition: opacity 0.3s ease-in-out;
    `;
    
    // Check for dark mode
    if (document.documentElement.classList.contains('dark')) {
      overlay.style.background = 'rgb(17 24 39)';
    }
    
    document.body.appendChild(overlay);
    
    // Trigger fade in
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
    });
    
    // Navigate after fade completes
    setTimeout(() => {
      router.push(path);
      // Remove overlay after navigation
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        setIsTransitioning(false);
      }, 100);
    }, 300);
  };

  return { transitionTo, isTransitioning };
} 