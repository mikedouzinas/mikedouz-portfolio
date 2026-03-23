'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface TextSelection {
  text: string;
  rect: DOMRect;
}

/**
 * Detects text selection within a specific container element.
 *
 * Two phases:
 * - Before locked: selection changes update state. Clearing selection closes bubble
 *   UNLESS focus is inside the bubble (user clicked the textbox).
 * - After locked: all selection changes ignored (conversation in progress).
 */
export function useTextSelection(
  containerRef: React.RefObject<HTMLElement | null>,
  bubbleRef: React.RefObject<HTMLElement | null>,
) {
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const locked = useRef(false);

  const lock = useCallback(() => {
    locked.current = true;
  }, []);

  const unlock = useCallback(() => {
    locked.current = false;
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);

  useEffect(() => {
    const handleSelectionChange = () => {
      // Phase 2: locked — ignore everything
      if (locked.current) return;

      const sel = document.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        // Selection was cleared. Don't close if focus is inside the bubble
        // (user clicked the textbox, which clears browser selection)
        if (bubbleRef.current && bubbleRef.current.contains(document.activeElement)) {
          return;
        }
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
  }, [containerRef, bubbleRef]);

  return { selection, clearSelection, lock, unlock };
}
