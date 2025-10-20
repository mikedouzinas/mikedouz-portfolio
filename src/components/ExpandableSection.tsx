"use client";
import React, { useState, useRef } from 'react';
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
  
  // Ref to the section container for smooth scrolling
  const sectionRef = useRef<HTMLElement>(null);
  
  // Only show toggle if there are more items than initialCount
  const hasMoreItems = items.length > initialCount;
  
  // Calculate which items to show based on expanded state
  const visibleItems = expanded ? items : items.slice(0, initialCount);
  
  /**
   * Toggle between expanded and collapsed states
   * When collapsing, scroll to the section position so user sees "Show all" button
   */
  const handleToggle = () => {
    // If we're collapsing (going from expanded to collapsed)
    if (expanded && sectionRef.current) {
      // Small delay to let animation start, then scroll
      setTimeout(() => {
        sectionRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start'
        });
      }, 100);
    }
    setExpanded(!expanded);
  };

  return (
    <section ref={sectionRef} className="space-y-2">
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
        {/* Items list with minimal spacing on mobile (space-y-0.5 = 2px) and lighter dividers */}
        {/* When collapsed: extra padding on last item for fade overlay spacing */}
        {/* When expanded: remove trailing padding/border from final item */}
        {/* Note: This component is only used on mobile; desktop uses direct card rendering with md:mb-6 */}
        <div className="space-y-0.5">
          <AnimatePresence initial={false}>
            {visibleItems.map((item, index) => {
              const isLast = index === visibleItems.length - 1;
              // When collapsed: add extra padding to last item for gradient overlay
              // When expanded: remove padding/border from last item
              let itemClass = 'md:border-0 border-b border-gray-200/20 dark:border-gray-800/20 pb-1 md:pb-0';
              if (isLast) {
                if (expanded) {
                  itemClass = 'md:border-0 border-b-0 pb-0 md:pb-0';
                } else {
                  // Extra padding on last item when collapsed to prevent overlay overlap
                  itemClass = 'md:border-0 border-b border-gray-200/20 dark:border-gray-800/20 pb-6 md:pb-0';
                }
              }
              return (
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
                  className={itemClass}
                >
                  {item}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Fade-out gradient overlay - only when collapsed and has more items */}
        {/* Button wrapper has pointer-events-auto to enable clicking */}
        {hasMoreItems && !expanded && (
          <div 
            className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-gray-50 via-gray-50/80 to-transparent dark:from-gray-900 dark:via-gray-900/80 dark:to-transparent pointer-events-none"
            aria-hidden="true"
          >
            {/* Left-aligned "Show all" button - pointer-events-auto allows interaction */}
            <button
              onClick={handleToggle}
              className="absolute bottom-0 left-0 inline-flex items-center gap-1.5 px-0 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 dark:focus-visible:ring-blue-500/50 focus-visible:ring-offset-0 rounded pointer-events-auto"
              aria-expanded={false}
              aria-label={`Show all ${title}`}
            >
              <span className="font-medium">Show all</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Collapse control - small gap from last item (mt-2), not inside space-y wrapper */}
      {hasMoreItems && expanded && (
        <div className="md:hidden mt-2">
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

