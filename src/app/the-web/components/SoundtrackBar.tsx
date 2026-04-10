'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Play, Pause, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { SoundtrackTrack } from '@/lib/blog';
import { useSoundtrackPlayer } from '../hooks/useSoundtrackPlayer';

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

interface SoundtrackBarProps {
  soundtrack: SoundtrackTrack[];
}

export default function SoundtrackBar({ soundtrack }: SoundtrackBarProps) {
  const [dismissed, setDismissed] = useState(false);
  const player = useSoundtrackPlayer(soundtrack);

  if (dismissed || soundtrack.length === 0) return null;

  const { currentTrack, currentIndex, trackCount } = player;
  if (!currentTrack) return null;

  return (
    <>
      {/* Hidden Spotify embed container */}
      <div
        ref={player.containerRef}
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 }}
      />

      <div className="rounded-xl bg-gradient-to-r from-[#1DB954]/[0.08] to-emerald-500/[0.08] border border-white/[0.06] mb-8 overflow-hidden">
        <div className="flex items-center gap-2.5 px-3 py-2">
          {/* Album art — 32px on mobile, 40px on sm+ */}
          <div className="relative w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 rounded-lg overflow-hidden">
            <Image
              src={currentTrack.albumArtUrl}
              alt={`${currentTrack.trackName} album art`}
              fill
              sizes="40px"
              className="object-cover"
              unoptimized
            />
          </div>

          {/* Prev button */}
          {trackCount > 1 && (
            <button
              onClick={player.prev}
              className="flex-shrink-0 w-6 h-6 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
              aria-label="Previous track"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-white/50" />
            </button>
          )}

          {/* Play / Pause button */}
          <button
            onClick={player.togglePlay}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-[#1DB954]/20 hover:bg-[#1DB954]/30 transition-colors"
            aria-label={player.isPlaying ? 'Pause' : 'Play'}
          >
            {player.isLoading ? (
              <LoadingBars />
            ) : player.isPlaying ? (
              <Pause className="w-3.5 h-3.5 text-[#1DB954]" fill="#1DB954" />
            ) : (
              <Play className="w-3.5 h-3.5 text-[#1DB954] ml-0.5" fill="#1DB954" />
            )}
          </button>

          {/* Next button */}
          {trackCount > 1 && (
            <button
              onClick={player.next}
              className="flex-shrink-0 w-6 h-6 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
              aria-label="Next track"
            >
              <ChevronRight className="w-3.5 h-3.5 text-white/50" />
            </button>
          )}

          {/* Track info */}
          <div className="flex-1 min-w-0">
            <div className="text-xs text-white/80 font-medium truncate">
              {currentTrack.trackName}
            </div>
            <div className="text-[11px] text-white/40 truncate">
              {currentTrack.artist}
              {player.isPlaying && player.duration > 0 && (
                <span className="text-white/30 ml-1.5">
                  {formatTime(player.position)} / {formatTime(player.duration)}
                </span>
              )}
            </div>
          </div>

          {/* Track dots */}
          {trackCount > 1 && (
            <div className="flex gap-1 items-center flex-shrink-0">
              {soundtrack.map((_, i) => (
                <div
                  key={i}
                  className={`rounded-full transition-colors ${
                    i === currentIndex
                      ? 'w-1.5 h-1.5 bg-[#1DB954]'
                      : 'w-1 h-1 bg-white/20'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Close button */}
          <button
            onClick={() => {
              player.pause();
              setDismissed(true);
            }}
            className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            aria-label="Dismiss soundtrack"
          >
            <X className="w-2.5 h-2.5 text-white/30" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-white/[0.06]">
          <div
            className="h-full bg-gradient-to-r from-[#1DB954] to-emerald-500 transition-[width] duration-300"
            style={{ width: `${player.progress * 100}%` }}
          />
        </div>

        {/* Preview ended message */}
        {player.previewEnded && (
          <div className="px-3 py-1.5 text-[10px] text-white/40 border-t border-white/[0.04]">
            Preview ended.{' '}
            <a
              href="https://open.spotify.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1DB954]/70 hover:text-[#1DB954] transition-colors underline"
            >
              Log in to Spotify
            </a>{' '}
            for full tracks.
          </div>
        )}
      </div>
    </>
  );
}

/** Tiny bouncing equalizer bars for loading state */
function LoadingBars() {
  return (
    <div className="flex items-end justify-center" style={{ height: 10, gap: 1.5 }}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-full"
          style={{
            width: 2,
            backgroundColor: '#1DB954',
            animation: `eqBounce 0.8s ease-in-out ${i * 0.15}s infinite alternate`,
          }}
        />
      ))}
      <style>{`
        @keyframes eqBounce {
          0% { height: 20%; opacity: 0.4; }
          100% { height: 100%; opacity: 1; }
        }
      `}</style>
    </div>
  );
}
