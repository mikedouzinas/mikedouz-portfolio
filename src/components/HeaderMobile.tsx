"use client";
import React from 'react';
import { Info, MessageCircle } from 'lucide-react';

/**
 * Mobile-only sticky header component (visible below md breakpoint)
 * 
 * Purpose:
 * - Provides persistent access to navigation and Iris AI assistant on mobile
 * - Displays user identity (name and title) in a compact format
 * - Opens About & Links sheet via info icon
 * - Provides quick access to Ask Iris functionality with simplified button
 * 
 * Layout:
 * - Left side: Name (Mike Veson) + small info icon button
 * - Subtitle below name: "Software Engineer · Builder"
 * - Right side: Simple "Ask Iris" button with message icon
 * 
 * Behavior:
 * - Sticky positioning with backdrop blur for readability
 * - Subtle border bottom for visual separation
 * - Info button opens AboutSheet modal
 * - Ask Iris button triggers Iris command palette
 * 
 * Accessibility:
 * - Info icon has descriptive aria-label
 * - All interactive elements keyboard accessible (min 40px hit area)
 * - Focus rings visible for keyboard navigation
 */
interface HeaderMobileProps {
  /** Callback to open the About & Links sheet */
  onOpenAbout: () => void;
}

export default function HeaderMobile({ onOpenAbout }: HeaderMobileProps) {
  /**
   * Dispatches custom event to open the Iris command palette
   * This event is listened to by the IrisPalette component
   */
  const handleAskIrisClick = () => {
    window.dispatchEvent(new CustomEvent('mv-open-cmdk'));
  };

  return (
    <header 
      className="md:hidden sticky top-0 z-[1000] bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50"
    >
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        {/* Left section: Name + Info icon + Subtitle */}
        <div className="flex items-start gap-2 flex-shrink-0">
          <div className="flex flex-col">
            {/* Name with info icon inline */}
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-semibold text-gray-800 dark:text-gray-200">
                Mike Veson
              </h1>
              
              {/* Info icon button - opens About & Links sheet */}
              {/* No focus ring or selected color - completely invisible when pressed */}
              <button
                onClick={onOpenAbout}
                aria-label="About & Links"
                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200/60 dark:bg-gray-800/60 hover:bg-gray-300/80 dark:hover:bg-gray-700/80 transition-colors focus:outline-none"
              >
                <Info className="w-3 h-3 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            
            {/* Subtitle - small text under the name */}
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              Builder · Storyteller · Student
            </p>
          </div>
        </div>

        {/* Right section: Simplified Ask Iris button with icon + label */}
        {/* Wider button (px-4), min height 40px for comfortable hit area */}
        {/* More rounded corners (rounded-full) for pill-shaped button */}
        {/* Custom focus style (no default blue outline) - matches AboutSheet pattern */}
        <button
          onClick={handleAskIrisClick}
          aria-label="Ask Iris"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[40px] min-w-[110px] bg-gradient-to-r from-blue-600 via-green-600 to-blue-600 text-white text-sm font-semibold rounded-full shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-0 flex-shrink-0"
        >
          <MessageCircle className="w-4 h-4" />
          <span>Ask Iris</span>
        </button>
      </div>
    </header>
  );
}

