"use client";

import React from "react";
import type { DefinitionCardData } from "@/data/hover-cards";

interface DefinitionCardProps {
  data: DefinitionCardData;
  variant?: "portfolio" | "blog";
}

function getLinkLabel(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    if (hostname.includes("youtube")) return "Watch";
    if (hostname.includes("wiley") || hostname.includes("doi.org"))
      return "Read paper";
    return "View source";
  } catch {
    return "View source";
  }
}

export default function DefinitionCard({
  data,
  variant = "portfolio",
}: DefinitionCardProps) {
  const isBlog = variant === "blog";
  const kind = data.kind || "clarification";

  // Kind-based accent colors (blog only; portfolio keeps blue-to-emerald)
  const accentGradient = isBlog
    ? kind === "reference"
      ? "bg-gradient-to-r from-blue-400 to-cyan-400"
      : kind === "aside"
        ? "bg-gradient-to-r from-amber-400 to-orange-400"
        : "bg-gradient-to-r from-purple-400 to-purple-600"
    : "bg-gradient-to-r from-blue-400 to-emerald-400";

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

      <div className={`w-8 h-px mb-2 ${accentGradient}`} />

      <p
        className={`
          text-xs leading-relaxed font-light
          ${isBlog ? "text-gray-400" : "text-gray-600 dark:text-gray-400"}
        `}
      >
        {data.definition}
      </p>

      {(data.source || data.link) && (
        <div className="mt-2 flex items-center justify-between gap-2">
          {data.source && (
            <p className="text-[10px] text-gray-500 italic truncate">
              {data.source}
            </p>
          )}
          {data.link && (
            <a
              href={data.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`
                text-[10px] font-medium shrink-0
                ${isBlog
                  ? "text-purple-400 hover:text-purple-300"
                  : "text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
                }
                transition-colors duration-150
              `}
            >
              {getLinkLabel(data.link)} &rarr;
            </a>
          )}
        </div>
      )}
    </div>
  );
}
