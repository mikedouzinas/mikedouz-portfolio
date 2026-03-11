"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import type { MemoryBubbleData } from "@/data/hover-cards";

interface MemoryBubbleProps {
  data: MemoryBubbleData;
  href?: string;
  isTouchDevice: boolean;
}

export default function MemoryBubble({
  data,
  href,
  isTouchDevice,
}: MemoryBubbleProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imgError, setImgError] = useState(false);
  const isFilmStrip = data.photos.length > 1;

  useEffect(() => {
    if (!isFilmStrip) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % data.photos.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [isFilmStrip, data.photos.length]);

  return (
    <div className="w-[240px] rounded-xl overflow-hidden bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-xl border border-gray-200/50 dark:border-gray-700/50">
      <div className="relative w-full h-[160px] overflow-hidden bg-gray-100 dark:bg-gray-800">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0"
          >
            {imgError ? (
              <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                <span className="text-xs text-gray-400 font-light">
                  {data.caption || "Memory"}
                </span>
              </div>
            ) : (
              <Image
                src={data.photos[currentIndex]}
                alt={data.caption || "Memory"}
                fill
                className="object-cover"
                sizes="240px"
                onError={() => setImgError(true)}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {isFilmStrip && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {data.photos.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                  i === currentIndex ? "bg-white" : "bg-white/40"
                }`}
              />
            ))}
          </div>
        )}
      </div>

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
    </div>
  );
}
