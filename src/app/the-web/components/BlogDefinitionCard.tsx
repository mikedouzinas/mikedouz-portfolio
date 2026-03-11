'use client';

import React from 'react';
import { HoverTrigger } from '@/components/hover-cards';
import type { DefinitionCardData } from '@/data/hover-cards';

interface BlogDefinitionCardProps {
  term: string;
  definition: string;
  source?: string;
  greek?: string;
  children: React.ReactNode;
}

export default function BlogDefinitionCard({
  term,
  definition,
  source,
  greek,
  children,
}: BlogDefinitionCardProps) {
  const data: DefinitionCardData = {
    type: 'definition',
    id: `blog-def-${term.toLowerCase().replace(/\s+/g, '-')}`,
    term,
    definition,
    source,
    greek,
  };

  return (
    <HoverTrigger inlineData={data} variant="blog">
      <span className="text-purple-300/90 decoration-dotted decoration-purple-500/30 underline underline-offset-4 hover:text-purple-200 hover:decoration-purple-400/50 cursor-help transition-colors duration-200">
        {children}
      </span>
    </HoverTrigger>
  );
}
