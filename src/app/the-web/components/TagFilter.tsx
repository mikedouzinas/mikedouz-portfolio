"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TagFilterProps {
  tags: string[];
  activeTag: string | null;
  onTagClick: (tag: string | null) => void;
}

export default function TagFilter({ tags, activeTag, onTagClick }: TagFilterProps) {
  if (tags.length === 0) return null;

  return (
    <motion.div
      layout
      className="flex flex-wrap gap-2"
    >
      <AnimatePresence>
        {tags.map((tag) => {
          const isActive = activeTag === tag;
          return (
            <motion.button
              key={tag}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={() => onTagClick(isActive ? null : tag)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                isActive
                  ? "bg-purple-500 text-white border-purple-500"
                  : "bg-transparent text-gray-400 border-gray-600 hover:border-purple-500/50 hover:text-purple-300"
              }`}
            >
              {tag}
            </motion.button>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}
