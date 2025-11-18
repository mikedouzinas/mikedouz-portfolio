"use client";

import React from 'react';
import { Mail, ArrowRight } from 'lucide-react';
import ContainedMouseGlow from '../ContainedMouseGlow';

interface ContactCtaProps {
  /**
   * Optional draft suggestion text from Iris
   */
  draft?: string;
  /**
   * Callback when user clicks to open composer
   */
  onClick: () => void;
}

/**
 * ContactCta - Small card with draft preview and "Ask Mike" button
 * Used when Iris suggests contacting Mike but doesn't require immediate action
 * (reason="more_detail" with no open="auto" attribute)
 * 
 * Professional UX: Provides context and a single clear call-to-action
 */
export default function ContactCta({ draft, onClick }: ContactCtaProps) {
  return (
    <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-blue-600/20 via-blue-500/15 to-blue-700/20 border border-white/10 backdrop-blur-sm">
      <div className="flex items-start gap-3">
        {/* Left icon */}
        <div className="shrink-0 rounded-lg bg-white/5 p-2">
          <Mail className="w-4 h-4 text-sky-400" />
        </div>
        
        {/* Middle content */}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-white/90 font-medium mb-1">
            Need to ask Mike directly?
          </div>
          {draft && (
                      <div className="text-xs text-white/60 mb-2">
            &ldquo;{draft}&rdquo;
          </div>
          )}
          <button
            onClick={onClick}
            className="relative inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-white text-sm font-medium transition-all duration-200 transform hover:scale-[1.02] overflow-hidden"
            style={{
              background: 'linear-gradient(90deg, #6B4EFF 0%, #00A8FF 100%)',
            }}
          >
            <ContainedMouseGlow color="147, 197, 253" intensity={0.3} size={150} />
            Message Mike
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
