'use client';

import Image from 'next/image';
import { ExternalLink, Play, Pause } from 'lucide-react';
import type { MusicMoment } from '@/lib/spotify/types';

interface SpotifyCardProps {
  moment: MusicMoment;
  compact?: boolean;
  isPlaying?: boolean;
  playProgress?: number; // 0-1
  onPlayToggle?: (moment: MusicMoment) => void;
}

function formatDateRange(dateRange: { start: string; end: string }): string {
  const start = new Date(dateRange.start);
  const end = new Date(dateRange.end);

  const startMonth = start.toLocaleString('default', { month: 'short' });
  const endMonth = end.toLocaleString('default', { month: 'short' });
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  if (startYear === endYear) {
    if (startMonth === endMonth) {
      return `${startMonth} ${startYear}`;
    }
    return `${startMonth} – ${endMonth} ${startYear}`;
  }

  return `${startMonth} ${startYear} – ${endMonth} ${endYear}`;
}

export default function SpotifyCard({
  moment,
  compact = false,
  isPlaying = false,
  playProgress = 0,
  onPlayToggle,
}: SpotifyCardProps) {
  const dateLabel = formatDateRange(moment.dateRange);
  const playsPerWeek =
    moment.weeksCount > 0
      ? Math.round(moment.playCount / moment.weeksCount)
      : moment.playCount;

  if (compact) {
    return (
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
        {/* Album art */}
        <div className="relative w-9 h-9 flex-shrink-0 rounded overflow-hidden">
          {moment.albumArtUrl ? (
            <Image
              src={moment.albumArtUrl}
              alt={`${moment.album} album art`}
              fill
              sizes="36px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full bg-white/10 flex items-center justify-center">
              <Play className="w-3 h-3 text-gray-500" />
            </div>
          )}
        </div>

        {/* Track info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-100 truncate leading-tight">
            {moment.trackName}
          </p>
          <p className="text-xs text-gray-400 truncate leading-tight">
            {moment.artist}
          </p>
        </div>

        {/* Date */}
        <span className="text-xs text-gray-500 flex-shrink-0">{dateLabel}</span>
      </div>
    );
  }

  // Full variant
  return (
    <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] overflow-hidden">
      <div className="p-4 flex gap-4">
        {/* Album art with play button overlay */}
        <div
          className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden group cursor-pointer"
          onClick={() => onPlayToggle?.(moment)}
        >
          {moment.albumArtUrl ? (
            <Image
              src={moment.albumArtUrl}
              alt={`${moment.album} album art`}
              fill
              sizes="64px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full bg-white/10" />
          )}

          {/* Play/pause overlay */}
          {onPlayToggle && (
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {isPlaying ? (
                <Pause className="w-6 h-6 text-white" />
              ) : (
                <Play className="w-6 h-6 text-white fill-white" />
              )}
            </div>
          )}

          {/* Progress bar */}
          {isPlaying && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
              <div
                className="h-full bg-[#1DB954] transition-all duration-300"
                style={{ width: `${playProgress * 100}%` }}
              />
            </div>
          )}
        </div>

        {/* Track info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-base font-semibold text-gray-100 truncate leading-tight">
                {moment.trackName}
              </p>
              <p className="text-sm text-gray-400 truncate leading-snug">
                {moment.artist}
              </p>
            </div>

            {/* Spotify external link */}
            {moment.spotifyUrl && (
              <a
                href={moment.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 text-gray-500 hover:text-[#1DB954] transition-colors mt-0.5"
                aria-label={`Open ${moment.trackName} on Spotify`}
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>

          {/* Date range in Spotify green */}
          <p className="text-xs font-medium mt-1" style={{ color: '#1DB954' }}>
            {dateLabel}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="px-4 pb-4 flex gap-6">
        <div className="text-center">
          <p className="text-sm font-bold text-white">{moment.playCount}</p>
          <p className="text-[10px] uppercase tracking-wide text-gray-500">Plays</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-white">{moment.weeksCount}</p>
          <p className="text-[10px] uppercase tracking-wide text-gray-500">Weeks</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-white">{playsPerWeek}</p>
          <p className="text-[10px] uppercase tracking-wide text-gray-500">Per week</p>
        </div>
      </div>
    </div>
  );
}
