"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { FaLinkedin, FaGithub, FaEnvelope } from 'react-icons/fa';
import { SiCalendly } from 'react-icons/si';
import { getSignalSummary } from '@/lib/iris/signals';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { useUiDirectives, defaultOpenFor, stripUiDirectives, detectContactDirective } from './iris/useUiDirectives';
import MessageComposer from './iris/MessageComposer';
import QuickActions, { type QuickAction } from './iris/QuickActions';
import type { QueryFilter } from '@/app/api/iris/answer/route';

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

// Note: renderTextWithLinks function removed - using ReactMarkdown for proper markdown rendering

const CONTACT_LABEL_REGEX = /(LinkedIn|GitHub|Schedule a chat|Cal|Calendar):\s*(https?:\/\/[^\s]+)/gi;
const RAW_URL_REGEX = /(?<!\]\()(?<!href=")(https?:\/\/[^\s)<>]+)/gi;
const EMAIL_REGEX_INLINE = /(?<!mailto:)([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;

/**
 * Remove trailing punctuation from URLs
 * Handles periods, commas, semicolons, etc. at end of sentences
 */
function cleanUrl(url: string): string {
  return url.replace(/[.,;!?]+$/, '');
}

function autoLinkText(input: string): string {
  if (!input) return '';
  return input
    .replace(CONTACT_LABEL_REGEX, (_match, label, url) => `[${label}](${cleanUrl(url)})`)
    .replace(EMAIL_REGEX_INLINE, (match) => `[${match}](mailto:${match})`)
    .replace(RAW_URL_REGEX, (match) => `[${cleanUrl(match)}](${cleanUrl(match)})`);
}

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
  const [debugInfo, setDebugInfo] = useState<{
    intent: string;
    filters?: Record<string, unknown>;
    preRouted?: string;
    resultsCount: number;
    contextItems?: Array<{
      type: string;
      title: string;
      score?: number;
    }>;
    planner?: {
      routedIntent: string;
      risk: {
        entityLinkScore?: number;
        coverageRatio?: number;
      };
      entities?: Record<string, unknown>;
    };
    fields?: string[];
    isEvaluative?: boolean;
    detailLevel?: string;
  } | null>(null); // Debug information from API
  const [isProcessingQuery, setIsProcessingQuery] = useState(false);
  const [submittedQuery, setSubmittedQuery] = useState<string>(''); // Track the query that generated the current answer
  const [isAnimating, setIsAnimating] = useState(false); // Prevent rapid open/close during animations
  const [showComposer, setShowComposer] = useState(false); // Toggle for MessageComposer
  const [showScrollToBottom, setShowScrollToBottom] = useState(false); // Show scroll indicator

  // Conversation state for follow-ups
  const [conversationHistory, setConversationHistory] = useState<Array<{
    query: string;
    answer: string;
    intent: string;
    filters?: QueryFilter;
    depth: number; // Track how many follow-ups deep we are
    timestamp: number;
    quickActions: QuickAction[]; // Track actions for each exchange
  }>>([]);
  const [currentQueryId, setCurrentQueryId] = useState<string | null>(null);

  // Track UI directives from streaming
  const uiDirective = useUiDirectives(answer || '');
  const [persistedDirective, setPersistedDirective] = useState<typeof uiDirective>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const copiedTimer = useRef<NodeJS.Timeout | null>(null);

  // Track last seen directive to prevent auto-opening composer multiple times
  const lastDirectiveRef = useRef<string | null>(null);

  /**
   * Persist directive even after answer moves to conversation history
   * This allows the composer to open after streaming completes
   */
  useEffect(() => {
    if (uiDirective) {
      setPersistedDirective(uiDirective);
    }
  }, [uiDirective]);

  /**
   * Simplify answer text when there's a contact directive
   * For insufficient_context / more_detail, replace with simple message
   * For user_request, strip directive but keep original text
   */
  const simplifyContactAnswer = (text: string): string => {
    if (!text) return '';

    // Check if there's a contact directive
    const hasContact = /<ui:contact\b/.test(text);
    if (!hasContact) {
      return text;
    }

    // Check if it's a user_request (explicit message request)
    const isUserRequest = /reason="user_request"/.test(text);

    if (isUserRequest) {
      // For user requests, just strip the directive but keep the text
      return stripUiDirectives(text);
    }

    // For insufficient_context / more_detail, replace with simple message
    return "Here are the best ways to reach Mike:";
  };

  const cleanedAnswer = answer ? simplifyContactAnswer(answer) : '';
  const renderedAnswer = useMemo(() => autoLinkText(cleanedAnswer), [cleanedAnswer]);

  /**
   * Handle copying email to clipboard
   * Shows copied confirmation for 2 seconds
   */
  const handleEmailCopy = useCallback(async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(email);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopiedEmail(null), 2000);
    } catch (error) {
      console.error('Failed to copy email:', error);
    }
  }, []);

  /**
   * Helper function to render markdown content
   * Reused for both conversation history and current answer
   */
  const renderMarkdownContent = useCallback((content: string, isStreaming = false) => (
    <div className="text-[14px] text-white/90 leading-relaxed iris-markdown">
      <ReactMarkdown
        components={{
          // Custom link renderer to handle internal/external links
          a: ({ href, children, ...props }) => {
            const isExternal = href?.startsWith('http');
            const isEmail = href?.startsWith('mailto:');

            // Handle email links with envelope icon
            if (isEmail && href) {
              const email = href.replace(/^mailto:/, '');
              const copied = copiedEmail === email;
              return (
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    handleEmailCopy(email);
                  }}
                  className="text-sky-400 hover:text-sky-300 underline underline-offset-2 transition-colors inline-flex items-center gap-1 focus:outline-none"
                  aria-live="polite"
                >
                  <FaEnvelope className="w-3.5 h-3.5 inline mr-1.5" />
                  <span>{copied ? 'Copied!' : children}</span>
                </button>
              );
            }

            if (isExternal && href) {
              const isLinkedIn = /linkedin\.com/i.test(href);
              const isGitHub = /github\.com/i.test(href);
              const isCalendar = /calendly|fantastical|schedule/i.test(href);

              let iconElement;
              if (isLinkedIn) {
                iconElement = <FaLinkedin className="w-3.5 h-3.5 inline mr-1.5" />;
              } else if (isGitHub) {
                iconElement = <FaGithub className="w-3.5 h-3.5 inline mr-1.5" />;
              } else if (isCalendar) {
                iconElement = <SiCalendly className="w-3.5 h-3.5 inline mr-1.5" />;
              } else {
                iconElement = <ExternalLink className="w-3 h-3 inline ml-1" />;
              }

              const iconBefore = isLinkedIn || isGitHub || isCalendar;

              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:text-sky-300 underline underline-offset-2 transition-colors inline-flex items-center gap-1"
                  {...props}
                >
                  {iconBefore ? (
                    <>
                      {iconElement}
                      {children}
                    </>
                  ) : (
                    <>
                      {children}
                      {iconElement}
                    </>
                  )}
                </a>
              );
            }

            // Internal links - use router
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (href) router.push(href);
                }}
                className="text-sky-400 hover:text-sky-300 underline underline-offset-2 transition-colors cursor-pointer"
              >
                {children}
              </button>
            );
          },
          // Style other markdown elements
          h3: ({ ...props }) => <h3 className="text-base font-semibold mb-2 mt-4 first:mt-0" {...props} />,
          p: ({ ...props }) => <p className="mb-3 last:mb-0" {...props} />,
          ul: ({ ...props }) => <ul className="list-disc ml-4 mb-3 space-y-1" {...props} />,
          ol: ({ ...props }) => <ol className="list-decimal ml-4 mb-3 space-y-1" {...props} />,
          li: ({ ...props }) => <li className="leading-relaxed" {...props} />,
          strong: ({ ...props }) => <strong className="font-semibold" {...props} />,
          em: ({ ...props }) => <em className="italic" {...props} />,
          hr: ({ ...props }) => <hr className="my-4 border-white/20" {...props} />,
          code: (props) => {
            const { children, className } = props;
            const isInline = className?.includes('language-') ? false : true;

            return isInline ? (
              <code className="px-1 py-0.5 bg-white/10 rounded text-xs">{children}</code>
            ) : (
              <code className="block p-3 bg-white/10 rounded mb-3 text-xs overflow-x-auto">{children}</code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
      {/* Show typing cursor while streaming */}
      {isStreaming && (
        <span className="inline-block w-2 h-4 bg-sky-400 animate-pulse ml-1" />
      )}
    </div>
  ), [copiedEmail, handleEmailCopy, router]);

  useEffect(() => {
    return () => {
      if (copiedTimer.current) {
        clearTimeout(copiedTimer.current);
        copiedTimer.current = null;
      }
    };
  }, []);

  /**
   * Auto-open composer when directive is detected and streaming completes
   * Based on reason and open behavior
   * Uses ref to prevent re-opening the same directive multiple times
   * Only opens after streaming completes (!isProcessingQuery)
   */
  useEffect(() => {
    if (!persistedDirective) {
      // Don't close composer here - let manual closing handle it
      return;
    }

    // Wait for streaming to complete before opening composer
    if (isProcessingQuery) {
      return;
    }

    // Create unique ID from directive to detect if it's new
    const directiveId = `${persistedDirective.reason}-${persistedDirective.draft?.substring(0, 30)}`;

    // Only auto-open if it's a new directive we haven't seen before
    const shouldAutoOpen = (persistedDirective.open ?? defaultOpenFor(persistedDirective.reason)) === 'auto';
    if (shouldAutoOpen && directiveId !== lastDirectiveRef.current) {
      setShowComposer(true);
      lastDirectiveRef.current = directiveId;
    }
  }, [persistedDirective, isProcessingQuery]);

  // Refs for focus management
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);

  /**
   * Check if content overflows and user is not at bottom
   */
  const checkScrollState = useCallback(() => {
    if (!answerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = answerRef.current;
    const hasOverflow = scrollHeight > clientHeight;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10; // 10px threshold
    
    setShowScrollToBottom(hasOverflow && !isAtBottom);
  }, []);

  /**
   * Check scroll state when answer content changes
   */
  useEffect(() => {
    if (answer && viewMode === 'answer') {
      // Use setTimeout to ensure DOM has updated
      setTimeout(checkScrollState, 100);
    }
  }, [answer, viewMode, checkScrollState]);

  /**
   * Handle scroll events to show/hide scroll-to-bottom indicator
   */
  const handleScroll = useCallback(() => {
    checkScrollState();
  }, [checkScrollState]);

  /**
   * Scroll to bottom of answer area
   */
  const scrollToBottom = useCallback(() => {
    if (answerRef.current) {
      answerRef.current.scrollTo({
        top: answerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, []);

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
      setConversationHistory([]); // Clear conversation history (includes quick actions)
      setCurrentQueryId(null); // Clear query ID
      setShowComposer(false); // Close composer
      setPersistedDirective(null); // Clear persisted directive
      lastDirectiveRef.current = null; // Reset directive tracking
    }
  }, [isAnimating, onOpenChange]);

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

      // Create AbortController for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for suggestions

      const response = await fetch(
        `/api/iris/suggest?q=${encodeURIComponent(searchQuery)}&signals=${encodeURIComponent(JSON.stringify(signals))}`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      setApiSuggestions(data.items || []);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      // Don't show error messages for suggestions - just silently fail
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
   * Supports conversation context for follow-up queries
   */
  const handleSubmitQuery = async (
    q: string,
    skipClassification?: boolean,
    preFilters?: Record<string, unknown>,
    preIntent?: string,
    continueConversation = false // New param: true for quick actions, false for fresh queries
  ) => {
    // Input validation - max 500 characters
    if (!q.trim() || isProcessingQuery) return;
    if (q.length > 500) {
      setAnswer('Your question is too long. Please keep it under 500 characters.');
      setViewMode('answer');
      return;
    }

    // Reset conversation history if this is a fresh query (not from quick action)
    if (!continueConversation) {
      setConversationHistory([]);
      setShowComposer(false); // Close composer for fresh queries
      setPersistedDirective(null); // Clear persisted directive
      lastDirectiveRef.current = null; // Reset directive tracking
    }

    // Calculate current depth from conversation history
    const currentDepth = conversationHistory.length > 0
      ? conversationHistory[conversationHistory.length - 1].depth + 1
      : 0;

    // Immediately switch to answer view with loading state
    setIsProcessingQuery(true);
    setSubmittedQuery(q);
    setAnswer(''); // Start with empty answer for streaming
    setViewMode('answer'); // Switch immediately to answer view
    setApiSuggestions([]);
    setShowScrollToBottom(false); // Reset scroll indicator
    setCurrentQueryId(null); // Clear previous query ID

    try {
      const signals = getSignalSummary();

      // Searching phase (no longer tracking loading phases)

      // Create AbortController for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      // Build query params
      const params = new URLSearchParams({
        q: q,
        signals: JSON.stringify(signals),
      });

      // Pass conversation context if available
      if (conversationHistory.length > 0) {
        const lastTurn = conversationHistory[conversationHistory.length - 1];
        params.set('previousQuery', lastTurn.query);
        params.set('previousAnswer', lastTurn.answer);
        params.set('previousIntent', lastTurn.intent);
      }

      // Pass current depth for quick actions depth limiting
      params.set('depth', currentDepth.toString());

      // Pass skip classification flag if set
      if (skipClassification && preIntent) {
        params.set('skipClassification', 'true');
        params.set('intent', preIntent);
      }

      // Pass pre-filters if provided
      if (preFilters) {
        params.set('filters', JSON.stringify(preFilters));
      }

      const response = await fetch(
        `/api/iris/answer?${params.toString()}`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      // Generating phase (no longer tracking loading phases)

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
        let finalIntent = '';
        let capturedQuickActions: QuickAction[] = [];

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
                  } else if (parsed.debug) {
                    // Capture debug information
                    setDebugInfo(parsed.debug);
                    // Capture intent for conversation history
                    if (parsed.debug.intent) {
                      finalIntent = parsed.debug.intent;
                    }
                  } else if (parsed.quickActions) {
                    // Capture quick actions from stream
                    capturedQuickActions = parsed.quickActions;
                  } else if (parsed.queryId) {
                    // Capture query ID for analytics tracking
                    setCurrentQueryId(parsed.queryId);
                  }
                } catch {
                  // Skip invalid JSON - silently ignore parse errors
                }
              }
            }
          }
        }

        // After streaming completes, add this exchange to conversation history
        if (accumulatedAnswer) {
          // IMPORTANT: Detect and persist directive from accumulatedAnswer BEFORE clearing answer
          // This ensures the directive is captured even if answer state is cleared
          // The directive detection happens here to avoid race conditions with state updates
          const detectedDirective = detectContactDirective(accumulatedAnswer);
          if (detectedDirective) {
            setPersistedDirective(detectedDirective);
          }
          
          setConversationHistory(prev => [...prev, {
            query: q,
            answer: accumulatedAnswer,
            intent: finalIntent,
            filters: preFilters as QueryFilter | undefined,
            depth: currentDepth,
            quickActions: capturedQuickActions,
            timestamp: Date.now(),
          }]);
          // Clear answer state to prevent duplicate display
          setAnswer(null);
        }
      } else {
        // Fallback JSON response
        const data = await response.json();
        const answerText = data.answer || 'No answer available.';
        // IMPORTANT: Detect and persist directive from JSON response as well
        // This ensures the directive is captured for non-streaming responses
        const detectedDirective = detectContactDirective(answerText);
        if (detectedDirective) {
          setPersistedDirective(detectedDirective);
        }
        setAnswer(answerText);
      }
    } catch (error) {
      console.error('[IrisPalette] Failed to get answer:', error);
      
      // Check if it's a timeout error
      if (error instanceof Error && error.name === 'AbortError') {
        setAnswer('⏱️ Your request timed out due to slow internet connection. Please check your WiFi and try again.');
      } else if (error instanceof Error && error.message.includes('fetch')) {
        setAnswer('🌐 Network error: Unable to connect to the server. Please check your internet connection and try again.');
      } else {
        setAnswer('Sorry, I couldn\'t process your question. Please try again or rephrase it.');
      }
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
    setDebugInfo(null); // Clear debug info
    setSubmittedQuery('');
    setIsProcessingQuery(false);
    setApiSuggestions([]);
    setSelectedIndex(0); // Reset to top of suggestions
    setViewMode('suggestions'); // Switch back to suggestions view
    setShowScrollToBottom(false); // Reset scroll indicator
    setConversationHistory([]); // Clear conversation history (includes quick actions)
    setCurrentQueryId(null); // Clear query ID
    setShowComposer(false); // Close composer
    setPersistedDirective(null); // Clear persisted directive
    lastDirectiveRef.current = null; // Reset directive tracking
    inputRef.current?.focus();
  };

  /**
   * Handle quick action click
   * Different behavior based on action type
   * Records analytics for tracking which actions are useful
   */
  const handleQuickActionClick = (action: QuickAction, customQuery?: string) => {
    // Record analytics for this click (non-blocking)
    if (currentQueryId) {
      fetch('/api/iris/analytics/quick-action-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queryId: currentQueryId,
          suggestion: action.label,
        }),
      }).catch(error => {
        console.warn('[IrisPalette] Failed to record quick action click:', error);
      });
    }

    // For message_mike action, open the composer
    // Create a synthetic directive to allow the composer to render
    // This simulates a user_request directive without a draft
    if (action.type === 'message_mike') {
      setPersistedDirective({
        type: 'contact',
        reason: 'user_request',
        // No draft - user will write their own message
        open: 'auto', // Auto-open since user explicitly clicked the action
      });
      setShowComposer(true);
      return;
    }

    // For contact_link actions, they're handled by QuickActions component
    // (opens link or copies email)
    if (action.type === 'contact_link') {
      // No additional handling needed - QuickActions handles this
      return;
    }

    // For all other actions, submit a query
    const queryToSubmit = customQuery || action.query || action.label;

    // Determine if we should skip classification
    const skipClassification = !!action.intent;

    handleSubmitQuery(
      queryToSubmit,
      skipClassification,
      action.filters,
      action.intent,
      true // Continue conversation for quick action clicks
    );
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
            initial={{ opacity: 0, x: "-50%", scale: 0.95 }}
            animate={{ opacity: 1, x: "-50%", scale: 1 }}
            exit={{ opacity: 0, x: "-50%", scale: 0.95 }}
            transition={{ 
              duration: 0.35, 
              ease: [0.16, 1, 0.3, 1], // Spring-like easing for liquid feel
              scale: {
                duration: 0.4,
                ease: [0.16, 1, 0.3, 1]
              }
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
              rounded-2xl 
              bg-gradient-to-br from-blue-600/[0.12] via-blue-500/[0.15] to-blue-600/[0.12]
              backdrop-blur-3xl backdrop-saturate-[2.2]
              border border-white/[0.18] dark:border-white/[0.12]
              shadow-[0_8px_40px_rgba(37,99,235,0.15),0_0_0_1px_rgba(255,255,255,0.08),inset_0_0_0_1px_rgba(255,255,255,0.08)]
              before:absolute before:inset-0 before:rounded-2xl
              before:bg-gradient-to-b before:from-white/[0.15] before:via-blue-400/[0.05] before:to-transparent
              before:pointer-events-none
              after:absolute after:inset-0 after:rounded-2xl
              after:bg-gradient-to-tr after:from-transparent after:via-white/[0.03] after:to-transparent
              after:pointer-events-none
              overflow-hidden
              ${isInputFocused ? 'ring-2 ring-sky-400/20 border-sky-400/30' : ''}
            `}
          >
        {/* Input row */}
        <div className="relative flex items-center pl-4 pr-[52px] min-h-[56px]">
          {/* Left search icon */}
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-black/50 dark:text-white/50 pointer-events-none" />
          
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
              pl-10 pr-16 
              text-[15px] text-black/90 dark:text-white/90 
              placeholder-black/40 dark:placeholder-white/40 
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
                absolute right-2 top-1/2 -translate-y-1/2
                inline-flex items-center justify-center
                rounded-full w-9 h-9
                text-xs font-medium
                bg-black/5 dark:bg-white/10 
                hover:bg-black/10 dark:hover:bg-white/15 
                text-black/70 dark:text-white/70
                border border-black/10 dark:border-white/10
                transition-all duration-200
                backdrop-blur-sm
                flex-shrink-0
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
                absolute right-2 top-1/2 -translate-y-1/2
                inline-flex items-center justify-center
                rounded-full w-9 h-9
                bg-gradient-to-br from-blue-600 via-emerald-500 to-blue-600
                text-white shadow-md
                border border-white/20
                transition-all duration-200 ease-out
                hover:shadow-lg hover:scale-105
                hover:from-blue-500 hover:via-emerald-400 hover:to-blue-500
                backdrop-blur-xl
                flex-shrink-0
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
        <div className="relative mx-3">
          <div className="absolute inset-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
          <div className="border-t border-black/5 dark:border-white/10"></div>
        </div>

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
                    transition-all duration-200
                    ${isSelected 
                      ? 'bg-white/10 shadow-sm' 
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
                  <div className="shrink-0 rounded-lg bg-black/5 dark:bg-white/5 p-1.5 text-black/60 dark:text-white/60">
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
                        <div className="h-4 w-3/4 bg-black/10 dark:bg-white/10 rounded animate-pulse mb-1" />
                        <div className="h-3 w-1/2 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
                      </>
                    ) : (
                      <>
                        <div className="text-[15px] text-black/90 dark:text-white/90">
                          {truncateText(suggestion.title, 60)}
                        </div>
                        {suggestion.subtitle && (
                          <div className="text-[13px] text-black/50 dark:text-white/50">
                            {truncateText(suggestion.subtitle, 80)}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Right enter glyph */}
                  {!isLoading && (
                    <CornerDownLeft className="w-4 h-4 text-black/30 dark:text-white/30 shrink-0" />
                  )}
                </div>
              );
              });
            })()}
          </div>
        )}

        {/* Answer display - only show in answer view */}
        {viewMode === 'answer' && (
          <>
            <div className="relative">
              <div
                ref={answerRef}
                onScroll={handleScroll}
                className="p-4 overflow-y-auto space-y-4 max-h-96"
              >
                {/* Render all previous exchanges from conversation history */}
                {conversationHistory.map((exchange, index) => (
                  <div key={index} className="space-y-2">
                    {/* Render the answer */}
                    {renderMarkdownContent(autoLinkText(simplifyContactAnswer(exchange.answer)), false)}

                    {/* Render quick actions for this exchange */}
                    {exchange.quickActions.length > 0 && (
                      <QuickActions
                        actions={exchange.quickActions}
                        onActionClick={handleQuickActionClick}
                        onCancel={() => {
                          // Hide MessageComposer when canceling quick action
                          setShowComposer(false);
                        }}
                        disabled={isProcessingQuery}
                      />
                    )}
                  </div>
                ))}

                {/* Render current streaming answer (if any) */}
                {answer ? (
                  <div className="space-y-2">
                    {/* Render current streaming answer */}
                    {renderMarkdownContent(renderedAnswer, isProcessingQuery)}
                  </div>
                ) : conversationHistory.length === 0 ? (
                  /* Show loading state when no answer yet and no history */
                  <div className="flex items-center gap-2 text-white/60">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-[14px]">Thinking...</span>
                  </div>
                ) : null}

                {/* Message Composer - shown inline after current answer */}
                {/* Only show if not currently processing a new query and directive exists */}
                {!isProcessingQuery && showComposer && persistedDirective && (
                  <div className="mt-4">
                    <MessageComposer
                      origin={
                        persistedDirective.reason === 'user_request' ? 'iris-explicit' :
                        persistedDirective.reason === 'insufficient_context' ? 'auto-insufficient' :
                        'iris-suggested'
                      }
                      initialDraft={persistedDirective.draft}
                      locked={isProcessingQuery}
                      userQuery={submittedQuery}
                      onCancel={() => setShowComposer(false)}
                    />
                  </div>
                )}

                {/* Debug Panel - Shows when debug info is available */}
                {debugInfo && (
                  <div className="mt-4 p-3 bg-black/20 dark:bg-white/10 rounded-lg border border-white/20">
                    <div className="text-xs text-white/60 font-mono space-y-2">
                      <div><strong>Intent:</strong> {debugInfo.intent}</div>
                      {debugInfo.filters && (
                        <div><strong>Filters:</strong> {JSON.stringify(debugInfo.filters, null, 2)}</div>
                      )}
                      {debugInfo.preRouted && (
                        <div><strong>Pre-routed:</strong> {debugInfo.preRouted}</div>
                      )}
                      <div><strong>Results:</strong> {debugInfo.resultsCount} items</div>
                      {debugInfo.contextItems && debugInfo.contextItems.length > 0 && (
                        <details className="cursor-pointer">
                          <summary><strong>Context Items:</strong></summary>
                          <div className="mt-1 space-y-1 pl-2">
                            {debugInfo.contextItems.map((item, i) => (
                              <div key={i}>
                                {item.type}: {item.title} (score: {item.score?.toFixed(3)})
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                      {debugInfo.planner && (
                        <details className="cursor-pointer">
                          <summary><strong>Planner:</strong></summary>
                          <div className="mt-1 pl-2 space-y-1">
                            <div>Routed Intent: {debugInfo.planner.routedIntent}</div>
                            <div>Entity Link Score: {debugInfo.planner.risk.entityLinkScore?.toFixed(3)}</div>
                            <div>Coverage Ratio: {debugInfo.planner.risk.coverageRatio?.toFixed(3)}</div>
                            {debugInfo.planner.entities && (
                              <div>Entities: {JSON.stringify(debugInfo.planner.entities)}</div>
                            )}
                          </div>
                        </details>
                      )}
                      <div><strong>Detail Level:</strong> {debugInfo.detailLevel}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Scroll to bottom button */}
              {showScrollToBottom && (
                <button
                  onClick={scrollToBottom}
                  className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-white/70 dark:bg-black/30 hover:bg-white/90 dark:hover:bg-black/50 backdrop-blur-xl border border-black/10 dark:border-white/20 flex items-center justify-center text-black/70 dark:text-white/70 transition-all duration-200 hover:scale-105 shadow-sm z-10"
                  title="Scroll to bottom"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              )}
            </div>
          </>
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

