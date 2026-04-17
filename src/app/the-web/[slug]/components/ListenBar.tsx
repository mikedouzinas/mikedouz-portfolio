// src/app/the-web/[slug]/components/ListenBar.tsx
'use client';

import { Play, Pause, ArrowDown, Loader2 } from 'lucide-react';
import type { UseAudioPlayerReturn } from '@/hooks/useAudioPlayer';

interface ListenBarProps {
  player: UseAudioPlayerReturn;
  postTitle: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ListenBar({ player, postTitle }: ListenBarProps) {
  const { status, currentTime, duration, speed, play, pause, cycleSpeed, jumpToActiveParagraph } = player;

  const isPlaying = status === 'playing';
  const isLoading = status === 'loading' || status === 'generating';
  const isVisible = status !== 'idle' && status !== 'error';
  const progress = duration > 0 ? currentTime / duration : 0;

  // Floor elapsed once — remaining is derived from the same integer so both
  // tick at exactly the same moment and never appear out of sync.
  const elapsedSec = Math.floor(currentTime);
  const remainingSec = Math.max(0, Math.round(duration) - elapsedSec);

  if (!isVisible) return null;

  const PlayPauseIcon = ({ size }: { size: number }) => {
    if (isLoading) return <Loader2 size={size} className="animate-spin text-[#2dd4bf]" />;
    if (isPlaying) return <Pause size={size} fill="#2dd4bf" className="text-[#2dd4bf]" />;
    return <Play size={size} fill="#2dd4bf" className="text-[#2dd4bf] translate-x-px" />;
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-teal-500/10">
      {/* Thin teal progress strip */}
      <div className="h-0.5 bg-gray-800">
        <div
          className="h-full bg-[#2dd4bf] transition-none"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Controls */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {/* Desktop: single row */}
        <div className="hidden sm:flex items-center gap-3 py-2">
          <button
            onClick={isPlaying ? pause : play}
            disabled={isLoading}
            aria-label={isLoading ? 'Loading' : isPlaying ? 'Pause' : 'Play'}
            className="w-7 h-7 rounded-full bg-[#2dd4bf]/20 hover:bg-[#2dd4bf]/35 flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlayPauseIcon size={12} />
          </button>

          <span className="text-xs text-gray-300 truncate flex-1 min-w-0">{postTitle}</span>

          {duration > 0 && (
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {formatTime(elapsedSec)} · {formatTime(remainingSec)} left
            </span>
          )}

          <button
            onClick={cycleSpeed}
            aria-label={`Playback speed: ${speed}×. Click to change.`}
            className="text-xs text-gray-500 bg-gray-800 border border-gray-700 rounded-full px-2 py-0.5 hover:bg-gray-700 transition-colors flex-shrink-0"
          >
            {speed}×
          </button>

          <button
            onClick={jumpToActiveParagraph}
            aria-label="Jump to reading position"
            title="Jump to reading position"
            className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
          >
            <ArrowDown size={14} />
          </button>
        </div>

        {/* Mobile: two rows */}
        <div className="flex sm:hidden flex-col py-2 gap-1.5">
          <div className="flex items-center gap-2.5">
            <button
              onClick={isPlaying ? pause : play}
              disabled={isLoading}
              aria-label={isLoading ? 'Loading' : isPlaying ? 'Pause' : 'Play'}
              className="w-9 h-9 rounded-full bg-[#2dd4bf]/20 hover:bg-[#2dd4bf]/35 flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PlayPauseIcon size={14} />
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-300 truncate">{postTitle}</div>
              {duration > 0 && (
                <div className="text-xs text-gray-500">{formatTime(elapsedSec)} · {formatTime(remainingSec)} remaining</div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={cycleSpeed}
              aria-label={`Playback speed: ${speed}×. Click to change.`}
              className="text-xs text-gray-500 bg-gray-800 border border-gray-700 rounded-full px-2.5 py-1 hover:bg-gray-700 transition-colors"
            >
              {speed}×
            </button>
            <button
              onClick={jumpToActiveParagraph}
              className="text-xs text-gray-500 bg-gray-800 border border-gray-700 rounded-full px-2.5 py-1 hover:bg-gray-700 transition-colors flex items-center gap-1"
            >
              <ArrowDown size={11} />
              Jump to position
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
