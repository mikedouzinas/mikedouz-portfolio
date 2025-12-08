"use client";

import React from 'react';
import { Sparkles } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/gtag';

interface AskIrisButtonProps {
  item: {
    id: string;
    title: string;
  };
  type: 'project' | 'blog' | 'experience';
  className?: string;
}

export default function AskIrisButton({ item, type, className = '' }: AskIrisButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Track Google Analytics event when "See Details" button is clicked
    // This helps understand user engagement with the Iris AI feature across different content types
    trackEvent('see_details_click', {
      item_type: type,
      item_id: item.id,
      item_title: item.title
    });

    // Construct query and filters
    // For specific items, we want "Tell me about [Title]"
    // And we pass exact ID match filter to ensure correct retrieval
    const query = `Tell the full detailed story about ${item.title}.`;
    const filters = {
      title_match: item.id
    };
    const intent = 'specific_item';

    window.dispatchEvent(new CustomEvent('mv-open-cmdk', {
      detail: {
        query,
        filters,
        intent
      }
    }));
  };

  return (
    <button
      onClick={handleClick}
      className={`
        flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 
        bg-gradient-to-br from-blue-600 via-emerald-500 to-blue-600
        hover:scale-105 
        text-white 
        text-xs font-medium 
        rounded-lg shadow-sm border border-white/20
        transition-all duration-200 ease-out hover:shadow-md
        hover:from-blue-500 hover:via-emerald-400 hover:to-blue-500
        backdrop-blur-xl z-20
        opacity-75 hover:opacity-100
        ${className}
      `}
      aria-label={`See details for ${item.title}`}
    >
      <Sparkles className="w-3 h-3" />
      <span>See Details</span>
    </button>
  );
}

