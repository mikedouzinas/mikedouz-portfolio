'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, ChevronDown } from 'lucide-react';
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

  // Filter moments: public shows maxState >= 2, admin shows all
  const filteredMoments = useMemo(() => {
    return adminMode
      ? musicMoments
      : musicMoments.filter((m) => m.maxState >= 2);
  }, [adminMode]);

  const recentMoments = useMemo(() => filteredMoments.slice(0, 3), [filteredMoments]);
  const remainingCount = filteredMoments.length - 3;

  const momentsByMonth = useMemo(
    () => getMomentsByMonth(filteredMoments),
    [filteredMoments]
  );

  const uniqueSongsCount = useMemo(
    () => new Set(filteredMoments.map((m) => m.trackUri)).size,
    [filteredMoments]
  );

  // Don't render if deep mode is off
  if (!deepMode) return null;

  const handleToggleExpand = () => {
    if (expanded) {
      stop();
    }
    setExpanded((prev) => !prev);
  };

  return (
    <div className="hidden md:block fixed bottom-6 left-6 z-40">
      <motion.div
        layout
        style={{
          width: expanded ? 420 : 260,
          backgroundColor: '#1a1a2e',
        }}
        className="rounded-2xl shadow-2xl shadow-black/30 overflow-hidden"
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {/* Header */}
        <button
          onClick={handleToggleExpand}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse music moments' : 'Expand music moments'}
        >
          <div className="flex items-center gap-2">
            <Music className="w-3.5 h-3.5" style={{ color: '#1DB954' }} />
            <span
              className="text-[11px] font-semibold tracking-widest uppercase"
              style={{ color: '#9ca3af' }}
            >
              Mike&apos;s Music
            </span>
          </div>
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
          </motion.div>
        </button>

        <AnimatePresence mode="wait">
          {!expanded ? (
            /* Collapsed state */
            <motion.div
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="px-3 pb-3 space-y-1.5"
            >
              {recentMoments.map((moment) => (
                <SpotifyCard key={moment.id} moment={moment} compact />
              ))}

              {filteredMoments.length > 0 && (
                <div className="flex items-center gap-2 pt-1 px-1">
                  {/* Dot indicators */}
                  <div className="flex gap-1">
                    {recentMoments.map((_, i) => (
                      <div
                        key={i}
                        className="w-1 h-1 rounded-full"
                        style={{ backgroundColor: '#1DB954' }}
                      />
                    ))}
                    {remainingCount > 0 && (
                      <div className="w-1 h-1 rounded-full bg-white/20" />
                    )}
                  </div>
                  {remainingCount > 0 && (
                    <span className="text-[10px] text-gray-500">
                      {remainingCount} more moment{remainingCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            /* Expanded state */
            <motion.div
              key="expanded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="overflow-y-auto px-3 pb-3 space-y-4" style={{ maxHeight: 400 }}>
                {momentsByMonth.map(({ month, moments }) => (
                  <div key={month}>
                    {/* Month label */}
                    <p
                      className="text-[10px] font-semibold tracking-widest uppercase mb-2 px-1"
                      style={{ color: '#1DB954' }}
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

              {/* Footer stats */}
              <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center gap-3">
                <span className="text-[10px] text-gray-500">
                  {filteredMoments.length} moment{filteredMoments.length !== 1 ? 's' : ''}
                </span>
                <span className="text-gray-700">·</span>
                <span className="text-[10px] text-gray-500">
                  {uniqueSongsCount} unique song{uniqueSongsCount !== 1 ? 's' : ''}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
