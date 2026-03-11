"use client";

import React from "react";
import type { DefinitionCardData } from "@/data/hover-cards";

interface DefinitionCardProps {
  data: DefinitionCardData;
  variant?: "portfolio" | "blog";
}

export default function DefinitionCard({
  data,
  variant = "portfolio",
}: DefinitionCardProps) {
  const isBlog = variant === "blog";

  return (
    <div
      className={`
        ${isBlog ? "w-[280px]" : "w-[260px]"}
        rounded-xl overflow-hidden
        ${isBlog ? "bg-gray-800/95" : "bg-white/90 dark:bg-gray-900/90"}
        backdrop-blur-md shadow-xl
        ${isBlog ? "border-gray-700/50" : "border-gray-200/50 dark:border-gray-700/50"}
        border px-4 py-3
      `}
    >
      <div className="flex items-baseline gap-2 mb-1.5">
        <span
          className={`
            text-base font-serif font-semibold italic
            ${isBlog ? "text-gray-100" : "text-gray-900 dark:text-gray-100"}
          `}
        >
          {data.term}
        </span>
        {data.greek && (
          <span className="text-xs text-gray-400 dark:text-gray-500 font-light">
            {data.greek}
          </span>
        )}
      </div>

      <div
        className={`
          w-8 h-px mb-2
          ${
            isBlog
              ? "bg-gradient-to-r from-purple-400 to-purple-600"
              : "bg-gradient-to-r from-blue-400 to-emerald-400"
          }
        `}
      />

      <p
        className={`
          text-xs leading-relaxed font-light
          ${isBlog ? "text-gray-400" : "text-gray-600 dark:text-gray-400"}
        `}
      >
        {data.definition}
      </p>

      {data.source && (
        <p className="mt-2 text-[10px] text-gray-500 italic">{data.source}</p>
      )}
    </div>
  );
}
