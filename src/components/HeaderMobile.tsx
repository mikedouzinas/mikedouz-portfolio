"use client";
import React, { useRef, useCallback, useState } from 'react';
import { Info, Music } from 'lucide-react';
import { useDeepMode } from '@/components/DeepModeContext';
import SpotifyMobilePanel from '@/components/spotify/SpotifyMobilePanel';

interface HeaderMobileProps {
  onOpenAbout: () => void;
  onToggleDeepMode: () => void;
}

const LONG_PRESS_MS = 600;

export default function HeaderMobile({ onOpenAbout, onToggleDeepMode }: HeaderMobileProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);
  const { deepMode } = useDeepMode();
  const [musicOpen, setMusicOpen] = useState(false);

  const handleAskIrisClick = () => {
    window.dispatchEvent(new CustomEvent('mv-open-cmdk'));
  };

  const startPress = useCallback(() => {
    didLongPress.current = false;
    timerRef.current = setTimeout(() => {
      didLongPress.current = true;
      onToggleDeepMode();
    }, LONG_PRESS_MS);
  }, [onToggleDeepMode]);

  const endPress = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Prevent click from firing after a long press
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (didLongPress.current) {
      e.preventDefault();
    }
  }, []);

  return (
    <>
      <header
        className="md:hidden sticky top-0 z-[1000] bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50"
      >
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          {/* Left section: Name + Info icon + Subtitle */}
          <div className="flex items-start gap-2 flex-shrink-0">
            <div className="flex flex-col">
              {/* Name with info icon inline — long press toggles deep mode */}
              <div className="flex items-center gap-1.5">
                <h1
                  className="text-base font-semibold text-gray-800 dark:text-gray-200 select-none cursor-default"
                  onTouchStart={startPress}
                  onTouchEnd={endPress}
                  onTouchCancel={endPress}
                  onMouseDown={startPress}
                  onMouseUp={endPress}
                  onMouseLeave={endPress}
                  onClick={handleClick}
                >
                  Mike Veson
                </h1>

                <button
                  onClick={onOpenAbout}
                  aria-label="About & Links"
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200/60 dark:bg-gray-800/60 hover:bg-gray-300/80 dark:hover:bg-gray-700/80 transition-colors focus:outline-none"
                >
                  <Info className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                </button>
              </div>

              {!deepMode && (
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                Builder · Storyteller · Student
              </p>
            )}
            </div>
          </div>

          {/* Center: Music button — only in deep mode */}
          {deepMode && (
            <button
              onClick={() => setMusicOpen(true)}
              aria-label="Open music"
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-transform duration-150 active:scale-95"
              style={{
                background: 'rgba(16,42,46,0.75)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(52,211,153,0.25)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)',
              }}
            >
              <Music className="w-4 h-4" style={{ color: '#1DB954' }} />
            </button>
          )}

          {/* Right section: Ask Iris button */}
          <button
            onClick={handleAskIrisClick}
            aria-label="Ask Iris"
            className="inline-flex items-center justify-center px-4 py-1 bg-gradient-to-r from-blue-600 via-green-600 to-blue-600 text-white text-[13px] font-semibold rounded-lg shadow-sm transition-all duration-200 hover:scale-105 focus-visible:outline-none flex-shrink-0"
          >
            Ask Iris
          </button>
        </div>
      </header>

      {/* Mobile music panel */}
      {deepMode && (
        <SpotifyMobilePanel
          open={musicOpen}
          onClose={() => setMusicOpen(false)}
        />
      )}
    </>
  );
}
