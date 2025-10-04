"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Search, 
  ArrowRight, 
  CornerDownLeft,
  Briefcase,
  User2,
  FileText,
  Sparkles
} from 'lucide-react';

/**
 * Static suggestion configuration
 * Each suggestion has an icon, primary text, and optional secondary text
 */
const SUGGESTIONS = [
  {
    id: 'search',
    icon: Search,
    primary: 'Search Mike\'s site',
    secondary: 'Find projects, experience, and more',
  },
  {
    id: 'projects',
    icon: Briefcase,
    primary: 'Projects overview',
    secondary: 'View all technical projects',
  },
  {
    id: 'about',
    icon: User2,
    primary: 'About Mike',
    secondary: 'Background and interests',
  },
  {
    id: 'experience',
    icon: FileText,
    primary: 'Experience summary',
    secondary: 'Professional work history',
  },
  {
    id: 'whats-new',
    icon: Sparkles,
    primary: 'What\'s new?',
    secondary: 'Latest updates and features',
  },
] as const;

interface IrisPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * IrisPalette - Arc-inspired command palette component
 * 
 * Features:
 * - Opens with ⌘K (Mac) or Ctrl+K (Win/Linux)
 * - Listens for 'mv-open-cmdk' custom event
 * - No background overlay/dimming
 * - Search input with embedded "Ask Iris →" pill
 * - Exactly 5 static suggestions
 * - Keyboard navigation (Up/Down/Tab/Enter/Esc)
 * - Different visual states for hover vs keyboard-selected
 * - Mobile detection (disabled on mobile devices)
 * - Full accessibility support
 */
export default function IrisPalette({ open: controlledOpen, onOpenChange }: IrisPaletteProps) {
  // State management
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  
  // Refs for focus management
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /**
   * Detect mobile devices to disable palette
   * Mobile detection based on User-Agent containing Mobi|Android
   */
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent;
      setIsMobile(/Mobi|Android/i.test(userAgent));
    };
    
    checkMobile();
  }, []);

  /**
   * Sync with controlled open prop if provided
   */
  useEffect(() => {
    if (controlledOpen !== undefined) {
      setIsOpen(controlledOpen);
    }
  }, [controlledOpen]);

  /**
   * Handle open state changes
   * Calls onOpenChange callback if provided
   * Wrapped in useCallback to prevent dependency issues in effects
   */
  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    onOpenChange?.(open);
    
    // Reset state when closing
    if (!open) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [onOpenChange]);

  /**
   * Global keyboard shortcut listener
   * Opens palette with ⌘K (Mac) or Ctrl+K (Win/Linux)
   * Ignores on mobile devices
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore on mobile
      if (isMobile) return;
      
      // ⌘K or Ctrl+K to toggle
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleOpenChange(!isOpen);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMobile, isOpen, handleOpenChange]);

  /**
   * Listen for custom 'mv-open-cmdk' event
   * Allows external components (like hero button) to open the palette
   */
  useEffect(() => {
    const handleCustomOpen = () => {
      if (!isMobile) {
        handleOpenChange(true);
      }
    };

    window.addEventListener('mv-open-cmdk', handleCustomOpen);
    return () => window.removeEventListener('mv-open-cmdk', handleCustomOpen);
  }, [isMobile, handleOpenChange]);

  /**
   * Focus input when palette opens
   */
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  /**
   * Handle keyboard navigation within the palette
   * - Up/Down: Navigate suggestions
   * - Tab/Shift+Tab: Navigate suggestions (with wrapping)
   * - Enter: Submit query or select suggestion
   * - Escape: Close palette
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % SUGGESTIONS.length);
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + SUGGESTIONS.length) % SUGGESTIONS.length);
        break;
      
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) {
          // Shift+Tab: Navigate backwards
          setSelectedIndex((prev) => (prev - 1 + SUGGESTIONS.length) % SUGGESTIONS.length);
        } else {
          // Tab: Navigate forwards
          setSelectedIndex((prev) => (prev + 1) % SUGGESTIONS.length);
        }
        break;
      
      case 'Enter':
        e.preventDefault();
        if (query.trim()) {
          // Submit query if input has text
          handleSubmitQuery(query);
        } else {
          // Select current suggestion if input is empty
          handleSelectItem(selectedIndex);
        }
        break;
      
      case 'Escape':
        e.preventDefault();
        handleOpenChange(false);
        break;
    }
  };

  /**
   * Submit a search query
   * Placeholder implementation - logs to console
   */
  const handleSubmitQuery = (q: string) => {
    console.log('Submit query:', q);
    // TODO: Implement LLM query submission
    // Keep focus in input (Arc behavior)
    inputRef.current?.focus();
  };

  /**
   * Select a suggestion
   * Placeholder implementation - logs to console
   */
  const handleSelectItem = (index: number) => {
    const suggestion = SUGGESTIONS[index];
    console.log('Select suggestion:', suggestion);
    // TODO: Implement suggestion navigation/action
    // Keep focus in input (Arc behavior)
    inputRef.current?.focus();
  };

  /**
   * Handle clicking the "Ask Iris →" pill
   * Same as pressing Enter with current query
   */
  const handleAskIrisClick = () => {
    if (query.trim()) {
      handleSubmitQuery(query);
    } else {
      handleSelectItem(selectedIndex);
    }
  };

  /**
   * Handle clicking a suggestion
   * Sets it as selected and submits
   */
  const handleSuggestionClick = (index: number) => {
    setSelectedIndex(index);
    handleSelectItem(index);
  };

  // Don't render on mobile
  if (isMobile) return null;
  
  // Don't render if not open
  if (!isOpen) return null;

  return (
    <>
      {/* Fixed positioned panel (no overlay/backdrop) - vertically centered */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Iris command palette"
        aria-modal="false"
        className={`
          fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000]
          w-[720px] max-w-[calc(100vw-2rem)]
          rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-xl shadow-2xl
          ${isInputFocused ? 'ring-1 ring-sky-400/30' : ''}
        `}
      >
        {/* Input row */}
        <div className="relative flex items-center px-3">
          {/* Left search icon */}
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60 pointer-events-none" />
          
          {/* Search input */}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            placeholder="Ask Iris anything…"
            className="
              h-14 w-full bg-transparent 
              pl-10 pr-28 
              text-[15px] text-white placeholder-white/50 
              outline-none border-0
            "
            aria-autocomplete="list"
            aria-controls="iris-suggestions"
            aria-activedescendant={`suggestion-${selectedIndex}`}
          />
          
          {/* Right-embedded "Ask Iris →" pill */}
          <button
            onClick={handleAskIrisClick}
            className="
              absolute right-2 inset-y-2
              inline-flex items-center gap-1
              rounded-full px-3 py-1
              text-xs font-medium
              bg-white/10 hover:bg-white/15 text-white
              transition-colors
              max-w-[40%]
            "
            aria-label="Submit to Iris"
          >
            <span className="truncate">Ask Iris</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 mx-3" />

        {/* Suggestions list (exactly 5 items) */}
        <div
          id="iris-suggestions"
          role="listbox"
          className="py-2 px-2"
        >
          {SUGGESTIONS.map((suggestion, index) => {
            const Icon = suggestion.icon;
            const isSelected = selectedIndex === index;
            
            return (
              <div
                key={suggestion.id}
                id={`suggestion-${index}`}
                role="option"
                aria-selected={isSelected}
                className={`
                  relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-default
                  transition-colors
                  ${isSelected 
                    ? 'bg-white/10 ring-1 ring-sky-400/30 border border-white/15' 
                    : 'hover:bg-white/5'
                  }
                `}
                onClick={() => handleSuggestionClick(index)}
                onMouseEnter={() => {
                  // Visual hover only - doesn't change selectedIndex unless clicked
                  // The hover:bg-white/5 handles the visual feedback
                }}
              >
                {/* Left icon chip */}
                <div className="shrink-0 rounded-md bg-white/5 p-1.5 text-white/80">
                  <Icon className="w-5 h-5" />
                </div>

                {/* Middle text */}
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] text-white">
                    {suggestion.primary}
                  </div>
                  {suggestion.secondary && (
                    <div className="text-[13px] text-white/60">
                      {suggestion.secondary}
                    </div>
                  )}
                </div>

                {/* Right enter glyph */}
                <CornerDownLeft className="w-4 h-4 text-white/40 shrink-0" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Invisible backdrop for click-outside detection (doesn't dim) */}
      <div
        className="fixed inset-0 z-[999]"
        onClick={() => handleOpenChange(false)}
        aria-hidden="true"
      />
    </>
  );
}

