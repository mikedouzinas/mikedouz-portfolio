"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Expandable section component with Fade-Out Reveal design
 * 
 * Purpose:
 * - Reduces visual clutter on mobile by showing only initial items
 * - Uses subtle fade-out gradient overlay when collapsed
 * - Left-aligned minimal controls for expand/collapse
 * - Maintains existing card designs without modification
 * 
 * Behavior:
 * - Shows first N items by default (configurable via initialCount)
 * - Collapsed: Shows fade gradient at bottom with left-aligned "Show all ↓"
 * - Expanded: Shows all items with left-aligned "Collapse ↑" control below
 * - Smooth animations for expand/collapse with Framer Motion
 * - Tighter spacing on mobile (~10-15% reduction)
 * 
 * Layout:
 * - Section title with decorative gradient line
 * - Relative container for items list
 * - Absolute fade overlay at bottom when collapsed (pointer-events: none)
 * - Left-aligned control button (pointer-events: auto)
 * 
 * Accessibility:
 * - Button clearly labeled with current action
 * - Keyboard accessible toggle (focusable, operable)
 * - Smooth transitions that respect motion preferences
 * - Semantic HTML structure
 */
interface ExpandableSectionProps {
  /** Section title (e.g., "Experience", "Projects") */
  title: string;
  /** Array of React components/elements to render (your existing cards) */
  items: React.ReactNode[];
  /** Number of items to show initially (default: 2) */
  initialCount?: number;
}

export default function ExpandableSection({ 
  title, 
  items, 
  initialCount = 2 
}: ExpandableSectionProps) {
  // Track expanded/collapsed state
  const [expanded, setExpanded] = useState(false);
  
  // Only show toggle if there are more items than initialCount
  const hasMoreItems = items.length > initialCount;
  
  // Calculate which items to show based on expanded state
  const visibleItems = expanded ? items : items.slice(0, initialCount);
  
  /**
   * Toggle between expanded and collapsed states
   */
  const handleToggle = () => {
    setExpanded(!expanded);
  };

  return (
    <section className="space-y-4">
      {/* Section header - only visible on mobile (matches existing pattern) */}
      <div className="md:hidden">
        <div className="flex items-center space-x-3">
          <h2 className="text-lg font-light text-gray-400 dark:text-gray-500">
            {title}
          </h2>
          <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent dark:from-gray-600" />
        </div>
      </div>

      {/* Items container - relative positioning for absolute overlay */}
      <div className="relative">
        {/* Items list with tighter spacing (space-y-3 vs space-y-6) and lighter dividers */}
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {visibleItems.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ 
                  duration: 0.25,
                  ease: 'easeInOut',
                  delay: expanded ? index * 0.04 : 0 // Subtle stagger when expanding
                }}
                className="md:border-0 border-b border-gray-200/20 dark:border-gray-800/20 pb-3 md:pb-0"
              >
                {item}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Fade-out gradient overlay - only when collapsed and has more items */}
        {hasMoreItems && !expanded && (
          <div 
            className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none bg-gradient-to-t from-gray-50 via-gray-50/80 to-transparent dark:from-gray-900 dark:via-gray-900/80 dark:to-transparent"
            aria-hidden="true"
          >
            {/* Left-aligned "Show all" button inside overlay */}
            <div className="absolute bottom-2 left-0 pointer-events-auto">
              <button
                onClick={handleToggle}
                className="inline-flex items-center gap-1.5 px-0 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 dark:focus-visible:ring-blue-500/50 focus-visible:ring-offset-0 rounded"
                aria-expanded={false}
                aria-label={`Show all ${title}`}
              >
                <span className="font-medium">Show all</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Collapse control - only shown when expanded, left-aligned below items */}
      {hasMoreItems && expanded && (
        <div className="md:hidden pt-1">
          <button
            onClick={handleToggle}
            className="inline-flex items-center gap-1.5 px-0 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 dark:focus-visible:ring-blue-500/50 focus-visible:ring-offset-0 rounded"
            aria-expanded={true}
            aria-label={`Collapse ${title}`}
          >
            <span className="font-medium">Collapse</span>
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </section>
  );
}

