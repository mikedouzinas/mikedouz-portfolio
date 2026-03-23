'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { ArrowLeft, Music } from 'lucide-react';
import { getMusicMoments, getMomentsByMonth, formatMonth } from '@/data/spotify/loader';
import { useSpotifyEmbed } from '@/hooks/useSpotifyEmbed';
import { useAdminMode } from '@/hooks/useAdminMode';
import SpotifyCard from './SpotifyCard';

const INITIAL_MONTHS = 3;
const LOAD_MORE_MONTHS = 3;

interface SpotifyMobilePanelProps {
  open: boolean;
  onClose: () => void;
}

export default function SpotifyMobilePanel({ open, onClose }: SpotifyMobilePanelProps) {
  const adminMode = useAdminMode();
  const [visibleMonths, setVisibleMonths] = useState(INITIAL_MONTHS);
  const {
    currentMomentId,
    isPlaying,
    isLoading,
    progress,
    position,
    duration,
    togglePlay,
    stop,
    containerRef: embedContainerRef,
  } = useSpotifyEmbed();
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredMoments = useMemo(() => {
    const allMoments = getMusicMoments();
    if (adminMode) return allMoments;
    return allMoments.filter((m) => {
      if (m.maxState >= 2) return true;
      const playsPerWeek = m.weeksCount > 0 ? m.playCount / m.weeksCount : m.playCount;
      return playsPerWeek >= 5;
    });
  }, [adminMode]);

  const momentsByMonth = useMemo(
    () => getMomentsByMonth(filteredMoments),
    [filteredMoments],
  );

  const visibleData = useMemo(
    () => momentsByMonth.slice(0, visibleMonths),
    [momentsByMonth, visibleMonths],
  );

  const uniqueSongsCount = useMemo(
    () => new Set(filteredMoments.map((m) => m.trackUri)).size,
    [filteredMoments],
  );

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom && visibleMonths < momentsByMonth.length) {
      setVisibleMonths((prev) => Math.min(prev + LOAD_MORE_MONTHS, momentsByMonth.length));
    }
  }, [visibleMonths, momentsByMonth.length]);

  const handleClose = () => {
    stop();
    onClose();
    setVisibleMonths(INITIAL_MONTHS);
  };

  return (
    <>
      {/* Hidden Spotify embed container */}
      <div
        ref={embedContainerRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          width: 1,
          height: 1,
          overflow: 'hidden',
          opacity: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Fullscreen overlay */}
      <div
        className="fixed inset-0 z-[1001]"
        style={{
          pointerEvents: open ? 'auto' : 'none',
        }}
      >
        {/* Panel — full screen, fade + scale */}
        <div
          className="absolute inset-0 overflow-hidden flex flex-col"
          style={{
            background: 'rgba(16,42,46,0.97)',
            opacity: open ? 1 : 0,
            transform: open ? 'scale(1)' : 'scale(0.97)',
            transition: 'opacity 0.15s ease, transform 0.15s ease',
            willChange: 'opacity, transform',
          }}
        >
          {/* Header — safe area aware */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
            <button
              onClick={handleClose}
              className="p-1.5 -ml-1.5 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div className="flex items-center gap-2 flex-1">
              <Music className="w-4 h-4" style={{ color: '#1DB954' }} />
              <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#6ee7b7' }}>
                Mike&apos;s Music
              </span>
            </div>
            <span className="text-[10px] text-gray-500">
              {filteredMoments.length} moments · {uniqueSongsCount} songs
            </span>
          </div>

          {/* Scrollable content */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-5"
          >
            {visibleData.map(({ month, moments }) => (
              <div key={month}>
                <p
                  className="text-[10px] font-semibold tracking-widest uppercase mb-2 px-1 sticky top-0 py-1 z-10"
                  style={{ color: '#34d399', backgroundColor: 'rgba(16,42,46,0.97)' }}
                >
                  {formatMonth(month)}
                </p>
                <div className="space-y-2">
                  {moments.map((moment) => (
                    <SpotifyCard
                      key={moment.id}
                      moment={moment}
                      compact={false}
                      isPlaying={currentMomentId === moment.id && isPlaying}
                      isLoading={currentMomentId === moment.id && isLoading}
                      playProgress={currentMomentId === moment.id ? progress : 0}
                      playPosition={currentMomentId === moment.id ? position : 0}
                      playDuration={currentMomentId === moment.id ? duration : 0}
                      onPlayToggle={togglePlay}
                    />
                  ))}
                </div>
              </div>
            ))}

            {visibleMonths < momentsByMonth.length && (
              <p className="text-center text-[10px] text-gray-500 py-2">
                Scroll for more · {momentsByMonth.length - visibleMonths} months remaining
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
