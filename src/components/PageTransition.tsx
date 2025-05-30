"use client";
import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

interface PageTransitionProps {
  children: ReactNode;
}

// This component is deprecated - use automatic transitions via PageTransitionWrapper in layout.tsx
export default function PageTransition({ children }: PageTransitionProps) {
  return <>{children}</>;
}

// Simple hook for smooth page transitions using View Transitions API
export function usePageTransition() {
  const router = useRouter();

  const transitionTo = useCallback((path: string) => {
    // Check if browser supports View Transitions
    if ('startViewTransition' in document) {
      document.startViewTransition(() => {
        router.push(path);
      });
    } else {
      // Fallback for browsers without View Transitions
      router.push(path);
    }
  }, [router]);

  return { 
    transitionTo, 
    isTransitioning: false 
  };
} 