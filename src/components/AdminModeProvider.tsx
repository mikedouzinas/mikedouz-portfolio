"use client";

import React, { createContext, useEffect, useSyncExternalStore, type ReactNode } from "react";

interface AdminModeContextType {
  adminMode: boolean;
}

export const AdminModeContext = createContext<AdminModeContextType>({ adminMode: false });

const STORAGE_KEY = "mv-admin-mode";

// localStorage-backed external store so admin mode can be read SSR-safely
// (server snapshot is always false) without synchronous setState-in-effect.
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function readStore(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function AdminModeProvider({ children }: { children: ReactNode }) {
  const adminMode = useSyncExternalStore(subscribe, readStore, () => false);

  // One-time: reconcile the ?admin=… query param with localStorage and strip
  // it from the URL. This only writes to external systems (localStorage, URL),
  // then notifies the store; it never calls setState synchronously.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const adminParam = params.get("admin");
      const expectedKey = process.env.NEXT_PUBLIC_ADMIN_MODE_KEY;

      if (adminParam === "off") {
        localStorage.removeItem(STORAGE_KEY);
        emit();
      } else if (adminParam && expectedKey && adminParam === expectedKey) {
        localStorage.setItem(STORAGE_KEY, "true");
        emit();
      }

      // Strip admin param from URL
      if (adminParam) {
        params.delete("admin");
        const newUrl = params.toString()
          ? `${window.location.pathname}?${params.toString()}`
          : window.location.pathname;
        window.history.replaceState({}, "", newUrl);
      }
    } catch {
      // SSR or localStorage unavailable
    }
  }, []);

  return (
    <AdminModeContext.Provider value={{ adminMode }}>
      {children}
    </AdminModeContext.Provider>
  );
}
