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
  const { selection, clearSelection, setConversationActive } = useTextSelection(bodyRef);

  return (
    <div ref={bodyRef} className="relative" data-post-body>
      {children}
      {selection && (
        <BlogIrisBubble
          slug={slug}
          selection={selection}
          onClose={() => {
            clearSelection();
            setConversationActive(false);
          }}
        />
      )}
    </div>
  );
}
