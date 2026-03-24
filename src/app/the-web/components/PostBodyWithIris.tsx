'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { useTextSelection, TextSelection } from '../hooks/useTextSelection';
import BlogIrisBubble from './BlogIrisBubble';

interface PostBodyWithIrisProps {
  slug: string;
  postTitle?: string;
  children: React.ReactNode;
}

export default function PostBodyWithIris({ slug, postTitle, children }: PostBodyWithIrisProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const { selection, setSelection, clearSelection, lock, unlock } = useTextSelection(bodyRef, bubbleRef);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Mobile: paragraph-tap to select
  useEffect(() => {
    if (!isMobile) return;
    const container = bodyRef.current;
    if (!container) return;

    const handleTap = (e: Event) => {
      const target = e.target as HTMLElement;

      // Don't intercept taps on links, buttons, or other interactive elements
      if (target.closest('a, button, input, textarea, [role="button"]')) return;

      // Find the nearest paragraph-level element
      const paragraph = target.closest('p, blockquote, li, h2, h3, h4');
      if (!paragraph || !container.contains(paragraph)) return;

      // Don't trigger if user is actually selecting text
      const sel = document.getSelection();
      if (sel && !sel.isCollapsed) return;

      const text = paragraph.textContent?.trim();
      if (!text || text.length < 10) return;

      const rect = paragraph.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      setSelection({
        text,
        rect,
        containerRelative: {
          top: rect.top - containerRect.top + container.scrollTop,
          height: rect.height,
        },
      });
    };

    container.addEventListener('click', handleTap);
    return () => container.removeEventListener('click', handleTap);
  }, [isMobile, setSelection]);

  // Locked highlight position — persists after native selection clears
  const [highlightPos, setHighlightPos] = useState<{ top: number; height: number } | null>(null);

  const handleLock = useCallback(() => {
    if (selection?.containerRelative) {
      setHighlightPos(selection.containerRelative);
    }
    lock();
  }, [lock, selection]);

  const handleClose = useCallback(() => {
    setHighlightPos(null);
    unlock();
    clearSelection();
  }, [unlock, clearSelection]);

  // Show highlight line: either from live selection or locked position
  const showLine = selection?.containerRelative || highlightPos;

  return (
    <div ref={bodyRef} className="relative" data-post-body>
      {/* Green passage indicator line */}
      {showLine && (
        <div
          className="absolute pointer-events-none rounded-sm transition-opacity duration-200"
          style={{
            left: -8,
            top: showLine.top,
            height: showLine.height,
            width: 3,
            background: '#10b981',
            boxShadow: '0 0 8px rgba(16, 185, 129, 0.5), 0 0 20px rgba(16, 185, 129, 0.2)',
          }}
        />
      )}
      {children}
      {selection && (
        <BlogIrisBubble
          ref={bubbleRef}
          slug={slug}
          postTitle={postTitle}
          selection={selection}
          onClose={handleClose}
          onLock={handleLock}
        />
      )}
    </div>
  );
}
