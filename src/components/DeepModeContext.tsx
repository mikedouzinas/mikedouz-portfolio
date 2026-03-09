"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface DeepModeContextType {
  deepMode: boolean;
  toggleDeepMode: () => void;
}

const DeepModeContext = createContext<DeepModeContextType>({
  deepMode: false,
  toggleDeepMode: () => {},
});

const STORAGE_KEY = 'mv-deep-mode';

export function DeepModeProvider({ children }: { children: React.ReactNode }) {
  const [deepMode, setDeepMode] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'true') {
        setDeepMode(true);
      }
    } catch {
      // SSR or localStorage unavailable
    }
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(deepMode));
    } catch {
      // localStorage unavailable
    }
  }, [deepMode]);

  const toggleDeepMode = useCallback(() => {
    setDeepMode(prev => !prev);
  }, []);

  return (
    <DeepModeContext.Provider value={{ deepMode, toggleDeepMode }}>
      {children}
    </DeepModeContext.Provider>
  );
}

export function useDeepMode() {
  return useContext(DeepModeContext);
}
