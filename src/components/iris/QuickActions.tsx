"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowRight, MessageSquare, ExternalLink, Mail, Send, X } from 'lucide-react';
import { FaLinkedin, FaGithub } from 'react-icons/fa';
import { getRandomLoadingConfig, getAnimationConfig, getRandomLoadingMessage, type LoadingConfig } from '@/lib/iris/loadingMessages';

export interface QuickAction {
  type: 'affirmative' | 'custom_input' | 'specific' | 'contact_link' | 'message_mike';
  label: string;
  query?: string;           // Pre-filled query for affirmative/specific
  intent?: string;          // Skip re-classification
  filters?: Record<string, unknown>;  // Direct filter application
  link?: string;            // For contact_link type
  linkType?: 'github' | 'linkedin' | 'email' | 'external' | 'demo' | 'company';  // Icon selection
}

interface QuickActionsProps {
  actions: QuickAction[];
  onActionClick: (action: QuickAction, customQuery?: string) => void;
  onCancel?: () => void;    // Callback to cancel action and show all actions again
  disabled?: boolean;
  isProcessing?: boolean;   // Whether a query is currently being processed
  hasAnswer?: boolean;      // Whether we've started receiving answer text (streaming)
}

/**
 * QuickActions - Horizontal scrollable bubble buttons for follow-up actions
 *
 * Features:
 * - Horizontal scroll on mobile with hidden scrollbar
 * - Different action types: affirmative, specific, custom input, contact links, message Mike
 * - Custom input expands inline when clicked
 * - When clicked, only that action remains visible
 * - Gradient bubble styling matching MessageComposer
 */
export default function QuickActions({
  actions,
  onActionClick,
  onCancel,
  disabled = false,
  isProcessing = false,
  hasAnswer = false,
}: QuickActionsProps) {
  const [selectedAction, setSelectedAction] = useState<QuickAction | null>(null);
  const [customQuery, setCustomQuery] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [submittedFollowUp, setSubmittedFollowUp] = useState<string | null>(null); // Track submitted follow-up query (persists after submission)
  const [loadingConfig, setLoadingConfig] = useState<LoadingConfig | null>(null); // Current loading configuration
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null); // Track when loading started for message rotation
  const [showEmailCopiedToast, setShowEmailCopiedToast] = useState(false); // Track email copy success toast

  /**
   * Generate a new random loading configuration when processing starts
   * Track which specific queries have been processed to prevent re-initialization
   * Use refs to track state and prevent infinite loops
   */
  const loadingConfigInitializedRef = useRef(false);
  const lastProcessedFollowUpRef = useRef<string | null>(null);
  const lastSelectedActionRef = useRef<QuickAction | null>(null);
  
  // Add toast animation styles to document head
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const styleId = 'email-toast-animations';
      if (!document.getElementById(styleId)) {
        const styleSheet = document.createElement('style');
        styleSheet.id = styleId;
        styleSheet.textContent = `
          @keyframes fadeInSlideUp {
            from {
              opacity: 0;
              transform: translate(-50%, 10px);
            }
            to {
              opacity: 1;
              transform: translate(-50%, 0);
            }
          }
          
          .email-toast-enter {
            animation: fadeInSlideUp 0.3s ease-out forwards;
          }
        `;
        document.head.appendChild(styleSheet);
      }
    }
  }, []);
  
  useEffect(() => {
    // Create a unique key for comparing actions (more reliable than object reference)
    const currentActionKey = selectedAction 
      ? `${selectedAction.type}-${selectedAction.label}-${selectedAction.query || ''}` 
      : null;
    const lastActionKey = lastSelectedActionRef.current
      ? `${lastSelectedActionRef.current.type}-${lastSelectedActionRef.current.label}-${lastSelectedActionRef.current.query || ''}`
      : null;
    
    // CRITICAL: Check for NEW actions FIRST, before any clearing logic
    // This ensures new actions get their loader even if hasAnswer is still true from previous query
    const isNewAction = selectedAction && currentActionKey !== lastActionKey;
    
    if (isNewAction) {
      // Reset initialized flag when a NEW action is selected (different from last)
      loadingConfigInitializedRef.current = false;
      lastSelectedActionRef.current = selectedAction;
      
      // If this is a query-triggering action (not custom_input), clear old follow-up state
      // since we're starting a new query that supersedes the previous follow-up
      if (selectedAction.type !== 'contact_link' && 
          selectedAction.type !== 'message_mike' && 
          selectedAction.type !== 'custom_input') {
        lastProcessedFollowUpRef.current = null; // Reset so we can process new follow-ups later
      }
      
      // Initialize loader immediately for new query-triggering actions
      // This MUST happen even if hasAnswer is true (from previous query)
      if (selectedAction.type !== 'contact_link' && 
          selectedAction.type !== 'message_mike' &&
          selectedAction.type !== 'custom_input') {
        loadingConfigInitializedRef.current = true;
        setLoadingConfig(getRandomLoadingConfig());
        setLoadingStartTime(Date.now());
        return; // Early return - don't run clearing logic for new actions
      }
    } else if (!selectedAction && lastSelectedActionRef.current) {
      // Action was cleared
      lastSelectedActionRef.current = null;
    }
    
    // Initialize loading config if we have a selected action that triggers a query
    // (this ensures loader shows immediately when action is clicked, even before isProcessing is true)
    // BUT: Don't initialize for custom_input until it's actually submitted (submittedFollowUp is set)
    const shouldInitialize = selectedAction && 
      selectedAction.type !== 'contact_link' && 
      selectedAction.type !== 'message_mike' &&
      selectedAction.type !== 'custom_input' && // Don't show loader for custom_input until submitted
      !loadingConfigInitializedRef.current;
    
    if (shouldInitialize) {
      loadingConfigInitializedRef.current = true;
      setLoadingConfig(getRandomLoadingConfig());
      setLoadingStartTime(Date.now());
    } 
    // Initialize for follow-up ONLY if it's a NEW follow-up (not already processed)
    else if (submittedFollowUp && 
             submittedFollowUp !== lastProcessedFollowUpRef.current && 
             !loadingConfigInitializedRef.current) {
      loadingConfigInitializedRef.current = true;
      lastProcessedFollowUpRef.current = submittedFollowUp;
      setLoadingConfig(getRandomLoadingConfig());
      setLoadingStartTime(Date.now());
    } 
    // Fallback: Initialize when processing starts (if not already set)
    else if (isProcessing && !hasAnswer && !loadingConfigInitializedRef.current) {
      loadingConfigInitializedRef.current = true;
      setLoadingConfig(getRandomLoadingConfig());
      setLoadingStartTime(Date.now());
    } 
    // Clear loader when answer arrives, but DON'T reset initialized flag
    // (resetting the flag was causing re-initialization when submittedFollowUp persists)
    // BUT: Only clear if we don't have a new action selected (new actions handled above)
    else if (hasAnswer && loadingConfig && !isNewAction) {
      setLoadingConfig(null);
      setLoadingStartTime(null);
    }
    // Clear loader when processing stops and no active query state
    else if (!isProcessing && !selectedAction && !submittedFollowUp && loadingConfig) {
      setLoadingConfig(null);
      setLoadingStartTime(null);
    }
  }, [isProcessing, hasAnswer, selectedAction, submittedFollowUp, loadingConfig]); // Added loadingConfig back to clear it properly

  /**
   * Rotate loading message after 1.5 seconds if still loading
   * Smooth transition by only updating the message, keeping animation and color
   * Use ref to track if timer is already set to prevent infinite loops
   * 
   * CRITICAL: Do NOT include loadingConfig in dependencies to prevent infinite loop
   * The effect updates loadingConfig, so including it would cause the effect to re-run
   * every time it updates, creating a maximum update depth error
   */
  const messageRotationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messageRotatedRef = useRef(false);
  
  useEffect(() => {
    // Clear any existing timer
    if (messageRotationTimerRef.current) {
      clearTimeout(messageRotationTimerRef.current);
      messageRotationTimerRef.current = null;
    }
    messageRotatedRef.current = false;

    // Check if we should set up rotation - use functional state check to avoid dependency
    // We check loadingConfig exists without including it in dependencies
    if (!loadingConfig || !loadingStartTime || hasAnswer || !isProcessing) {
      return;
    }

    const elapsed = Date.now() - loadingStartTime;
    const timeUntilChange = 1500 - elapsed;

    if (timeUntilChange <= 0) {
      // Already past 1.5 seconds, change immediately (only once)
      if (!messageRotatedRef.current) {
        messageRotatedRef.current = true;
        setLoadingConfig(prev => {
          if (!prev) return null;
          // Keep same animation and color, only change message for smooth transition
          return {
            ...prev,
            message: getRandomLoadingMessage(),
          };
        });
      }
      return;
    }

    // Set timer to change message after 1.5 seconds total (only once)
    messageRotationTimerRef.current = setTimeout(() => {
      // Only check rotation flag - effect cleanup will handle if conditions changed
      // This avoids stale closure issues with hasAnswer/isProcessing
      if (!messageRotatedRef.current) {
        messageRotatedRef.current = true;
        setLoadingConfig(prev => {
          if (!prev) return prev; // Safety check
          // Keep same animation and color, only change message for smooth transition
          return {
            ...prev,
            message: getRandomLoadingMessage(),
          };
        });
      }
      messageRotationTimerRef.current = null;
    }, timeUntilChange);

    return () => {
      if (messageRotationTimerRef.current) {
        clearTimeout(messageRotationTimerRef.current);
        messageRotationTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingStartTime, hasAnswer, isProcessing]); // Exclude loadingConfig to prevent infinite loop

  /**
   * Determine if we should show the loading message
   * Show when we have a query-triggering action selected or submitted, and no answer yet
   * Can show even before isProcessing is true (when action is first clicked)
   * BUT: Don't show for custom_input until it's actually submitted (submittedFollowUp is set)
   * 
   * CRITICAL: If a new action is selected, show loader even if hasAnswer is true from previous query
   * This ensures the loader appears immediately when clicking a new quick action
   */
  const shouldShowLoading = useMemo(() => {
    // Priority 1: Show if we have a selected action that triggers a query (even if not processing yet)
    // This takes priority over everything else - new actions should show loader immediately
    // even if hasAnswer is still true from the previous query
    // BUT: Don't show for custom_input until it's submitted
    if (selectedAction) {
      const isQueryTriggeringAction = selectedAction.type !== 'contact_link' && 
                                      selectedAction.type !== 'message_mike' &&
                                      selectedAction.type !== 'custom_input';
      if (isQueryTriggeringAction) {
        // Show loader for new query-triggering actions, even if hasAnswer is true (from previous query)
        return true;
      }
    }
    
    // Priority 2: Show if we submitted a follow-up (this is the main case for custom_input)
    // Only check this if there's no active selectedAction
    if (submittedFollowUp !== null) {
      return true;
    }
    
    // Priority 3: Show if processing and no answer yet (fallback for other cases)
    if (isProcessing && !hasAnswer) {
      return true;
    }
    
    // Don't show if we have an answer and no active query state
    return false;
  }, [isProcessing, hasAnswer, selectedAction, submittedFollowUp]);

  const handleActionClick = (action: QuickAction) => {
    if (disabled) return;

    // For custom input, show the input field
    if (action.type === 'custom_input') {
      setShowCustomInput(true);
      setSelectedAction(action); // Track that we're showing the input
      return;
    }

    // For contact links, open directly but don't change UI state
    // All buttons remain visible and clickable
    if (action.type === 'contact_link' && action.link) {
      if (action.linkType === 'email') {
        // Copy email to clipboard and show success toast
        navigator.clipboard.writeText(action.link.replace('mailto:', '')).then(() => {
          setShowEmailCopiedToast(true);
          // Auto-dismiss toast after 2.5 seconds
          setTimeout(() => {
            setShowEmailCopiedToast(false);
          }, 2500);
        }).catch((err) => {
          console.warn('[QuickActions] Failed to copy email to clipboard:', err);
          // Could show error toast here if needed
        });
      } else {
        window.open(action.link, '_blank', 'noopener,noreferrer');
      }
      // Don't set selectedAction - keep all buttons visible
      return;
    }

    // For message_mike and other actions (including specific/affirmative that trigger queries)
    // Set selected action so we can show loading state
    setSelectedAction(action);
    onActionClick(action);
  };

  /**
   * Handle canceling the current action
   * Resets state and calls onCancel callback to hide MessageComposer
   */
  const handleCancel = () => {
    setSelectedAction(null);
    setShowCustomInput(false);
    setCustomQuery('');
    setSubmittedFollowUp(null);
    onCancel?.(); // Hide MessageComposer if it's open
  };

  const handleCustomSubmit = () => {
    if (!customQuery.trim() || disabled) return;

    const queryText = customQuery.trim();
    
    // Store the submitted query for display (this persists after submission)
    setSubmittedFollowUp(queryText);
    
    // Hide the input and clear selected action
    // Keep submittedFollowUp so it shows the actual question asked
    setShowCustomInput(false);
    setCustomQuery('');
    setSelectedAction(null); // Clear selection - submittedFollowUp will show the question

    const customAction: QuickAction = {
      type: 'custom_input',
      label: queryText, // Use the actual query text as the label
      query: queryText,
    };

    // Submit the action
    onActionClick(customAction, queryText);
  };

  const getActionIcon = (action: QuickAction) => {
    if (action.type === 'contact_link') {
      switch (action.linkType) {
        case 'github':
          return <FaGithub className="w-3.5 h-3.5" />;
        case 'linkedin':
          return <FaLinkedin className="w-3.5 h-3.5" />;
        case 'email':
          return <Mail className="w-3.5 h-3.5" />;
        default:
          return <ExternalLink className="w-3.5 h-3.5" />;
      }
    }

    // Message Mike button uses Send icon (mail arrow) from MessageComposer
    if (action.type === 'message_mike') {
      return <Send className="w-3.5 h-3.5" />;
    }

    // Ask a follow up button uses MessageSquare icon (same as old message_mike)
    if (action.type === 'custom_input') {
      return <MessageSquare className="w-3.5 h-3.5" />;
    }

    return <ArrowRight className="w-3.5 h-3.5" />;
  };

  const getActionColor = (action: QuickAction) => {
    if (action.type === 'contact_link') {
      if (action.linkType === 'github') {
        return 'from-purple-500 to-violet-600';
      }
      if (action.linkType === 'linkedin') {
        return 'from-blue-500 to-blue-600';
      }
      return 'from-cyan-500 to-blue-600';
    }

    // Message Mike button uses sky-to-indigo gradient (same as old custom_input)
    if (action.type === 'message_mike') {
      return 'from-sky-500 to-indigo-600';
    }

    // Ask a follow up button uses diagonal blue-green gradient (same as search bar)
    if (action.type === 'custom_input') {
      return 'from-blue-600 via-emerald-500 to-blue-600';
    }

    // Default for affirmative/specific
    return 'from-blue-500 to-indigo-600';
  };

  /**
   * Render the loading indicator
   * Extracted to a variable to be used in both the main return and early returns
   */
  const loaderElement = shouldShowLoading && loadingConfig ? (() => {
    const animConfig = getAnimationConfig(loadingConfig.animation);
    
    // Render appropriate animation based on component type
    let indicator;
    if (animConfig.component === 'spinner-thin') {
      // Very thin spinner
      indicator = (
        <div className="w-3.5 h-3.5 rounded-full border border-white/90 border-r-transparent animate-spin" style={{ borderWidth: '1.5px' }} />
      );
    } else if (animConfig.component === 'bars-vertical') {
      // Vertical bars
      indicator = (
        <div className="flex gap-0.5 items-center h-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-0.5 bg-white/90 rounded-full animate-pulse"
              style={{
                animationDelay: `${i * 0.15}s`,
                animationDuration: '0.7s',
                height: `${(i === 0 ? 8 : i === 1 ? 12 : 10)}px`,
              }}
            />
          ))}
        </div>
      );
    } else if (animConfig.component === 'wave-minimal') {
      // Minimal wave - smaller and tighter
      indicator = (
        <div className="flex gap-0.5 items-center h-2.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-0.5 bg-white/90 rounded-full animate-pulse"
              style={{
                animationDelay: `${i * 0.1}s`,
                animationDuration: '0.5s',
                height: `${(i % 2 === 0 ? 6 : 10)}px`,
              }}
            />
          ))}
        </div>
      );
    } else if (animConfig.component === 'grid-minimal') {
      // Smaller, tighter grid
      indicator = (
        <div className="grid grid-cols-3 gap-0.5 w-3 h-3">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="w-0.5 h-0.5 rounded-full bg-white/90 animate-pulse"
              style={{
                animationDelay: `${(i % 3 + Math.floor(i / 3)) * 0.08}s`,
                animationDuration: '0.6s',
              }}
            />
          ))}
        </div>
      );
    } else if (animConfig.component === 'spinner-minimal') {
      // Minimal spinner - thinner border
      indicator = (
        <div className="w-3 h-3 rounded-full border border-white/90 border-t-transparent animate-spin" />
      );
    } else if (animConfig.component === 'fade') {
      // Fading in/out circle
      indicator = (
        <div className="w-3 h-3 rounded-full bg-white/90 animate-pulse" style={{ animationDuration: '1s' }} />
      );
    } else {
      // Fallback to spinner-minimal
      indicator = (
        <div className="w-3 h-3 rounded-full border border-white/90 border-t-transparent animate-spin" />
      );
    }
    
    return (
      <div className="mt-2 flex items-center gap-2 text-sm text-white/70">
        {indicator}
        <span className="text-white/70">{loadingConfig.message}</span>
      </div>
    );
  })() : null;

  // If message_mike is selected, show only that button with X to cancel
  if (selectedAction && selectedAction.type === 'message_mike') {
    const gradientDirection = 'bg-gradient-to-r';
    
    return (
      <div className="mb-3">
        <div className="flex gap-2 items-center">
          <button
            type="button"
            disabled
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium max-w-sm ${gradientDirection} ${getActionColor(selectedAction)} text-white opacity-70`}
          >
            {getActionIcon(selectedAction)}
            <span className="break-words">{selectedAction.label}</span>
          </button>
          {/* X button to cancel and show all actions again */}
          <button
            type="button"
            onClick={handleCancel}
            disabled={disabled}
            className="flex-shrink-0 flex items-center justify-center rounded-full w-6 h-6 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all duration-200 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 border border-white/20"
            title="Show all actions"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  // If other actions (specific/affirmative) are selected, show only that action
  // These are disabled (not pressable) after submission
  if (selectedAction && selectedAction.type !== 'custom_input' && selectedAction.type !== 'message_mike' && selectedAction.type !== 'contact_link') {
    const gradientDirection = 'bg-gradient-to-r';
    
    return (
      <div className="mb-3">
        <div className="flex gap-2">
          <button
            type="button"
            disabled
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium max-w-sm ${gradientDirection} ${getActionColor(selectedAction)} text-white opacity-70 cursor-not-allowed`}
          >
            {getActionIcon(selectedAction)}
            <span className="break-words">{selectedAction.label}</span>
          </button>
        </div>
        {/* Professional comment: Include loader here for specific actions like "Veson Nautical" */}
        {loaderElement}
      </div>
    );
  }

  return (
    <div className="mb-3">
      {/* Show submitted follow-up query as a visual indicator - shows the actual question asked */}
      {submittedFollowUp && !showCustomInput ? (
        <div className="mb-2">
          <div className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium max-w-sm bg-gradient-to-br from-blue-600 via-emerald-500 to-blue-600 text-white opacity-70">
            <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="break-words">{submittedFollowUp}</span>
          </div>
        </div>
      ) : null}

      {/* Custom input field (shown when custom_input clicked) */}
      {showCustomInput ? (
        <div className="space-y-2">
          {/* Show the "Ask a follow up..." bubble above the input */}
          <div className="flex gap-2 items-center">
            <button
              type="button"
              disabled
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium max-w-sm bg-gradient-to-br from-blue-600 via-emerald-500 to-blue-600 text-white opacity-70"
            >
              <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="break-words">Ask a follow up...</span>
            </button>
            {/* X button to cancel and show all actions again */}
            <button
              type="button"
              onClick={handleCancel}
              disabled={disabled}
              className="flex-shrink-0 flex items-center justify-center rounded-full w-6 h-6 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all duration-200 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 border border-white/20"
              title="Show all actions"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          {/* Input field with submit button */}
          <div className="flex gap-2">
            <input
              type="text"
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleCustomSubmit();
                }
              }}
              placeholder="Ask a follow up..."
              disabled={disabled}
              autoFocus
              maxLength={500}
              className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none disabled:opacity-50 text-sm"
            />
            <button
              type="button"
              onClick={handleCustomSubmit}
              disabled={disabled || !customQuery.trim()}
              className="flex-shrink-0 flex items-center justify-center rounded-full w-9 h-9 bg-gradient-to-br from-blue-600 via-emerald-500 to-blue-600 text-white shadow-md border border-white/20 transition-all duration-200 ease-out hover:shadow-lg hover:scale-105 hover:from-blue-500 hover:via-emerald-400 hover:to-blue-500 backdrop-blur-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
            >
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>
        </div>
      ) : !submittedFollowUp ? (
        /* Horizontal scrollable bubbles - only show if no follow-up has been submitted */
        <div className="flex gap-2 overflow-x-auto py-2 -mx-1 px-1 scrollbar-none">
          {/* Hide scrollbar completely while keeping scroll functionality */}
          <style jsx>{`
            div::-webkit-scrollbar {
              display: none;
            }
            div {
              -ms-overflow-style: none;
              scrollbar-width: none;
            }
          `}</style>

          {actions.map((action, index) => {
            // Skip showing actions that are currently selected (except contact links which always show)
            // For message_mike and custom_input, they're handled separately above
            if (selectedAction && selectedAction.type !== 'contact_link' && action.type === selectedAction.type) {
              return null;
            }
            
            // Hide custom_input action if a follow-up has been submitted (it's shown as submittedFollowUp instead)
            if (action.type === 'custom_input' && submittedFollowUp) {
              return null;
            }
            
            // Use diagonal gradient (bg-gradient-to-br) for custom_input to match search bar
            // Use horizontal gradient (bg-gradient-to-r) for all other actions
            const gradientDirection = action.type === 'custom_input' ? 'bg-gradient-to-br' : 'bg-gradient-to-r';
            
            return (
              <button
                key={index}
                type="button"
                onClick={() => handleActionClick(action)}
                disabled={disabled}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 transform max-w-sm ${gradientDirection} ${getActionColor(action)} text-white hover:scale-105 disabled:opacity-50 disabled:scale-100`}
              >
                <span className="flex-shrink-0">{getActionIcon(action)}</span>
                <span className="break-words">{action.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Loading message - shown when processing a query from quick actions */}
      {loaderElement}

      {/* Email copied success toast - shows when email is copied to clipboard */}
      {showEmailCopiedToast && (
        <div className="fixed bottom-32 left-1/2 transform -translate-x-1/2 z-50 email-toast-enter">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-emerald-600/90 via-teal-500/90 to-cyan-600/90 border border-emerald-400/50 backdrop-blur-sm shadow-lg shadow-emerald-900/30 text-white">
            <Mail className="w-4 h-4 text-emerald-100" />
            <span className="text-sm font-medium">Email copied to clipboard!</span>
          </div>
        </div>
      )}
    </div>
  );
}
