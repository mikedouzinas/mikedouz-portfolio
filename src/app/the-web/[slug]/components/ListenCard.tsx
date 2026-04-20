// src/app/the-web/[slug]/components/ListenCard.tsx
'use client';

import { useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';
import type { UseAudioPlayerReturn } from '@/hooks/useAudioPlayer';

interface ListenCardProps {
  player: UseAudioPlayerReturn;
  readingTime: number;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ListenCard({ player, readingTime }: ListenCardProps) {
  const { status, currentTime, duration, speed, play, pause, seek, cycleSpeed } = player;

  const isLoading = status === 'loading' || status === 'generating';
  const isPlaying = status === 'playing';
  const isReady = status !== 'idle' && status !== 'error';
  const canSeek = duration > 0;
  const progress = canSeek ? Math.min(currentTime / duration, 1) : 0;
  const remainingSec = Math.max(0, Math.floor(duration) - Math.floor(currentTime));

  // Drag state — refs avoid stale closures in window listeners
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const durationRef = useRef(duration);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  const getSeekTime = useCallback((clientX: number): number | null => {
    if (!trackRef.current || !durationRef.current) return null;
    const rect = trackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * durationRef.current;
  }, []);

  // Attach window-level move/up listeners once — most reliable across browsers/touch
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isDragging.current) return;
      const t = getSeekTime(e.clientX);
      if (t !== null) seek(t);
    }
    function onMouseUp() { isDragging.current = false; }
    function onTouchMove(e: TouchEvent) {
      if (!isDragging.current) return;
      e.preventDefault();
      const t = getSeekTime(e.touches[0].clientX);
      if (t !== null) seek(t);
    }
    function onTouchEnd() { isDragging.current = false; }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [seek, getSeekTime]);

  const subtitleText = (() => {
    if (status === 'error') return player.errorMessage ?? "Couldn't load audio";
    if (status === 'generating') return 'Generating audio… this may take a minute.';
    if (status === 'loading') return 'Loading audio…';
    if (isReady && duration > 0) return `${formatTime(remainingSec)} remaining · Mike Veson`;
    return `${readingTime} min · Mike Veson`;
  })();

  return (
    <div className="rounded-xl bg-gradient-to-br from-teal-500/[0.08] to-teal-400/[0.04] border border-teal-500/20 p-3 mb-5">
      <div className="flex items-center gap-3 mb-2.5">
        <button
          onClick={isPlaying ? pause : play}
          disabled={isLoading}
          aria-label={isLoading ? 'Loading' : isPlaying ? 'Pause' : 'Play'}
          className="w-10 h-10 rounded-full bg-[#2dd4bf]/20 hover:bg-[#2dd4bf]/35 flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin text-[#2dd4bf]" />
          ) : isPlaying ? (
            <Pause size={16} fill="#2dd4bf" className="text-[#2dd4bf]" />
          ) : (
            <Play size={16} fill="#2dd4bf" className="text-[#2dd4bf] translate-x-px" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-200">Listen to this post</div>
          <div className="text-xs text-gray-500 mt-0.5 truncate">{subtitleText}</div>
        </div>

        {isReady && (
          <button
            onClick={cycleSpeed}
            className="text-xs text-gray-500 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full px-2.5 py-1 transition-colors flex-shrink-0"
          >
            {speed}×
          </button>
        )}
      </div>

      {status !== 'error' && (
        <>
          {/* Scrubber track — py-2 gives a large touch target without visual bulk */}
          <div
            ref={trackRef}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={duration || 0}
            aria-valuenow={currentTime}
            aria-label="Playback position"
            tabIndex={canSeek ? 0 : -1}
            onMouseDown={(e) => {
              if (!canSeek) return;
              isDragging.current = true;
              const t = getSeekTime(e.clientX);
              if (t !== null) seek(t);
            }}
            onTouchStart={(e) => {
              if (!canSeek) return;
              isDragging.current = true;
              const t = getSeekTime(e.touches[0].clientX);
              if (t !== null) seek(t);
            }}
            onKeyDown={(e) => {
              if (!canSeek) return;
              if (e.key === 'ArrowRight') seek(Math.min(currentTime + 5, duration));
              else if (e.key === 'ArrowLeft') seek(Math.max(currentTime - 5, 0));
            }}
            className={`py-2 ${canSeek ? 'cursor-pointer' : 'cursor-default'}`}
            style={{ touchAction: 'none' }}
          >
            <div className="h-1 bg-gray-700 rounded-full relative">
              <div
                className="absolute left-0 top-0 h-full bg-teal-500 rounded-full pointer-events-none"
                style={{ width: `${progress * 100}%` }}
              />
              {canSeek && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-teal-400 shadow pointer-events-none"
                  style={{ left: `${progress * 100}%` }}
                />
              )}
            </div>
          </div>

          {canSeek && (
            <div className="flex justify-between text-xs text-gray-600 -mt-1">
              <span>{formatTime(Math.floor(currentTime))}</span>
              <span>{formatTime(Math.round(duration))}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
