// src/app/the-web/[slug]/components/ListenCard.tsx
'use client';

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
  const progress = duration > 0 ? currentTime / duration : 0;
  const remaining = Math.max(0, duration - currentTime);

  function handlePlayPause() {
    if (isPlaying) pause();
    else play();
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    seek(fraction * duration);
  }

  const subtitleText = (() => {
    if (status === 'error') return player.errorMessage ?? "Couldn't load audio";
    if (status === 'generating') return 'Generating audio…';
    if (status === 'loading') return 'Loading…';
    if (isReady && duration > 0) {
      return `${formatTime(currentTime)} · ${formatTime(remaining)} remaining · Mike Veson`;
    }
    return `${readingTime} min · Mike Veson`;
  })();

  return (
    <div className="rounded-xl bg-gradient-to-br from-teal-500/[0.08] to-teal-400/[0.04] border border-teal-500/20 p-4 mb-8">
      {/* Controls row */}
      <div className="flex items-center gap-3 mb-3">
        {/* Play / Pause button */}
        <button
          onClick={handlePlayPause}
          disabled={isLoading}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="w-10 h-10 rounded-full bg-teal-500 text-black flex items-center justify-center flex-shrink-0 hover:bg-teal-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : isPlaying ? (
            <Pause size={16} fill="currentColor" />
          ) : (
            <Play size={16} fill="currentColor" className="translate-x-px" />
          )}
        </button>

        {/* Title + subtitle */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-200">Listen to this post</div>
          <div className="text-xs text-gray-500 mt-0.5 truncate">{subtitleText}</div>
        </div>

        {/* Speed toggle — only when audio is ready */}
        {isReady && (
          <button
            onClick={cycleSpeed}
            className="text-xs text-gray-500 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full px-2.5 py-1 transition-colors flex-shrink-0"
          >
            {speed}×
          </button>
        )}
      </div>

      {/* Progress bar — only when duration is known */}
      {duration > 0 && (
        <>
          <div
            role="slider"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={currentTime}
            onClick={handleSeek}
            className="h-1 bg-gray-700 rounded-full cursor-pointer overflow-hidden"
          >
            <div
              className="h-full bg-teal-500 rounded-full transition-none"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </>
      )}
    </div>
  );
}
