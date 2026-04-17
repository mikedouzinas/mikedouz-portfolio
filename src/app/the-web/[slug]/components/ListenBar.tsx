// src/app/the-web/[slug]/components/ListenBar.tsx
'use client';

import { Play, Pause, ArrowDown } from 'lucide-react';
import type { UseAudioPlayerReturn } from '@/hooks/useAudioPlayer';

interface ListenBarProps {
  player: UseAudioPlayerReturn;
  postTitle: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ListenBar({ player, postTitle }: ListenBarProps) {
  const { status, currentTime, duration, speed, play, pause, cycleSpeed, jumpToActiveParagraph } = player;

  const isPlaying = status === 'playing';
  const isVisible = status !== 'idle' && status !== 'error';
  const progress = duration > 0 ? currentTime / duration : 0;
  const remaining = Math.max(0, duration - currentTime);

  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-teal-500/10">
      {/* Thin teal progress strip */}
      <div className="h-0.5 bg-gray-800">
        <div
          className="h-full bg-teal-500 transition-none"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Controls */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {/* Desktop: single row */}
        <div className="hidden sm:flex items-center gap-3 py-2">
          <button
            onClick={isPlaying ? pause : play}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="w-7 h-7 rounded-full bg-teal-500 text-black flex items-center justify-center flex-shrink-0 hover:bg-teal-400 transition-colors"
          >
            {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" className="translate-x-px" />}
          </button>

          <span className="text-xs text-gray-300 truncate flex-1 min-w-0">{postTitle}</span>

          {duration > 0 && (
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {formatTime(currentTime)} · {formatTime(remaining)} left
            </span>
          )}

          <button
            onClick={cycleSpeed}
            className="text-xs text-gray-500 bg-gray-800 border border-gray-700 rounded-full px-2 py-0.5 hover:bg-gray-700 transition-colors flex-shrink-0"
          >
            {speed}×
          </button>

          <button
            onClick={jumpToActiveParagraph}
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
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="w-9 h-9 rounded-full bg-teal-500 text-black flex items-center justify-center flex-shrink-0 hover:bg-teal-400 transition-colors"
            >
              {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="translate-x-px" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-300 truncate">{postTitle}</div>
              {duration > 0 && (
                <div className="text-xs text-gray-500">{formatTime(currentTime)} · {formatTime(remaining)} remaining</div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={cycleSpeed}
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
