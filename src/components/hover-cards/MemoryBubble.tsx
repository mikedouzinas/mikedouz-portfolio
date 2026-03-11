"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import type { MemoryBubbleData, DefinitionCardData } from "@/data/hover-cards";

interface MemoryBubbleProps {
  data: MemoryBubbleData;
  href?: string;
  isTouchDevice: boolean;
  definition?: DefinitionCardData;
}

export default function MemoryBubble({
  data,
  href,
  isTouchDevice,
  definition,
}: MemoryBubbleProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imgErrors, setImgErrors] = useState<Set<number>>(new Set());
  const isFilmStrip = data.photos.length > 1;

  const goTo = useCallback(
    (index: number) => {
      setCurrentIndex(
        ((index % data.photos.length) + data.photos.length) % data.photos.length,
      );
    },
    [data.photos.length],
  );

  // Auto-advance every 2.5 seconds
  useEffect(() => {
    if (!isFilmStrip) return;
    const interval = setInterval(() => {
      goTo(currentIndex + 1);
    }, 2500);
    return () => clearInterval(interval);
  }, [isFilmStrip, currentIndex, goTo]);

  const handleImageError = (index: number) => {
    setImgErrors((prev) => new Set(prev).add(index));
  };

  return (
    <div className="w-[240px] rounded-xl overflow-hidden bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-xl border border-gray-200/50 dark:border-gray-700/50">
      {/* Photo area — true crossfade with all images stacked */}
      <div className="relative w-full h-[160px] overflow-hidden bg-gray-100 dark:bg-gray-800">
        {data.photos.map((photo, i) => (
          <motion.div
            key={i}
            initial={false}
            animate={{ opacity: i === currentIndex ? 1 : 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="absolute inset-0"
            style={{ zIndex: i === currentIndex ? 1 : 0 }}
          >
            {imgErrors.has(i) ? (
              <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                <span className="text-xs text-gray-400 font-light">
                  {data.caption || "Memory"}
                </span>
              </div>
            ) : (
              <Image
                src={photo}
                alt={data.caption || "Memory"}
                fill
                className="object-cover"
                sizes="240px"
                onError={() => handleImageError(i)}
              />
            )}
          </motion.div>
        ))}

        {/* Navigation arrows */}
        {isFilmStrip && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goTo(currentIndex - 1);
              }}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center text-white/80 hover:text-white transition-all duration-150 backdrop-blur-sm"
              aria-label="Previous photo"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                className="mr-px"
              >
                <path
                  d="M6.5 2L3.5 5L6.5 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goTo(currentIndex + 1);
              }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center text-white/80 hover:text-white transition-all duration-150 backdrop-blur-sm"
              aria-label="Next photo"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                className="ml-px"
              >
                <path
                  d="M3.5 2L6.5 5L3.5 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </>
        )}

        {/* Dots */}
        {isFilmStrip && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {data.photos.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(i);
                }}
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                  i === currentIndex ? "bg-white" : "bg-white/40"
                }`}
                aria-label={`Photo ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Caption area */}
      <div className="px-3 py-2 flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400 font-light">
          {data.caption}
        </span>
        {isTouchDevice && href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-blue-500 dark:text-blue-400 font-medium hover:underline"
          >
            Visit &rarr;
          </a>
        )}
      </div>

      {/* Optional definition below caption */}
      {definition && (
        <div className="px-3 pb-3 pt-0">
          <div className="w-6 h-px bg-gradient-to-r from-blue-400 to-emerald-400 mb-2" />
          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed font-light">
            {definition.definition}
          </p>
          {definition.link && (
            <a
              href={definition.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-1.5 inline-block text-[10px] text-blue-500 dark:text-blue-400 font-medium hover:underline"
            >
              Learn more &rarr;
            </a>
          )}
        </div>
      )}
    </div>
  );
}
