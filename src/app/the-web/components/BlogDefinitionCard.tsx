'use client';

import React from 'react';
import { HoverTrigger } from '@/components/hover-cards';
import type { DefinitionCardData, DefinitionKind } from '@/data/hover-cards';

interface BlogDefinitionCardProps {
  term: string;
  definition: string;
  source?: string;
  greek?: string;
  link?: string;
  kind?: string;
  notitle?: string;
  children: React.ReactNode;
}

// Kind-based trigger styling
const TRIGGER_STYLES: Record<string, string> = {
  clarification:
    'text-teal-300/90 decoration-dotted decoration-teal-500/30 underline underline-offset-4 hover:text-teal-200 hover:decoration-teal-400/50 cursor-help',
  reference:
    'text-blue-300/90 decoration-dotted decoration-blue-500/30 underline underline-offset-4 hover:text-blue-200 hover:decoration-blue-400/50 cursor-help',
  aside:
    'text-amber-300/80 decoration-dotted decoration-amber-500/25 underline underline-offset-4 hover:text-amber-200 hover:decoration-amber-400/40 cursor-help italic',
};

export default function BlogDefinitionCard({
  term,
  definition,
  source,
  greek,
  link,
  kind = 'clarification',
  notitle,
  children,
}: BlogDefinitionCardProps) {
  const validKind = (['clarification', 'reference', 'aside'].includes(kind)
    ? kind
    : 'clarification') as DefinitionKind;

  const data: DefinitionCardData = {
    type: 'definition',
    id: `blog-def-${term.toLowerCase().replace(/\s+/g, '-')}`,
    term,
    definition,
    source,
    greek,
    link,
    kind: validKind,
    notitle: notitle === 'true',
  };

  const triggerClass = TRIGGER_STYLES[validKind] || TRIGGER_STYLES.clarification;

  return (
    <HoverTrigger inlineData={data} variant="blog">
      <span className={`${triggerClass} transition-colors duration-200`}>
        {children}
      </span>
    </HoverTrigger>
  );
}
