/**
 * Hook to parse UI directives from streaming text
 * Detects and parses <ui:contact .../> tags from Iris responses
 * 
 * Only detects one directive per stream to avoid duplicates
 */

import { useState, useEffect } from 'react';
import type { ContactDirective, ContactReason, ContactOpenBehavior } from '@/lib/types';

/**
 * Strip UI directives from text
 * Returns text with directives removed
 */
export function stripUiDirectives(text: string): string {
  return text.replace(/<ui:contact\s+[^>]*?\/>/g, '').trim();
}

/**
 * Parse attributes from a UI directive tag
 * Handles attributes in any order
 */
function parseAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /(\w+)="([^"]*)"/g;
  let match;
  
  while ((match = attrRegex.exec(attrString)) !== null) {
    attrs[match[1]] = match[2];
  }
  
  return attrs;
}

/**
 * Detect and parse UI directive from text
 * Looks for <ui:contact .../> tags
 * 
 * @param text - Streaming text to scan
 * @returns Parsed directive or null if none found
 */
export function detectContactDirective(text: string): ContactDirective | null {
  // Use a regex to find <ui:contact .../> tags
  // We use [\s\S]*? for non-greedy matching to avoid matching across tags
  const tagRegex = /<ui:contact\s+([^>]*?)\/>/;
  const match = text.match(tagRegex);
  
  if (!match) return null;
  
  const attrs = parseAttributes(match[1]);
  
  // Validate required reason attribute
  if (!attrs.reason || !['insufficient_context', 'more_detail', 'user_request'].includes(attrs.reason)) {
    return null;
  }
  
  return {
    type: 'contact',
    reason: attrs.reason as ContactReason,
    draft: attrs.draft,
    open: attrs.open as ContactOpenBehavior | undefined,
  };
}

/**
 * Hook to track UI directives in streaming text
 * Resets directive state when streamText changes to a new answer
 * Only detects one directive per answer to avoid showing multiple composers
 * 
 * @param streamText - The accumulated streaming text
 * @returns The detected directive or null
 */
export function useUiDirectives(streamText: string): ContactDirective | null {
  const [directive, setDirective] = useState<ContactDirective | null>(null);
  const [lastStreamText, setLastStreamText] = useState<string>('');
  
  useEffect(() => {
    // Reset directive if streamText has changed to a new answer
    // This happens when a new query starts (streamText becomes empty or different)
    if (streamText !== lastStreamText) {
      setDirective(null);
      setLastStreamText(streamText);
    }
    
    // Only detect if we haven't already found one for this answer
    if (directive) return;
    
    const detected = detectContactDirective(streamText);
    if (detected) {
      setDirective(detected);
    }
  }, [streamText, directive, lastStreamText]);
  
  return directive;
}

/**
 * Determine default open behavior based on reason
 * Used when no explicit 'open' attribute is provided
 */
export function defaultOpenFor(reason: string): 'auto' | 'cta' {
  return reason === 'insufficient_context' || reason === 'user_request' ? 'auto' : 'cta';
}
