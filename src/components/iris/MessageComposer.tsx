"use client";

import React, { useState, useEffect } from 'react';
import { Mail, Send, Loader2, Info } from 'lucide-react';
import { generateNonce } from '@/lib/security';
import ContainedMouseGlow from '../ContainedMouseGlow';


interface MessageComposerProps {
  /**
   * Origin source that triggered this composer
   */
  origin: 'iris-explicit' | 'iris-suggested' | 'auto-insufficient';
  
  /**
   * Optional draft suggestion from Iris
   */
  initialDraft?: string;
  
  /**
   * Whether inputs are locked (during streaming)
   */
  locked: boolean;
  
  /**
   * The user's original question that led to this composer
   */
  userQuery?: string;
  
  /**
   * Callback when user cancels the composer
   */
  onCancel?: () => void;
}

/**
 * Hint chips shown when textarea is empty
 * Suggest common questions to guide users
 */
const HINT_CHIPS = [
  "What projects have you worked on?",
  "Do you have experience with React?",
  "Tell me about your latest work",
];

/**
 * Get the draft message based on the origin
 * Customizes the draft text based on how the composer was triggered
 */
function getDraftForOrigin(origin: string, initialDraft?: string, userQuery?: string): string {
  if (initialDraft) return initialDraft;
  
  // For insufficient context, provide a helpful draft that mentions the original question
  if (origin === 'auto-insufficient' && userQuery) {
    return `I'd like to know more about: ${userQuery}. Can you provide more details?`;
  }
  
  return 'Ask Mike anything...';
}

/**
 * MessageComposer - Inline form for sending messages to Mike
 * 
 * Features:
 * - Textarea with character counter (max 500)
 * - Contact method toggle: Email/Phone/Anonymous
 * - Email validation and phone formatting
 * - localStorage caching for last contact method
 * - Submits to /api/inbox with context
 * - Shows success/error states
 * - Locked during streaming
 */
export default function MessageComposer({
  origin,
  initialDraft,
  locked,
  userQuery,
}: MessageComposerProps) {
  // Form state
  const [message, setMessage] = useState(() => getDraftForOrigin(origin, initialDraft, userQuery));
  const [contact, setContact] = useState('');

  function detectContactType(value: string): 'email' | 'phone' | 'anon' {
    const trimmed = value.trim();
    if (!trimmed) return 'anon';
    if (trimmed.includes('@')) return 'email';
    if (/^[+\d\s\-()]+$/.test(trimmed) && trimmed.replace(/\D/g, '').length >= 7) return 'phone';
    return 'email'; // default assumption for non-empty strings
  }
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  /**
   * Load cached contact info from localStorage
   * On mount, restore the last contact value
   */
  useEffect(() => {
    try {
      const cached = localStorage.getItem('iris_contact_value');
      if (cached) setContact(cached);
    } catch {
      // localStorage unavailable
    }
  }, []);
  
  /**
   * Save contact info to localStorage before submission
   */
  const cacheContactInfo = () => {
    try {
      if (contact.trim()) {
        localStorage.setItem('iris_contact_value', contact.trim());
      }
    } catch {
      // Ignore localStorage errors
    }
  };
  
  /**
   * Validate form before submission
   */
  const validateForm = async (): Promise<string | null> => {
    if (!message.trim() || message.trim().length < 3) {
      return 'Please enter a message (at least 3 characters)';
    }
    if (message.length > 500) {
      return 'Message must be under 500 characters';
    }

    const trimmedContact = contact.trim();
    if (trimmedContact) {
      const type = detectContactType(trimmedContact);
      if (type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedContact)) {
          return 'Please enter a valid email address';
        }
      } else if (type === 'phone') {
        if (trimmedContact.replace(/\D/g, '').length < 7) {
          return 'Please enter a valid phone number';
        }
      }
    }

    return null;
  };
  
  /**
   * Handle form submission
   * Validates, caches, submits to API, and shows result
   */
  const handleSubmit = async () => {
    // Reset error states
    setError(null);
    setValidationError(null);
    
    // Validate form (now async)
    const validationErrorMsg = await validateForm();
    if (validationErrorMsg) {
      setValidationError(validationErrorMsg);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Cache contact info for next time
      cacheContactInfo();
      
      // Prepare payload
      const detectedType = detectContactType(contact.trim());
      const contactPayload = detectedType === 'anon'
        ? { method: 'anon' as const }
        : detectedType === 'email'
          ? { method: 'email' as const, value: contact.trim() }
          : { method: 'phone' as const, value: contact.trim() };

      const payload = {
        source: origin,
        userQuery,
        message: message.trim(),
        contact: contactPayload,
        nonce: generateNonce(16),
      };
      
      // Submit to API with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for inbox
      
      const response = await fetch('/api/inbox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }
      
      // Success: Show submitted message
      setSubmittedMessage(message.trim());
      setMessage('');
      
    } catch (err) {
      console.error('[MessageComposer] Submit error:', err);
      
      // Check if it's a timeout error
      if (err instanceof Error && err.name === 'AbortError') {
        setError('⏱️ Request timed out. Please check your connection and try again.');
      } else {
        setError('Something went wrong sending your message. Please try again in a moment.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Success state: Show confirmation
  if (submittedMessage) {
    return (
      <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-600/25 via-teal-500/20 to-cyan-600/25 border border-emerald-400/30 backdrop-blur-sm shadow-lg shadow-emerald-900/20">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-lg bg-gradient-to-br from-emerald-500/30 to-teal-500/20 p-2 shadow-sm">
            <Mail className="w-4 h-4 text-emerald-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-emerald-300 font-medium mb-1">
              Sent! Mike will get back to you soon.
            </div>
            <div className="text-xs text-white/60 whitespace-pre-wrap">
              {submittedMessage}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Error state - only show for submission/network errors, not validation errors
  if (error) {
    return (
      <div className="p-4 rounded-xl bg-gradient-to-br from-red-600/20 via-red-400/15 to-red-600/20 border border-red-500/20 backdrop-blur-sm">
        <div className="text-sm text-red-400">{error}</div>
      </div>
    );
  }
  
  // Main form
  return (
    <div className="p-3 sm:p-4 rounded-xl bg-gradient-to-br from-slate-800/30 via-blue-900/20 to-indigo-800/25 border border-blue-400/20 backdrop-blur-sm shadow-lg shadow-blue-900/10">
      {/* Header - hide on mobile to save space */}
      <div className="hidden sm:flex items-center gap-2 mb-3">
        <h3 className="text-sm font-medium text-white/90">
          Send Mike a message
        </h3>
        <div className="relative group">
          <Info className="w-4 h-4 text-white/40 hover:text-white/60 transition-colors cursor-help" />
          {/* Tooltip - responsive positioning */}
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900/95 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 w-64 text-center sm:w-72">
            Iris will send this message on your behalf, including the context of your conversation so far.
            {/* Mobile-friendly arrow */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900/95"></div>
          </div>
        </div>
      </div>
      
      {/* Message textarea */}
      <div className="mb-2 sm:mb-3">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={locked || isSubmitting}
          placeholder="Type your message..."
          rows={2}
          maxLength={500}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed resize-none text-sm sm:text-base"
        />
        {message.length === 0 && (
          <div className="flex flex-wrap gap-1 mt-1 sm:mt-2">
            {HINT_CHIPS.map((hint, i) => (
              <button
                key={i}
                onClick={() => setMessage(hint)}
                disabled={locked || isSubmitting}
                className="text-xs px-2 py-0.5 rounded-xl bg-gradient-to-r from-blue-800/30 to-blue-900/20 hover:from-blue-700/40 hover:to-blue-800/30 text-white/60 hover:text-white/80 transition-all duration-150 transform hover:scale-105 hover:shadow-sm hover:shadow-blue-500/10 disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
              >
                {hint}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Smart contact field — auto-detects email vs phone */}
      <div className="mb-2 sm:mb-3">
        <input
          type="text"
          value={contact}
          onChange={(e) => {
            setContact(e.target.value);
            if (validationError) setValidationError(null);
          }}
          disabled={locked || isSubmitting}
          placeholder="Email or phone (optional)"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-0 disabled:opacity-50 text-sm sm:text-base"
        />
        <p className="text-xs text-white/30 mt-1">Leave contact info to get a response</p>
        {validationError && (
          <div className="mt-1 text-xs text-red-400">{validationError}</div>
        )}
      </div>
      
      {/* Action buttons */}
      <div className="flex gap-2">
        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={locked || isSubmitting || !message.trim()}
          className="flex-1 relative flex items-center justify-center gap-2 px-4 py-2 sm:py-2.5 rounded-xl text-white font-medium transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 overflow-hidden text-sm sm:text-base"
          style={{
            background: 'linear-gradient(90deg, #6B4EFF 0%, #00A8FF 100%)',
          }}
        >
          <ContainedMouseGlow color="147, 197, 253" intensity={0.3} size={200} />
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Send to Mike
            </>
          )}
        </button>
      </div>
      
      {/* Privacy note - hide on mobile to save space */}
      <p className="hidden sm:block text-xs text-white/40 mt-2 text-center">
        Your contact info is only used to respond to your message.
      </p>
    </div>
  );
}
