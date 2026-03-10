"use client";

import React, { useState, useRef, useCallback } from "react";

interface SearchBarProps {
  onSearch: (query: string) => void;
}

export default function SearchBar({ onSearch }: SearchBarProps) {
  const [value, setValue] = useState("");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setValue(newValue);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        onSearch(newValue);
      }, 300);
    },
    [onSearch]
  );

  const handleClear = useCallback(() => {
    setValue("");
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    onSearch("");
  }, [onSearch]);

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder="Search the web..."
        className="w-full px-4 py-2.5 text-sm bg-gray-800/50 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20"
      />
      {value && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors text-sm"
          aria-label="Clear search"
        >
          &times;
        </button>
      )}
    </div>
  );
}
