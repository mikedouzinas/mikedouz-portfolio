"use client";

import React, { useState, useEffect } from 'react';
import { Mail, Phone, User, Send, Loader2, Info } from 'lucide-react';
import { isValidPhoneFormat, validateAndFormatPhone } from '@/lib/phone';
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
  onCancel,
}: MessageComposerProps) {
  // Form state
  const [message, setMessage] = useState(() => getDraftForOrigin(origin, initialDraft, userQuery));
  const [contactMethod, setContactMethod] = useState<'email' | 'phone' | 'anon'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('US');
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  /**
   * Load cached contact info from localStorage
   * On mount, restore the last contact method and value
   */
  useEffect(() => {
    try {
      const cached = localStorage.getItem('iris_contact_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        setContactMethod(parsed.method || 'email');
        
        if (parsed.method === 'email' && parsed.value) {
          setEmail(parsed.value);
        } else if (parsed.method === 'phone' && parsed.value) {
          setPhone(parsed.value);
        }
      }
    } catch {
      // Ignore localStorage errors (e.g., incognito mode)
    }
  }, []);
  
  /**
   * Save contact info to localStorage before submission
   */
  const cacheContactInfo = () => {
    try {
      const cache = {
        method: contactMethod,
        value: contactMethod === 'email' ? email : contactMethod === 'phone' ? phone : undefined,
        countryCode: contactMethod === 'phone' ? countryCode : undefined,
      };
      localStorage.setItem('iris_contact_cache', JSON.stringify(cache));
    } catch {
      // Ignore localStorage errors
    }
  };
  
  /**
   * Validate form before submission
   * Uses thorough validation to catch issues before API submission
   */
  const validateForm = async (): Promise<string | null> => {
    // Message required
    if (!message.trim() || message.trim().length < 3) {
      return 'Please enter a message (at least 3 characters)';
    }
    
    if (message.length > 500) {
      return 'Message must be under 500 characters';
    }
    
    // Contact method validation
    if (contactMethod === 'email') {
      if (!email.trim()) {
        return 'Please enter your email address';
      }
      
      const emailTrimmed = email.trim();
      
      // Length check
      if (emailTrimmed.length > 254) { // RFC 5321 limit
        return 'Email address is too long';
      }
      
      // Basic format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailTrimmed)) {
        return 'Please enter a valid email address (e.g., name@example.com)';
      }
      
      // Check for common issues
      if (emailTrimmed.includes('..')) {
        return 'Email address cannot contain consecutive dots';
      }
      
      if (emailTrimmed.startsWith('.') || emailTrimmed.endsWith('.')) {
        return 'Email address cannot start or end with a dot';
      }
      
      if (emailTrimmed.includes('@.') || emailTrimmed.includes('.@')) {
        return 'Email address has invalid format';
      }
      
    } else if (contactMethod === 'phone') {
      if (!phone.trim()) {
        return 'Please enter your phone number';
      }
      
      // Length check
      const phoneTrimmed = phone.replace(/[^\d+]/g, '');
      if (phoneTrimmed.length < 7) {
        return 'Phone number is too short';
      }
      
      if (phoneTrimmed.length > 15) { // E.164 max length
        return 'Phone number is too long';
      }
      
      // Basic format validation
      if (!isValidPhoneFormat(phone)) {
        return 'Please enter a valid phone number (e.g., +1 234 567 8900)';
      }
      
      // Thorough validation using the same logic as the API
      try {
        const formatted = await validateAndFormatPhone(phone, countryCode);
        if (!formatted) {
          return 'Please enter a valid phone number (e.g., +1 234 567 8900)';
        }
      } catch (error) {
        console.warn('[MessageComposer] Phone validation error:', error);
        return 'Please enter a valid phone number (e.g., +1 234 567 8900)';
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
      const payload = {
        source: origin,
        userQuery,
        message: message.trim(),
        contact:
          contactMethod === 'email'
            ? { method: 'email' as const, value: email.trim() }
            : contactMethod === 'phone'
            ? { method: 'phone' as const, value: phone.trim() }
            : { method: 'anon' as const },
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
        setError('⏱️ Request timed out due to slow connection. Please check your WiFi and try again.');
      } else if (err instanceof Error && err.message.includes('fetch')) {
        setError('🌐 Network error: Unable to connect to the server. Please check your internet connection.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to send message. Please try again.');
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
      
      {/* Contact method selector */}
      <div className="mb-2 sm:mb-3">
        {/* Horizontal scrollable container for mobile */}
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
          <button
            type="button"
            onClick={() => setContactMethod('email')}
            disabled={locked || isSubmitting}
            className={`flex-shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 transform whitespace-nowrap ${
              contactMethod === 'email'
                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white scale-105'
                : 'bg-gradient-to-r from-blue-800/30 to-blue-900/20 text-white/70 hover:from-blue-700/40 hover:to-blue-800/30 hover:text-white/90 hover:scale-105'
            } disabled:opacity-50 disabled:scale-100`}
          >
            <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Email</span>
            <span className="sm:hidden">Email</span>
          </button>
          <button
            type="button"
            onClick={() => setContactMethod('phone')}
            disabled={locked || isSubmitting}
            className={`flex-shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 transform whitespace-nowrap ${
              contactMethod === 'phone'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white scale-105'
                : 'bg-gradient-to-r from-blue-800/30 to-blue-900/20 text-white/70 hover:from-blue-700/40 hover:to-blue-800/30 hover:text-white/90 hover:scale-105'
            } disabled:opacity-50 disabled:scale-100`}
          >
            <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Phone</span>
            <span className="sm:hidden">Phone</span>
          </button>
          <button
            type="button"
            onClick={() => setContactMethod('anon')}
            disabled={locked || isSubmitting}
            className={`flex-shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 transform whitespace-nowrap ${
              contactMethod === 'anon'
                ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white scale-105'
                : 'bg-gradient-to-r from-blue-800/30 to-blue-900/20 text-white/70 hover:from-blue-700/40 hover:to-blue-800/30 hover:text-white/90 hover:scale-105'
            } disabled:opacity-50 disabled:scale-100`}
          >
            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Anonymous</span>
          </button>
        </div>
        
        {/* Contact input field */}
        {contactMethod === 'email' && (
          <>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (validationError) setValidationError(null);
              }}
              disabled={locked || isSubmitting}
              placeholder="your.email@example.com"
              className="w-full mt-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-0 disabled:opacity-50 text-sm sm:text-base break-all"
            />
            {validationError && (contactMethod === 'email' || validationError.includes('email')) && (
              <div className="mt-1 text-xs text-red-400">{validationError}</div>
            )}
          </>
        )}
        {contactMethod === 'phone' && (
          <>
            <div className="mt-1 sm:mt-2 flex gap-2 min-w-0">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                disabled={locked || isSubmitting}
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-0 disabled:opacity-50"
              >
                <option value="US">🇺🇸 +1</option>
                <option value="GR">🇬🇷 +30</option>
                <option value="ES">🇪🇸 +34</option>
              </select>
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                disabled={locked || isSubmitting}
                placeholder="1234567890"
                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-0 disabled:opacity-50 text-sm sm:text-base break-all min-w-0"
              />
            </div>
            {validationError && (contactMethod === 'phone' || validationError.includes('phone')) && (
              <div className="mt-1 text-xs text-red-400">{validationError}</div>
            )}
          </>
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
