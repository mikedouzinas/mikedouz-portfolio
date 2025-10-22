"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  ArrowRight, 
  CornerDownLeft,
  Briefcase,
  User2,
  Loader2,
  X,
  Compass,
  Cpu,
  Mail,
  ExternalLink
} from 'lucide-react';
import { getSignalSummary } from '@/lib/iris/signals';
import { useRouter } from 'next/navigation';

/**
 * Static suggestion configuration
 * Each suggestion has an icon, primary text, and optional secondary text
 */
const SUGGESTIONS = [
    {
      id: 'discover',
      icon: Compass,
      primary: 'Discover what Mike’s built',
      secondary: 'Ask Iris to walk you through specific projects',
    },
    {
      id: 'career',
      icon: Briefcase,
      primary: 'Learn about Mike’s work experience',
      secondary: 'Internships, roles, and industry impact',
    },
    {
      id: 'tech',
      icon: Cpu,
      primary: 'List Mike’s skills',
      secondary: 'Languages, frameworks, and favorite tools',
    },
    {
      id: 'story',
      icon: User2,
      primary: 'Hear Mike’s story',
      secondary: 'Background, values, and what drives his work',
    },
    {
      id: 'connect',
      icon: Mail,
      primary: 'Get in touch with Mike',
      secondary: 'Email, LinkedIn, or collaboration requests',
    },
  ] as const;

// Interface for API suggestions
interface ApiSuggestion {
  title: string;
  subtitle?: string;
  icon?: string;
  action: {
    type: string;
    payload: string;
  };
}

interface IrisPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Truncate text with ellipsis if it exceeds max length
 */
function truncateText(text: string, maxLength: number = 60): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

/**
 * Detect and render clickable links in text
 */
function renderTextWithLinks(text: string, router: ReturnType<typeof useRouter>) {
  // Patterns to detect
  // Note: URL pattern matches valid URL characters and trims trailing punctuation
  const patterns = {
    email: /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi,
    url: /(https?:\/\/[^\s]+?)(?=[.,;!?)]*(?:\s|$))/gi,
    // internalRoute: /\/(projects|playground|games\/rack-rush|about|blogs|work_experience)(?:\/[^\s]*)?/gi
  };
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const allMatches: Array<{index: number; length: number; type: string; value: string}> = [];
  
  // Find all matches
  ['email', 'url'].forEach(type => {
    const pattern = patterns[type as keyof typeof patterns];
    let match;
    while ((match = pattern.exec(text)) !== null) {
      allMatches.push({
        index: match.index,
        length: match[0].length,
        type,
        value: match[0]
      });
    }
  });
  
  // Sort by index
  allMatches.sort((a, b) => a.index - b.index);
  
  // Build React nodes
  allMatches.forEach((match, i) => {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    
    // Add clickable link
    if (match.type === 'email') {
      parts.push(
        <a
          key={`link-${i}`}
          href={`mailto:${match.value}`}
          className="text-sky-400 hover:text-sky-300 underline inline-flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {match.value}
          <ExternalLink className="w-3 h-3" />
        </a>
      );
    } else if (match.type === 'url') {
      parts.push(
        <a
          key={`link-${i}`}
          href={match.value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-400 hover:text-sky-300 underline inline-flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {match.value}
          <ExternalLink className="w-3 h-3" />
        </a>
      );
    } else if (match.type === 'internalRoute') {
      parts.push(
        <button
          key={`link-${i}`}
          onClick={(e) => {
            e.stopPropagation();
            router.push(match.value);
          }}
          className="text-sky-400 hover:text-sky-300 underline font-medium"
        >
          {match.value}
        </button>
      );
    }
    
    lastIndex = match.index + match.length;
  });
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  
  return parts.length > 0 ? parts : text;
}

/**
 * IrisPalette - Arc-inspired command palette component
 * 
 * Features:
 * - Opens with ⌘K (Mac) or Ctrl+K (Win/Linux)
 * - Listens for 'mv-open-cmdk' custom event
 * - No background overlay/dimming
 * - Search input with embedded "Ask Iris →" pill
 * - Two distinct views: Suggestions View and Answer View
 * - Keyboard navigation (Up/Down/Tab/Enter/Esc)
 * - Different visual states for hover vs keyboard-selected
 * - Mobile detection (disabled on mobile devices)
 * - Full accessibility support
 * - Real streaming responses from OpenAI
 * - Clickable links in responses
 * - Navigation commands
 * - Coordinated animations using framer-motion
 * - Animation lock prevents rapid open/close operations
 * 
 * View State Machine:
 * - Suggestions View: Shows search suggestions, no answer
 * - Answer View: Shows answer only, no suggestions
 * - Editing in Answer View switches back to Suggestions View
 * 
 * Animation Coordination:
 * - Entry: Simple fade in (350ms) when opening
 * - Exit: Simple fade out (350ms) synchronized with IrisButton's reverse animation
 * - Button animation (500ms total) overlaps with palette fade for smooth transition
 * - Uses framer-motion's AnimatePresence to manage mount/unmount timing
 * - Horizontal centering uses framer-motion's x transform (-50%)
 * - Animation lock (isAnimating state) prevents operations during transitions
 * - Safety timeout (450ms) ensures unlock even if onAnimationComplete fails (spam-proof)
 */
export default function IrisPalette({ open: controlledOpen, onOpenChange }: IrisPaletteProps) {
  const router = useRouter();
  // View mode state machine: 'suggestions' = show suggestions, 'answer' = show answer only
  const [viewMode, setViewMode] = useState<'suggestions' | 'answer'>('suggestions');
  
  // State management
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [apiSuggestions, setApiSuggestions] = useState<ApiSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [isProcessingQuery, setIsProcessingQuery] = useState(false);
  const [submittedQuery, setSubmittedQuery] = useState<string>(''); // Track the query that generated the current answer
  const [isAnimating, setIsAnimating] = useState(false); // Prevent rapid open/close during animations
  
  // Refs for focus management
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /**
   * Detect mobile devices for mobile-optimized UI
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
   * 
   * Design pattern: Dispatch close event IMMEDIATELY before state changes
   * This allows dependent components (like IrisButton) to start their animations
   * synchronously, ensuring smooth visual transitions without lag
   * 
   * Animation timing:
   * 1. Event dispatches → IrisButton reverse animation starts (500ms total)
   * 2. State updates → Palette fade-out starts via framer-motion (350ms)
   * 3. Palette unmounts after fade completes, while button is still animating
   * Result: Coordinated exit where palette disappears smoothly as button animates
   * 
   * Animation lock: Prevents rapid open/close operations during animation
   */
  const handleOpenChange = useCallback((open: boolean) => {
    
    // Prevent opening/closing while animation is in progress
    if (isAnimating) {
      return;
    }
    
    
    // CRITICAL: Dispatch close event synchronously BEFORE any state changes
    // This ensures IrisButton can start its reverse animation immediately
    // AnimatePresence will handle the palette's exit animation before unmounting
    if (!open) {
      window.dispatchEvent(new CustomEvent('mv-close-cmdk'));
    }
    
    setIsOpen(open);
    setIsAnimating(true); // Lock during animation
    onOpenChange?.(open);
    
    // Safety timeout: If onAnimationComplete never fires (spam/race conditions), force unlock
    // Must be longer than button's forward animation (600ms) to prevent desync
    setTimeout(() => {
      setIsAnimating(false);
    }, 650); // 600ms forward animation + 50ms safety buffer
    
    // Reset all state when closing, including view mode
    if (!open) {
      setViewMode('suggestions');
      setQuery('');
      setSelectedIndex(0);
      setApiSuggestions([]);
      setAnswer(null);
      setIsProcessingQuery(false);
      setSubmittedQuery('');
    }
  }, [isAnimating, onOpenChange, isOpen]);

  /**
   * Fetch autocomplete suggestions from API
   * Debounced to avoid excessive requests
   */
  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setApiSuggestions([]);
      return;
    }

    setIsLoadingSuggestions(true);

    try {
      // Get user signals for personalized suggestions
      const signals = getSignalSummary();

      const response = await fetch(
        `/api/iris/suggest?q=${encodeURIComponent(searchQuery)}&signals=${encodeURIComponent(JSON.stringify(signals))}`
      );

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      setApiSuggestions(data.items || []);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      setApiSuggestions([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, []);

  /**
   * Debounce API calls to avoid excessive requests
   * Only fetch suggestions when in suggestions view
   */
  useEffect(() => {
    // Only fetch suggestions when in suggestions view
    if (viewMode !== 'suggestions') {
      return;
    }
    
    const timeoutId = setTimeout(() => {
      if (query.trim()) {
        fetchSuggestions(query);
      } else {
        setApiSuggestions([]);
        setIsLoadingSuggestions(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [query, fetchSuggestions, viewMode]);

  /**
   * REMOVED: Cmd+K handling - now handled exclusively by IrisButton
   * IrisButton dispatches 'mv-open-cmdk' event which we listen to below
   * This prevents duplicate handlers and ensures button animation always runs with Cmd+K
   */

  /**
   * Listen for custom 'mv-open-cmdk' event
   * Dispatched by button clicks - always opens the palette
   */
  useEffect(() => {
    const handleCustomOpen = () => {
      handleOpenChange(true);
    };

    window.addEventListener('mv-open-cmdk', handleCustomOpen);
    return () => window.removeEventListener('mv-open-cmdk', handleCustomOpen);
  }, [handleOpenChange]);

  /**
   * Listen for custom 'mv-toggle-cmdk' event
   * Dispatched by Cmd+K - toggles the palette open/closed
   */
  useEffect(() => {
    const handleToggle = () => {
      handleOpenChange(!isOpen);
    };

    window.addEventListener('mv-toggle-cmdk', handleToggle);
    return () => window.removeEventListener('mv-toggle-cmdk', handleToggle);
  }, [handleOpenChange, isOpen]);

  /**
   * Focus input when palette opens
   */
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  /**
   * Handle input changes
   * If in answer view and user edits, switch back to suggestions view
   */
  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
    
    // Always reset selected index when query changes to prevent out-of-bounds errors
    setSelectedIndex(0);
    
    // If we're in answer view and user is editing, switch back to suggestions view
    if (viewMode === 'answer' && newQuery !== submittedQuery) {
      setViewMode('suggestions');
      setAnswer(null); // Clear the answer when switching back
    }
  };

  /**
   * Get current suggestions list - unified logic for display and interaction
   * This is the single source of truth for what suggestions are shown
   * Fixes duplicate row bug by ensuring proper deduplication
   */
  const getCurrentSuggestions = useCallback((): ApiSuggestion[] => {
    const suggestions: ApiSuggestion[] = [];
    
    if (query.trim()) {
      // Always include exact query as first item when typing
      suggestions.push({
        title: query,
        subtitle: 'Ask Iris about this',
        action: { type: 'ask', payload: query }
      });
      
      // Add API suggestions with strict deduplication
      const seenTitles = new Set([query.toLowerCase().trim()]);
      apiSuggestions.forEach(suggestion => {
        const titleLower = suggestion.title.toLowerCase().trim();
        // Skip if already seen OR if it exactly matches the query
        if (!seenTitles.has(titleLower) && suggestions.length < 5) {
          seenTitles.add(titleLower);
          suggestions.push({
            title: suggestion.title,
            subtitle: suggestion.subtitle || '',
            icon: suggestion.icon,
            action: suggestion.action
          });
        }
      });
    } else {
      // No query: use static suggestions (deduplicated)
      const seenTitles = new Set<string>();
      SUGGESTIONS.forEach(s => {
        const titleLower = s.primary.toLowerCase().trim();
        if (!seenTitles.has(titleLower)) {
          seenTitles.add(titleLower);
          suggestions.push({
            title: s.primary,
            subtitle: s.secondary,
            action: { type: 'ask', payload: s.primary }
          });
        }
      });
    }
    
    return suggestions;
  }, [query, apiSuggestions]);
  
  // Always use the same function for consistency
  const currentSuggestions = getCurrentSuggestions();

  /**
   * Handle keyboard navigation within the palette
   * - In suggestions view: Up/Down/Tab navigate, Enter submits
   * - In answer view: Only Enter resubmits, Escape closes
   * - Escape: Always closes palette
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Always allow Escape to close
    if (e.key === 'Escape') {
      e.preventDefault();
      handleOpenChange(false);
      return;
    }
    
    // In answer view, only allow Enter to resubmit current query
    if (viewMode === 'answer') {
      if (e.key === 'Enter' && query.trim()) {
        e.preventDefault();
        handleSubmitQuery(query);
      }
      return;
    }
    
    // In suggestions view, enable full navigation
    // Disable during processing
    if (isProcessingQuery) {
      return;
    }
    
    const suggestionsCount = currentSuggestions.length;
    
    // Safety check: ensure we have suggestions to navigate
    if (suggestionsCount === 0) {
      return;
    }
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestionsCount);
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestionsCount) % suggestionsCount);
        break;
      
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) {
          // Shift+Tab: Navigate backwards
          setSelectedIndex((prev) => (prev - 1 + suggestionsCount) % suggestionsCount);
        } else {
          // Tab: Navigate forwards
          setSelectedIndex((prev) => (prev + 1) % suggestionsCount);
        }
        break;
      
      case 'Enter':
        e.preventDefault();
        // Bounds check before attempting to select
        if (selectedIndex >= 0 && selectedIndex < suggestionsCount) {
          if (selectedIndex === 0 && query.trim()) {
            // First item is always the exact query - submit it
            handleSubmitQuery(query);
          } else {
            // Select the current suggestion
            handleSelectItem(selectedIndex);
          }
        } else {
          // Fallback: if selectedIndex is out of bounds, submit the query directly
          if (query.trim()) {
            handleSubmitQuery(query);
          }
        }
        break;
    }
  };

  /**
   * Submit a search query to get an answer from the API with real streaming
   * Immediately switches to answer view with loading state and streams text from OpenAI
   */
  const handleSubmitQuery = async (q: string) => {
    // Input validation - max 500 characters
    if (!q.trim() || isProcessingQuery) return;
    if (q.length > 500) {
      setAnswer('Your question is too long. Please keep it under 500 characters.');
      setViewMode('answer');
      return;
    }
    
    
    // Immediately switch to answer view with loading state
    setIsProcessingQuery(true);
    setSubmittedQuery(q);
    setAnswer(''); // Start with empty answer for streaming
    setViewMode('answer'); // Switch immediately to answer view
    setApiSuggestions([]);
    
    try {
      const signals = getSignalSummary();
      const response = await fetch(
        `/api/iris/answer?q=${encodeURIComponent(q)}&signals=${encodeURIComponent(JSON.stringify(signals))}`
      );


      if (!response.ok) {
        // Try to get error details from response body
        let errorMessage = `API request failed with status ${response.status}`;
        try {
          const errorData = await response.json();
          console.error('[IrisPalette] API error response:', errorData);
          errorMessage = errorData.answer || errorData.error || errorMessage;
        } catch (e) {
          console.error('[IrisPalette] Could not parse error response:', e);
        }
        setAnswer(errorMessage);
        setIsProcessingQuery(false);
        return;
      }

      // Check if response is streaming (SSE) or JSON
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('text/event-stream')) {
        // Real streaming from OpenAI
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let accumulatedAnswer = '';
        
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  break;
                }
                
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.text) {
                    accumulatedAnswer += parsed.text;
                    setAnswer(accumulatedAnswer);
                  }
                } catch {
                  // Skip invalid JSON - silently ignore parse errors
                }
              }
            }
          }
        }
      } else {
        // Fallback JSON response
        const data = await response.json();
        const answerText = data.answer || 'No answer available.';
        setAnswer(answerText);
      }
    } catch (error) {
      console.error('[IrisPalette] Failed to get answer:', error);
      setAnswer('Sorry, I couldn\'t process your question. Please try again or rephrase it.');
    } finally {
      setIsProcessingQuery(false);
    }
    
    // Keep focus in input (Arc behavior)
    inputRef.current?.focus();
  };

  /**
   * Select a suggestion and either submit it or fill the input
   * Includes bounds checking to prevent crashes
   */
  const handleSelectItem = (index: number) => {
    // Use the same suggestions list as display
    const displaySuggestions = getCurrentSuggestions();
    
    // Bounds check: ensure index is valid
    if (index < 0 || index >= displaySuggestions.length) {
      console.error(`[IrisPalette] Invalid suggestion index: ${index}, max: ${displaySuggestions.length - 1}`);
      // Reset to safe index
      setSelectedIndex(0);
      return;
    }
    
    // Get the correct suggestion based on actual displayed list
    const suggestion = displaySuggestions[index];
    if (!suggestion) {
      console.error(`[IrisPalette] No suggestion found at index: ${index}`);
      setSelectedIndex(0);
      return;
    }
    
    if (suggestion.action.type === 'ask') {
      // Fill the query and submit
      const queryText = suggestion.action.payload || suggestion.title;
      setQuery(queryText);
      handleSubmitQuery(queryText);
    }
    
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
      // Bounds check before selecting item
      const suggestionsCount = currentSuggestions.length;
      if (selectedIndex >= 0 && selectedIndex < suggestionsCount) {
        handleSelectItem(selectedIndex);
      } else {
        // Fallback to first item if selectedIndex is out of bounds
        setSelectedIndex(0);
        handleSelectItem(0);
      }
    }
  };
  
  /**
   * Clear the current query and answer, return to suggestions view
   */
  const handleClear = () => {
    setQuery('');
    setAnswer(null);
    setSubmittedQuery('');
    setIsProcessingQuery(false);
    setApiSuggestions([]);
    setSelectedIndex(0); // Reset to top of suggestions
    setViewMode('suggestions'); // Switch back to suggestions view
    inputRef.current?.focus();
  };

  /**
   * Handle clicking a suggestion
   * Sets it as selected and submits
   * Includes bounds checking
   */
  const handleSuggestionClick = (index: number) => {
    // Bounds check before setting selected index
    const suggestionsCount = currentSuggestions.length;
    if (index >= 0 && index < suggestionsCount) {
      setSelectedIndex(index);
      // Use setTimeout to ensure state update completes before selection
      setTimeout(() => handleSelectItem(index), 0);
    } else {
      console.error(`[IrisPalette] Invalid click index: ${index}, max: ${suggestionsCount - 1}`);
      setSelectedIndex(0); // Reset to safe index
    }
  };

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          {/* Fixed positioned panel - mobile-optimized layout with framer-motion animations */}
          {/* Simple fade in/out (350ms) to sync with button animation */}
          {/* Centering: Uses framer-motion's x with -50% for proper horizontal alignment */}
          {/* Mobile: Positioned below header (top-16 = 64px) to keep header visible and accessible */}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-label="Iris command palette"
            aria-modal="false"
            initial={{ opacity: 0, x: "-50%" }}
            animate={{ opacity: 1, x: "-50%" }}
            exit={{ opacity: 0, x: "-50%" }}
            transition={{ 
              duration: 0.35, 
              ease: "easeInOut" // Smooth fade
            }}
            onAnimationComplete={() => {
              // Unlock animation state when animation finishes (both open and close)
              setIsAnimating(false);
            }}
            className={`
              fixed left-1/2 z-[1000]
              ${isMobile 
                ? 'top-16 w-[calc(100vw-2rem)] max-h-[calc(100vh-5rem)] overflow-y-auto' 
                : 'top-[20vh] w-[720px] max-w-[calc(100vw-2rem)]'
              }
              rounded-2xl border border-white/20 bg-gradient-to-br from-blue-600/20 via-emerald-500/25 to-blue-600/20 backdrop-blur-xl shadow-3xl ring-1 ring-white/5
              ${isInputFocused ? 'ring-1 ring-sky-400/30' : ''}
            `}
          >
        {/* Input row */}
        <div className="relative flex items-center px-3">
          {/* Left search icon */}
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60 pointer-events-none" />
          
          {/* Search input - always editable with character limit */}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            placeholder="Ask Iris anything…"
            maxLength={500}
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
          
          {/* Right button - "Clear" in answer view, "Ask Iris" in suggestions view */}
          {viewMode === 'answer' ? (
            <button
              onClick={handleClear}
              className="
                absolute right-2 inset-y-2
                inline-flex items-center justify-center
                rounded-full w-9 h-9
                text-xs font-medium
                bg-white/10 hover:bg-white/15 text-white
                transition-colors
              "
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleAskIrisClick}
              disabled={isProcessingQuery}
              className={`
                absolute right-2 inset-y-2
                inline-flex items-center justify-center
                rounded-full w-9 h-9
                bg-blue-900/80 hover:bg-blue-900 text-white
                transition-all duration-300 ease-out
                hover:scale-110
                ${isProcessingQuery ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              aria-label="Submit to Iris"
            >
              {isProcessingQuery ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              )}
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 mx-3" />

        {/* Suggestions list - only show in suggestions view */}
        {viewMode === 'suggestions' && (
          <div
            id="iris-suggestions"
            role="listbox"
            className="py-2 px-2"
          >
            {(() => {
              // Use the same suggestions list as everywhere else
              const displaySuggestions = getCurrentSuggestions();
              
              // Add loading state if needed
              const suggestionsWithLoading: Array<ApiSuggestion & { isLoading?: boolean }> = [];
              
              if (query.trim() && isLoadingSuggestions && displaySuggestions.length === 1) {
                // Show the exact query
                suggestionsWithLoading.push(displaySuggestions[0]);
                
                // Add loading placeholders
                for (let i = 0; i < 4; i++) {
                  suggestionsWithLoading.push({
                    title: '',
                    action: { type: 'ask', payload: '' },
                    isLoading: true
                  });
                }
              } else {
                // Use actual suggestions
                displaySuggestions.forEach(s => suggestionsWithLoading.push(s));
              }

            return suggestionsWithLoading.map((suggestion, index) => {
              const isSelected = selectedIndex === index;
              const isLoading = suggestion.isLoading;
              
              return (
                <div
                  key={`suggestion-${index}`}
                  id={`suggestion-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  className={`
                    relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-default
                    transition-colors
                    ${isSelected 
                      ? 'bg-white/10' 
                      : 'hover:bg-green-500/10'
                    }
                    focus:outline-none focus:ring-0 focus:border-0 focus:shadow-none
                    active:outline-none active:ring-0 active:border-0 active:shadow-none
                  `}
                  onClick={() => !isLoading && handleSuggestionClick(index)}
                  onMouseEnter={() => {
                    // Visual hover only - doesn't change selectedIndex unless clicked
                  }}
                >
                  {/* Left icon chip */}
                  <div className="shrink-0 rounded-md bg-white/5 p-1.5 text-white/80">
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Search className="w-5 h-5" />
                    )}
                  </div>

                  {/* Middle text */}
                  <div className="flex-1 min-w-0">
                    {isLoading ? (
                      <>
                        <div className="h-4 w-3/4 bg-white/10 rounded animate-pulse mb-1" />
                        <div className="h-3 w-1/2 bg-white/5 rounded animate-pulse" />
                      </>
                    ) : (
                      <>
                        <div className="text-[15px] text-white">
                          {truncateText(suggestion.title, 60)}
                        </div>
                        {suggestion.subtitle && (
                          <div className="text-[13px] text-white/60">
                            {truncateText(suggestion.subtitle, 80)}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Right enter glyph */}
                  {!isLoading && (
                    <CornerDownLeft className="w-4 h-4 text-white/40 shrink-0" />
                  )}
                </div>
              );
              });
            })()}
          </div>
        )}

        {/* Answer display - only show in answer view */}
        {viewMode === 'answer' && (
          <div className="p-4 max-h-64 overflow-y-auto">
            {answer ? (
              <div className="text-[14px] text-white/90 leading-relaxed whitespace-pre-wrap">
                {renderTextWithLinks(answer, router)}
                {/* Show typing cursor while streaming */}
                {isProcessingQuery && (
                  <span className="inline-block w-2 h-4 bg-sky-400 animate-pulse ml-1" />
                )}
              </div>
            ) : (
              /* Show loading state when no answer yet */
              <div className="flex items-center gap-2 text-white/60">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-[14px]">Thinking...</span>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Invisible backdrop for click-outside detection (doesn't dim) */}
      {/* Also animated to fade in/out with the palette */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[999]"
        onClick={() => handleOpenChange(false)}
        aria-hidden="true"
      />
    </>
      )}
    </AnimatePresence>
  );
}

