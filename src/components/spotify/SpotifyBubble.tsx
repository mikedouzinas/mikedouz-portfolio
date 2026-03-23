'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Music, Maximize2, Minimize2 } from 'lucide-react';
import { getMusicMoments, getMomentsByMonth, formatMonth } from '@/data/spotify/loader';
import { useAudioPreview } from '@/hooks/useAudioPreview';
import { useAdminMode } from '@/hooks/useAdminMode';
import { useDeepMode } from '@/components/DeepModeContext';
import SpotifyCard from './SpotifyCard';

const INITIAL_MONTHS = 3;
const LOAD_MORE_MONTHS = 3;

export default function SpotifyBubble() {
  const { deepMode } = useDeepMode();
  const adminMode = useAdminMode();
  const [expanded, setExpanded] = useState(false);
  const [visibleMonths, setVisibleMonths] = useState(INITIAL_MONTHS);
  const { currentMomentId, isPlaying, progress, togglePlay, stop } = useAudioPreview();
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? Infinity;
      setCompact(height < 140);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
    [filteredMoments]
  );

  // Only render a subset of months for performance
  const visibleData = useMemo(
    () => momentsByMonth.slice(0, visibleMonths),
    [momentsByMonth, visibleMonths]
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
  const remainingCount = filteredMoments.length - recentMoments.length;

  const uniqueSongsCount = useMemo(
    () => new Set(filteredMoments.map((m) => m.trackUri)).size,
    [filteredMoments]
  );

  // Reset visible months when collapsing
  useEffect(() => {
    if (!expanded) setVisibleMonths(INITIAL_MONTHS);
  }, [expanded]);

  // Load more months when scrolling near bottom
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

  const handleToggleExpand = () => {
    if (expanded) stop();
    setExpanded((prev) => !prev);
  };

  return (
    <div ref={containerRef} className="hidden md:block text-left" style={{ marginLeft: 'calc(50% - 96px)', position: 'relative' }}>
      {/* Collapsed view — always in DOM to hold position */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(15,31,26,0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(29,185,84,0.2)',
          boxShadow: '0 8px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
          marginRight: '1rem',
          visibility: expanded ? 'hidden' : 'visible',
        }}
      >
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Music className="w-3.5 h-3.5" style={{ color: '#1DB954' }} />
            <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: '#86efac' }}>
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

        {!compact && (
          <div className="px-3 pb-3 space-y-1">
            {recentMoments.map((moment) => (
              <SpotifyCard key={moment.id} moment={moment} compact />
            ))}
            {remainingCount > 0 && (
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
                  {remainingCount} more
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Expanded view */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 bottom-0 z-50 rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(15,31,26,0.92)',
              backdropFilter: 'blur(30px)',
              WebkitBackdropFilter: 'blur(30px)',
              border: '1px solid rgba(29,185,84,0.2)',
              boxShadow: '0 8px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
              width: 'min(420px, calc(100vw / 3 - 1rem))',
            }}
          >
            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Music className="w-3.5 h-3.5" style={{ color: '#1DB954' }} />
                <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: '#86efac' }}>
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
                  <p
                    className="text-[10px] font-semibold tracking-widest uppercase mb-2 px-1 sticky top-0 py-1 z-10"
                    style={{ color: '#1DB954', backgroundColor: 'rgba(15,31,26,0.95)' }}
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
                        playProgress={currentMomentId === moment.id ? progress : 0}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
