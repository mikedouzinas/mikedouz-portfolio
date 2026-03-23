'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface TextSelection {
  text: string;
  rect: DOMRect;
}

/**
 * Detects text selection within a specific container element.
 * Returns the selected text and its bounding rect for bubble positioning.
 *
 * When activeConversation is true:
 * - New selections are ignored (locked to original)
 * - Selection clearing doesn't dismiss
 */
export function useTextSelection(containerRef: React.RefObject<HTMLElement | null>) {
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const activeConversation = useRef(false);

  const setConversationActive = useCallback((active: boolean) => {
    activeConversation.current = active;
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);

  useEffect(() => {
    const handleSelectionChange = () => {
      // When conversation is active, ignore ALL selection changes
      // Bubble stays locked to the original highlight
      if (activeConversation.current) {
        return;
      }

      const sel = document.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        setSelection(null);
        return;
      }

      const anchor = sel.anchorNode;
      if (!anchor || !containerRef.current?.contains(anchor)) {
        return;
      }

      const range = sel.getRangeAt(0);
      const text = sel.toString().trim();
      if (text.length < 3) return;

      const rect = range.getBoundingClientRect();
      setSelection({ text, rect });
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [containerRef]);

  return { selection, clearSelection, setConversationActive };
}
