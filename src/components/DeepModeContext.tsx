"use client";
import React, { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from 'react';

interface DeepModeContextType {
  deepMode: boolean;
  toggleDeepMode: () => void;
}

const DeepModeContext = createContext<DeepModeContextType>({
  deepMode: false,
  toggleDeepMode: () => {},
});

const STORAGE_KEY = 'mv-deep-mode';

// External store backing deep mode. It is the single source of truth so the
// value can be read SSR-safely via useSyncExternalStore (server snapshot is
// always false, the client snapshot reads localStorage after mount) and shared
// across every consumer without synchronous setState-in-effect.
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function readStore(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function setStore(next: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // localStorage unavailable
  }
  emit();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function DeepModeProvider({ children }: { children: React.ReactNode }) {
  const deepMode = useSyncExternalStore(subscribe, readStore, () => false);

  const toggleDeepMode = useCallback(() => {
    setStore(!readStore());
  }, []);

  // Keyboard shortcut: Cmd+Shift+. (Mac) / Ctrl+Shift+. (Windows) to toggle deep mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.code === 'Period' || e.key === '>' || e.key === '.')) {
        e.preventDefault();
        toggleDeepMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleDeepMode]);

  // Listen for toggle events from other components (e.g. Iris palette commands)
  useEffect(() => {
    const handleToggleEvent = () => toggleDeepMode();
    window.addEventListener('mv-toggle-deep-mode', handleToggleEvent);
    return () => window.removeEventListener('mv-toggle-deep-mode', handleToggleEvent);
  }, [toggleDeepMode]);

  return (
    <DeepModeContext.Provider value={{ deepMode, toggleDeepMode }}>
      {children}
    </DeepModeContext.Provider>
  );
}

export function useDeepMode() {
  return useContext(DeepModeContext);
}
