'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
// framer-motion removed — expanded panel uses CSS transitions for instant open
import { Music, Maximize2, Minimize2 } from 'lucide-react';
import { getMusicMoments, getMomentsByMonth, formatMonth } from '@/data/spotify/loader';
import { useSpotifyEmbed } from '@/hooks/useSpotifyEmbed';
import { useAdminMode } from '@/hooks/useAdminMode';
import { useDeepMode } from '@/components/DeepModeContext';
import ContainedMouseGlow from '@/components/ContainedMouseGlow';
import SpotifyCard from './SpotifyCard';

const INITIAL_MONTHS = 3;
const LOAD_MORE_MONTHS = 3;

interface SpotifyBubbleProps {
  parentSelector?: string;
}

export default function SpotifyBubble({ parentSelector }: SpotifyBubbleProps) {
  const { deepMode } = useDeepMode();
  const adminMode = useAdminMode();
  const [expanded, setExpanded] = useState(false);
  const [visibleMonths, setVisibleMonths] = useState(INITIAL_MONTHS);
  const {
    currentMomentId,
    isPlaying,
    progress,
    position,
    duration,
    isLoading,
    togglePlay,
    stop,
    containerRef: embedContainerRef,
  } = useSpotifyEmbed();
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleSongs, setVisibleSongs] = useState(3);

  // Observe the PARENT wrapper's height for progressive song collapse
  useEffect(() => {
    const el = parentSelector
      ? document.querySelector(parentSelector)
      : containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? Infinity;
      if (h >= 200) setVisibleSongs(3);
      else if (h >= 160) setVisibleSongs(2);
      else if (h >= 120) setVisibleSongs(1);
      else setVisibleSongs(0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [parentSelector]);

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

  const recentMoments = useMemo(() => {
    const flat: typeof filteredMoments = [];
    for (const { moments } of momentsByMonth) {
      for (const m of moments) {
        flat.push(m);
        if (flat.length >= 3) return flat;
      }
    }
    return flat;
  }, [momentsByMonth]);

  const uniqueSongsCount = useMemo(
    () => new Set(filteredMoments.map((m) => m.trackUri)).size,
    [filteredMoments],
  );

  useEffect(() => {
    if (!expanded) setVisibleMonths(INITIAL_MONTHS);
  }, [expanded]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (nearBottom && visibleMonths < momentsByMonth.length) {
      setVisibleMonths((prev) => Math.min(prev + LOAD_MORE_MONTHS, momentsByMonth.length));
    }
  }, [visibleMonths, momentsByMonth.length]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const atTop = scrollTop <= 0 && e.deltaY < 0;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 1 && e.deltaY > 0;
    if (!atTop && !atBottom) {
      e.stopPropagation();
    }
  }, []);

  if (!deepMode) return null;

  // Toggle expand without stopping playback
  const handleToggleExpand = () => {
    setExpanded((prev) => !prev);
  };

  return (
    <div ref={containerRef} className="hidden md:block text-left" style={{ marginLeft: 'calc(50% - 96px)' }}>
      {/* Hidden Spotify embed container */}
      <div
        ref={embedContainerRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          opacity: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Collapsed view */}
      <div
        className="rounded-2xl overflow-hidden relative transition-transform duration-200 hover:scale-[1.02] cursor-pointer"
        data-has-contained-glow="true"
        style={{
          background: 'rgba(16,42,46,0.75)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(52,211,153,0.25)',
          boxShadow: '0 8px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
          marginRight: '1rem',
          visibility: expanded ? 'hidden' : 'visible',
        }}
      >
        <ContainedMouseGlow color="52, 211, 153" intensity={0.25} />

        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Music className="w-3.5 h-3.5" style={{ color: '#1DB954' }} />
            <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: '#6ee7b7' }}>
              Mike&apos;s Music
            </span>
          </div>
          <button
            onClick={handleToggleExpand}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white/10 transition-colors"
            aria-label="Expand music moments"
          >
            <Maximize2 className="w-3 h-3 text-gray-400" />
            <span className="text-[10px] text-gray-400">expand</span>
          </button>
        </div>

        {visibleSongs > 0 && (
          <div className="px-3 pb-3 space-y-0">
            {recentMoments.slice(0, visibleSongs).map((moment) => (
              <SpotifyCard
                key={moment.id}
                moment={moment}
                compact
                isPlaying={currentMomentId === moment.id && isPlaying}
                isLoading={currentMomentId === moment.id && isLoading}
                playProgress={currentMomentId === moment.id ? progress : 0}
                playPosition={currentMomentId === moment.id ? position : 0}
                playDuration={currentMomentId === moment.id ? duration : 0}
                onPlayToggle={togglePlay}
              />
            ))}
            {filteredMoments.length - visibleSongs > 0 && (
              <button
                onClick={handleToggleExpand}
                className="flex items-center gap-2 pt-1 px-1 hover:opacity-80 transition-opacity"
              >
                <div className="flex gap-1">
                  {[1, 0.6, 0.3].map((opacity, i) => (
                    <div
                      key={i}
                      className="w-1 h-1 rounded-full"
                      style={{ backgroundColor: '#1DB954', opacity }}
                    />
                  ))}
                </div>
                <span className="text-[10px] text-gray-500">
                  {filteredMoments.length - visibleSongs} more
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Expanded view — always in DOM, toggled via opacity/pointer-events for instant open */}
      <div
        data-has-contained-glow="true"
        className="fixed z-50 rounded-2xl overflow-hidden transition-all duration-[120ms]"
        style={{
          background: 'rgb(13,34,37)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(52,211,153,0.25)',
          boxShadow: expanded
            ? '0 12px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)'
            : 'none',
          width: 'min(420px, calc(100vw / 3 - 1rem))',
          bottom: '80px',
          left: '32px',
          opacity: expanded ? 1 : 0,
          pointerEvents: expanded ? 'auto' : 'none',
          transform: expanded ? 'scale(1) translateY(0)' : 'scale(0.93) translateY(6px)',
          willChange: 'transform, opacity',
        }}
      >
        <ContainedMouseGlow color="52, 211, 153" intensity={0.25} />
            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Music className="w-3.5 h-3.5" style={{ color: '#1DB954' }} />
                <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: '#6ee7b7' }}>
                  Mike&apos;s Music
                </span>
              </div>
              <button
                onClick={handleToggleExpand}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white/10 transition-colors"
                aria-label="Collapse music moments"
              >
                <Minimize2 className="w-3 h-3 text-gray-400" />
                <span className="text-[10px] text-gray-400">close</span>
              </button>
            </div>

            <div
              ref={scrollRef}
              onWheel={handleWheel}
              onScroll={handleScroll}
              className="overflow-y-auto px-3 pb-3 space-y-4"
              style={{ maxHeight: 400 }}
            >
              {visibleData.map(({ month, moments }) => (
                <div key={month}>
                  <div className="sticky top-0 z-10 mb-2 py-1 px-1">
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-widest uppercase"
                      style={{
                        color: '#34d399',
                        backgroundColor: 'rgba(13,34,37,0.85)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        border: '1px solid rgba(52,211,153,0.15)',
                      }}
                    >
                      {formatMonth(month)}
                    </span>
                  </div>
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

            <div className="px-3 py-2 border-t border-white/[0.06] flex items-center gap-3">
              <span className="text-[10px] text-gray-500">
                {filteredMoments.length} moments
              </span>
              <span className="text-gray-700">·</span>
              <span className="text-[10px] text-gray-500">
                {uniqueSongsCount} songs
              </span>
            </div>
      </div>
    </div>
  );
}
