/**
 * Google Analytics 4 Event Tracking Utility
 *
 * This module provides type-safe wrappers for GA4 event tracking.
 * Events are only sent when GA is configured (NEXT_PUBLIC_GA_MEASUREMENT_ID is set).
 *
 * Usage:
 *   import { trackEvent } from '@/lib/analytics/gtag';
 *   trackEvent('iris_open', { method: 'keyboard' });
 */

// Extend Window interface for gtag
declare global {
  interface Window {
    gtag?: (
      command: 'event' | 'config' | 'set',
      targetId: string,
      config?: Record<string, unknown>
    ) => void;
  }
}

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/**
 * Check if Google Analytics is available
 */
export const isGAEnabled = (): boolean => {
  return typeof window !== 'undefined' && !!GA_MEASUREMENT_ID && !!window.gtag;
};

/**
 * Track a custom event in GA4
 *
 * @param eventName - The name of the event (e.g., 'iris_open', 'message_submit')
 * @param parameters - Optional event parameters
 */
export const trackEvent = (
  eventName: string,
  parameters?: Record<string, string | number | boolean | undefined>
): void => {
  if (!isGAEnabled()) return;

  // Filter out undefined values
  const cleanParams = parameters
    ? Object.fromEntries(
        Object.entries(parameters).filter(([, v]) => v !== undefined)
      )
    : undefined;

  window.gtag?.('event', eventName, cleanParams);
};

// ============================================================================
// Iris AI Assistant Events
// ============================================================================

export type IrisOpenMethod = 'button' | 'keyboard';

/**
 * Track when Iris command palette is opened
 */
export const trackIrisOpen = (method: IrisOpenMethod): void => {
  trackEvent('iris_open', { method });
};

/**
 * Track when Iris command palette is closed
 */
export const trackIrisClose = (): void => {
  trackEvent('iris_close');
};

export type IrisIntentType =
  | 'contact'
  | 'filter_query'
  | 'specific_item'
  | 'personal'
  | 'general'
  | 'github_activity';

/**
 * Track when a user submits a query to Iris
 */
export const trackIrisQuerySubmit = (params: {
  query_length: number;
  intent_type?: IrisIntentType;
}): void => {
  trackEvent('iris_query_submit', params);
};

/**
 * Track when Iris returns an answer
 */
export const trackIrisAnswerReceived = (params: {
  answer_length: number;
  latency_ms: number;
  intent_type?: IrisIntentType;
  cached?: boolean;
}): void => {
  trackEvent('iris_answer_received', params);
};

export type QuickActionType = 'link' | 'dropdown' | 'query' | 'message_mike' | 'custom_input';

/**
 * Track when a user clicks a quick action
 */
export const trackQuickActionClick = (params: {
  action_type: QuickActionType;
  action_label: string;
  action_index?: number;
}): void => {
  trackEvent('iris_quick_action_click', params);
};

/**
 * Track when MessageComposer opens from Iris
 */
export const trackContactComposerOpen = (params: {
  reason: 'user_request' | 'insufficient_context' | 'more_detail' | 'auto';
}): void => {
  trackEvent('iris_contact_composer_open', params);
};

// ============================================================================
// Contact Form Events
// ============================================================================

export type ContactMethod = 'email' | 'phone' | 'anonymous';

/**
 * Track when user selects a contact method
 */
export const trackContactMethodSelect = (method: ContactMethod): void => {
  trackEvent('contact_method_select', { method });
};

/**
 * Track contact form submission attempt
 */
export const trackMessageSubmit = (params: {
  source: 'iris-explicit' | 'iris-suggested' | 'auto-insufficient';
  message_length: number;
  contact_method: ContactMethod;
}): void => {
  trackEvent('message_submit', params);
};

/**
 * Track successful message submission
 */
export const trackMessageSubmitSuccess = (params: {
  source: string;
  contact_method: ContactMethod;
}): void => {
  trackEvent('message_submit_success', params);
};

/**
 * Track failed message submission
 */
export const trackMessageSubmitError = (params: {
  error_type: 'network' | 'timeout' | 'validation' | 'server';
}): void => {
  trackEvent('message_submit_error', params);
};

// ============================================================================
// External Link Events
// ============================================================================

export type LinkType = 'github' | 'linkedin' | 'email' | 'calendly' | 'demo' | 'article' | 'company' | 'other';

/**
 * Track external link clicks
 */
export const trackExternalLinkClick = (params: {
  link_type: LinkType;
  link_destination: string;
  origin?: string;
}): void => {
  trackEvent('external_link_click', params);
};

/**
 * Track project GitHub link click
 */
export const trackProjectGithubClick = (params: {
  project_id: string;
  project_name: string;
}): void => {
  trackEvent('project_github_click', params);
};

/**
 * Track project demo/live link click
 */
export const trackProjectDemoClick = (params: {
  project_id: string;
  project_name: string;
}): void => {
  trackEvent('project_demo_click', params);
};

// ============================================================================
// UI Interaction Events
// ============================================================================

/**
 * Track theme toggle
 */
export const trackThemeToggle = (theme: 'dark' | 'light'): void => {
  trackEvent('theme_toggle', { theme });
};

/**
 * Track about sheet open (mobile)
 */
export const trackAboutSheetOpen = (): void => {
  trackEvent('about_sheet_open', { platform: 'mobile' });
};

/**
 * Track section visibility on homepage
 */
export const trackSectionView = (section: 'about' | 'experience' | 'projects' | 'blogs'): void => {
  trackEvent('section_view', { section_name: section });
};
