'use client';

import { useRef, useEffect } from 'react';
import { useTextSelection } from '../hooks/useTextSelection';
import BlogIrisBubble from './BlogIrisBubble';

interface PostBodyWithIrisProps {
  slug: string;
  children: React.ReactNode;
}

export default function PostBodyWithIris({ slug, children }: PostBodyWithIrisProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const { selection, clearSelection, setConversationActive } = useTextSelection(bodyRef);

  // Once a selection triggers the bubble, mark conversation active
  // so that clicking inside the bubble (which clears browser selection) doesn't dismiss it
  useEffect(() => {
    if (selection) {
      setConversationActive(true);
    }
  }, [selection, setConversationActive]);

  return (
    <div ref={bodyRef} className="relative" data-post-body>
      {children}
      {selection && (
        <BlogIrisBubble
          slug={slug}
          selection={selection}
          onClose={() => {
            setConversationActive(false);
            clearSelection();
          }}
        />
      )}
    </div>
  );
}
