'use client';

import { useRef, useState, useCallback } from 'react';
import { useTextSelection } from '../hooks/useTextSelection';
import BlogIrisBubble from './BlogIrisBubble';

interface PostBodyWithIrisProps {
  slug: string;
  postTitle?: string;
  children: React.ReactNode;
}

export default function PostBodyWithIris({ slug, postTitle, children }: PostBodyWithIrisProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const { selection, clearSelection, lock, unlock } = useTextSelection(bodyRef, bubbleRef);

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
            background: '#2dd4bf',
            boxShadow: 'none',
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
