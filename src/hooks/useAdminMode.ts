"use client";

import { useContext } from "react";
import { AdminModeContext } from "@/components/AdminModeProvider";

export function useAdminMode(): boolean {
  return useContext(AdminModeContext).adminMode;
}
