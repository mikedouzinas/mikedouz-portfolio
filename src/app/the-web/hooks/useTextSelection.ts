'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface TextSelection {
  text: string;
  rect: DOMRect;
  /** Top and height of the full selection range, relative to the container element */
  containerRelative: { top: number; height: number } | null;
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
    // Capture the finalized selection. Used by both mouseup (desktop)
    // and touchend (mobile — touch selection doesn't fire mouseup).
    const captureSelection = () => {
      if (locked.current) return;

      const sel = document.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;

      const anchor = sel.anchorNode;
      if (!anchor || !containerRef.current?.contains(anchor)) return;

      const range = sel.getRangeAt(0);
      const text = sel.toString().trim();
      if (text.length < 3) return;

      const rect = range.getBoundingClientRect();
      const container = containerRef.current;
      let containerRelative: { top: number; height: number } | null = null;
      if (container) {
        const containerRect = container.getBoundingClientRect();
        containerRelative = {
          top: rect.top - containerRect.top + container.scrollTop,
          height: rect.height,
        };
      }
      setSelection({ text, rect, containerRelative });
    };

    // Small delay on touchend so the browser finalizes the selection first
    const handleTouchEnd = () => {
      setTimeout(captureSelection, 80);
    };

    // selectionchange only used to detect when selection is cleared
    const handleSelectionChange = () => {
      if (locked.current) return;

      const sel = document.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        // Don't close if focus is inside the bubble (user clicked textbox)
        if (bubbleRef.current && bubbleRef.current.contains(document.activeElement)) {
          return;
        }
        setSelection(null);
      }
    };

    document.addEventListener('mouseup', captureSelection);
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('mouseup', captureSelection);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [containerRef, bubbleRef]);

  return { selection, clearSelection, lock, unlock };
}
