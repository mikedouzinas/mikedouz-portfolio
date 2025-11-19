"use client";

import React, { useState } from 'react';
import { ArrowRight, MessageSquare, ExternalLink, Mail, Send, X } from 'lucide-react';
import { FaLinkedin, FaGithub } from 'react-icons/fa';

export interface QuickAction {
  type: 'affirmative' | 'custom_input' | 'specific' | 'contact_link' | 'message_mike';
  label: string;
  query?: string;           // Pre-filled query for affirmative/specific
  intent?: string;          // Skip re-classification
  filters?: Record<string, unknown>;  // Direct filter application
  link?: string;            // For contact_link type
  linkType?: 'github' | 'linkedin' | 'email' | 'external';  // Icon selection
}

interface QuickActionsProps {
  actions: QuickAction[];
  onActionClick: (action: QuickAction, customQuery?: string) => void;
  onCancel?: () => void;    // Callback to cancel action and show all actions again
  disabled?: boolean;
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
}: QuickActionsProps) {
  const [selectedAction, setSelectedAction] = useState<QuickAction | null>(null);
  const [customQuery, setCustomQuery] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [submittedFollowUp, setSubmittedFollowUp] = useState<string | null>(null); // Track submitted follow-up query

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
        navigator.clipboard.writeText(action.link.replace('mailto:', ''));
        // Could show a toast here
      } else {
        window.open(action.link, '_blank', 'noopener,noreferrer');
      }
      // Don't set selectedAction - keep all buttons visible
      return;
    }

    // For message_mike and other actions, show only that action
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
    
    // Store the submitted query for display
    setSubmittedFollowUp(queryText);
    
    // Hide the input and clear selected action so all actions show again
    setShowCustomInput(false);
    setCustomQuery('');
    setSelectedAction(null); // Clear selection so all actions are visible again

    const customAction: QuickAction = {
      type: 'custom_input',
      label: queryText,
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

  // If message_mike is selected, show only that button with X to cancel
  if (selectedAction && selectedAction.type === 'message_mike') {
    const gradientDirection = 'bg-gradient-to-r';
    
    return (
      <div className="mb-3">
        <div className="flex gap-2 items-center">
          <button
            type="button"
            disabled
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap ${gradientDirection} ${getActionColor(selectedAction)} text-white opacity-70`}
          >
            {getActionIcon(selectedAction)}
            <span>{selectedAction.label}</span>
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
  // These don't need an X button since they don't open the composer
  if (selectedAction && selectedAction.type !== 'custom_input' && selectedAction.type !== 'message_mike' && selectedAction.type !== 'contact_link') {
    const gradientDirection = 'bg-gradient-to-r';
    
    return (
      <div className="mb-3">
        <div className="flex gap-2">
          <button
            type="button"
            disabled
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap ${gradientDirection} ${getActionColor(selectedAction)} text-white opacity-70`}
          >
            {getActionIcon(selectedAction)}
            <span>{selectedAction.label}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3">
      {/* Show submitted follow-up query as a visual indicator */}
      {submittedFollowUp && !showCustomInput ? (
        <div className="mb-2">
          <div className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap bg-gradient-to-br from-blue-600 via-emerald-500 to-blue-600 text-white opacity-70">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{submittedFollowUp}</span>
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
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap bg-gradient-to-br from-blue-600 via-emerald-500 to-blue-600 text-white opacity-70"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Ask a follow up...</span>
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
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 transform whitespace-nowrap ${gradientDirection} ${getActionColor(action)} text-white hover:scale-105 disabled:opacity-50 disabled:scale-100`}
              >
                {getActionIcon(action)}
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
