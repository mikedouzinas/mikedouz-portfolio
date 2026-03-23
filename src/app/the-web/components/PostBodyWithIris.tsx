'use client';

import { useRef } from 'react';
import { useTextSelection } from '../hooks/useTextSelection';
import BlogIrisBubble from './BlogIrisBubble';

interface PostBodyWithIrisProps {
  slug: string;
  children: React.ReactNode;
}

export default function PostBodyWithIris({ slug, children }: PostBodyWithIrisProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const { selection, clearSelection, lock, unlock } = useTextSelection(bodyRef, bubbleRef);

  return (
    <div ref={bodyRef} className="relative" data-post-body>
      {children}
      {selection && (
        <BlogIrisBubble
          ref={bubbleRef}
          slug={slug}
          selection={selection}
          onClose={() => {
            unlock();
            clearSelection();
          }}
          onLock={lock}
        />
      )}
    </div>
  );
}
