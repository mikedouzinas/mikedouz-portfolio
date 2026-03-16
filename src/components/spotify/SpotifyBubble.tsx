'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Maximize2, Minimize2 } from 'lucide-react';
import { musicMoments, getMomentsByMonth, formatMonth } from '@/data/spotify/loader';
import { useAudioPreview } from '@/hooks/useAudioPreview';
import { useAdminMode } from '@/hooks/useAdminMode';
import { useDeepMode } from '@/components/DeepModeContext';
import SpotifyCard from './SpotifyCard';

export default function SpotifyBubble() {
  const { deepMode } = useDeepMode();
  const adminMode = useAdminMode();
  const [expanded, setExpanded] = useState(false);
  const { currentMomentId, isPlaying, progress, togglePlay, stop } = useAudioPreview();
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredMoments = useMemo(() => {
    return adminMode
      ? musicMoments
      : musicMoments.filter((m) => m.maxState >= 2);
  }, [adminMode]);

  const momentsByMonth = useMemo(
    () => getMomentsByMonth(filteredMoments),
    [filteredMoments]
  );

  // Collapsed shows top 3 in the same order as expanded (first month's top items, then next month)
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
    <div className="hidden md:block mb-4 text-left" style={{ marginLeft: 'calc(50% - 96px)', position: 'relative' }}>
      {/* Collapsed view — always in DOM to hold position */}
      <div
        className="rounded-2xl shadow-lg shadow-black/20 overflow-hidden"
        style={{
          backgroundColor: '#1a1a2e',
          marginRight: '1rem',
          visibility: expanded ? 'hidden' : 'visible',
        }}
      >
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Music className="w-3.5 h-3.5" style={{ color: '#1DB954' }} />
            <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: '#9ca3af' }}>
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
      </div>

      {/* Expanded view — absolute, anchored to bottom-left of the collapsed box */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 bottom-0 z-50 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden"
            style={{
              backgroundColor: '#1a1a2e',
              width: 'min(420px, calc(100vw / 3 - 1rem))',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Music className="w-3.5 h-3.5" style={{ color: '#1DB954' }} />
                <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: '#9ca3af' }}>
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
              className="overflow-y-auto px-3 pb-3 space-y-4"
              style={{ maxHeight: 400 }}
            >
              {momentsByMonth.map(({ month, moments }) => (
                <div key={month}>
                  <p
                    className="text-[10px] font-semibold tracking-widest uppercase mb-2 px-1 sticky top-0 py-1 z-10"
                    style={{ color: '#1DB954', backgroundColor: '#1a1a2e' }}
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
            </div>

            {/* Footer */}
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
