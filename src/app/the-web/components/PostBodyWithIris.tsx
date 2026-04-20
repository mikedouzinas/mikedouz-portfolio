'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { useTextSelection } from '../hooks/useTextSelection';
import BlogIrisBubble from './BlogIrisBubble';

const SUMMARIZE_PROMPT =
  "Walk me through this post — what's the central argument, the key ideas section by section, and the one or two things genuinely worth sitting with.";

interface PostBodyWithIrisProps {
  slug: string;
  postTitle?: string;
  children: React.ReactNode;
}

export default function PostBodyWithIris({ slug, postTitle, children }: PostBodyWithIrisProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const { selection, clearSelection, lock, unlock } = useTextSelection(bodyRef, bubbleRef);

  const [highlightPos, setHighlightPos] = useState<{ top: number; height: number } | null>(null);
  const [summarizeSelection, setSummarizeSelection] = useState<{ text: string; rect: DOMRect } | null>(null);

  // Listen for summarize trigger from SummarizeButton
  useEffect(() => {
    const handle = () => {
      setSummarizeSelection({ text: postTitle || slug, rect: new DOMRect() });
      setHighlightPos(null);
    };
    window.addEventListener('blog-iris-summarize', handle);
    return () => window.removeEventListener('blog-iris-summarize', handle);
  }, [postTitle, slug]);

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

  const handleSummarizeClose = useCallback(() => {
    setSummarizeSelection(null);
  }, []);

  const activeSelection = summarizeSelection ?? selection;
  const showLine = !summarizeSelection && (selection?.containerRelative || highlightPos);

  return (
    <div ref={bodyRef} className="relative" data-post-body>
      {showLine && (
        <div
          className="absolute pointer-events-none rounded-sm transition-opacity duration-200"
          style={{
            left: -8,
            top: showLine.top,
            height: showLine.height,
            width: 3,
            background: '#2dd4bf',
          }}
        />
      )}
      {children}
      {activeSelection && (
        <BlogIrisBubble
          ref={bubbleRef}
          slug={slug}
          postTitle={postTitle}
          selection={activeSelection}
          onClose={summarizeSelection ? handleSummarizeClose : handleClose}
          onLock={summarizeSelection ? () => {} : handleLock}
          initialMessage={summarizeSelection ? SUMMARIZE_PROMPT : undefined}
        />
      )}
    </div>
  );
}
