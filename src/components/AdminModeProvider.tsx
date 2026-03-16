"use client";

import React, { createContext, useState, useEffect, type ReactNode } from "react";

interface AdminModeContextType {
  adminMode: boolean;
}

export const AdminModeContext = createContext<AdminModeContextType>({ adminMode: false });

const STORAGE_KEY = "mv-admin-mode";

export function AdminModeProvider({ children }: { children: ReactNode }) {
  const [adminMode, setAdminMode] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "true") setAdminMode(true);

      const params = new URLSearchParams(window.location.search);
      const adminParam = params.get("admin");
      const expectedKey = process.env.NEXT_PUBLIC_ADMIN_MODE_KEY;

      if (adminParam === "off") {
        localStorage.removeItem(STORAGE_KEY);
        setAdminMode(false);
      } else if (adminParam && expectedKey && adminParam === expectedKey) {
        localStorage.setItem(STORAGE_KEY, "true");
        setAdminMode(true);
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
