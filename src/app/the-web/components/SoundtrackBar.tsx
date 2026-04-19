'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Play, Pause, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { SoundtrackTrack } from '@/lib/blog';
import { useSoundtrackPlayer } from '../hooks/useSoundtrackPlayer';
import AlbumArtFallback from '@/components/spotify/AlbumArtFallback';

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

      <div className="rounded-xl bg-gradient-to-r from-[#2dd4bf]/[0.08] to-teal-400/[0.08] border border-white/[0.06] mb-8 overflow-hidden">
        <div className="flex items-center gap-2.5 px-3 py-2">
          {/* Album art — 32px on mobile, 40px on sm+ */}
          <div className="relative w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 rounded-lg overflow-hidden">
            {currentTrack.albumArtUrl ? (
              <Image
                src={currentTrack.albumArtUrl}
                alt={`${currentTrack.trackName} album art`}
                fill
                sizes="40px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <AlbumArtFallback
                seed={currentTrack.trackUri || currentTrack.trackName}
                iconSize={16}
                rounded="rounded-lg"
              />
            )}
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
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-[#2dd4bf]/20 hover:bg-[#2dd4bf]/30 transition-colors"
            aria-label={player.isPlaying ? 'Pause' : 'Play'}
          >
            {player.isLoading ? (
              <LoadingBars />
            ) : player.isPlaying ? (
              <Pause className="w-3.5 h-3.5 text-[#2dd4bf]" fill="#2dd4bf" />
            ) : (
              <Play className="w-3.5 h-3.5 text-[#2dd4bf] ml-0.5" fill="#2dd4bf" />
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
                      ? 'w-1.5 h-1.5 bg-[#2dd4bf]'
                      : 'w-1 h-1 bg-white/20'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Soundtrack label */}
          <span className="hidden sm:inline text-[9px] text-white/25 tracking-wide flex-shrink-0">
            Songs Mike listened to writing this, curated by Iris
          </span>

          {/* Close button */}
          <button
            onClick={() => {
              player.stop();
              setDismissed(true);
            }}
            className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            aria-label="Dismiss soundtrack"
          >
            <X className="w-2.5 h-2.5 text-white/30" />
          </button>
        </div>
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
            backgroundColor: '#2dd4bf',
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
