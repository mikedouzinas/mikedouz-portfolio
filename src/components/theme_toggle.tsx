"use client";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="fixed bottom-4 right-4 p-2 rounded-full bg-secondaryBlue text-white hover:bg-primaryBlue transition-colors"
      aria-label="Toggle Dark Mode"
    >
      <div className="relative w-6 h-6">
        <Sun
          className={`absolute inset-0 w-6 h-6 transition-opacity duration-300 ${
            theme === "dark" ? "opacity-100" : "opacity-0"
          }`}
        />
        <Moon
          className={`absolute inset-0 w-6 h-6 transition-opacity duration-300 ${
            theme === "dark" ? "opacity-0" : "opacity-100"
          }`}
        />
      </div>
    </button>
  );
}
