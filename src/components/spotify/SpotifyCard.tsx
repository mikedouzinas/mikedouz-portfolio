'use client';

import Image from 'next/image';
import { ExternalLink, Play, Pause } from 'lucide-react';
import type { MusicMoment } from '@/lib/spotify/types';
import { useAdminMode } from '@/hooks/useAdminMode';
import { musicInsights } from '@/data/spotify/loader';
import SpotifyAdminDetail from '@/components/spotify/SpotifyAdminDetail';

interface SpotifyCardProps {
  moment: MusicMoment;
  compact?: boolean;
  isPlaying?: boolean;
  playProgress?: number;
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
  const adminMode = useAdminMode();
  const insight = musicInsights.find((i) => i.id === moment.id);
  const dateLabel = formatDateRange(moment.dateRange);
  const hasPreview = !!moment.previewUrl;

  if (compact) {
    return (
      <div className="flex items-center gap-2.5 py-1.5">
        <div className="relative w-9 h-9 flex-shrink-0 rounded overflow-hidden bg-white/10">
          {moment.albumArtUrl ? (
            <Image
              src={moment.albumArtUrl}
              alt={moment.album}
              fill
              sizes="36px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Play className="w-3 h-3 text-gray-500" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-100 truncate leading-tight">
            {moment.trackName}
          </p>
          <p className="text-[10px] text-gray-500 truncate leading-tight">
            {moment.artist} · {dateLabel}
          </p>
        </div>
      </div>
    );
  }

  // Full card
  return (
    <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3">
      <div className="flex gap-3">
        {/* Album art */}
        <div
          className={`relative w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-white/10 ${hasPreview ? 'group cursor-pointer' : ''}`}
          onClick={() => hasPreview && onPlayToggle?.(moment)}
        >
          {moment.albumArtUrl ? (
            <Image
              src={moment.albumArtUrl}
              alt={moment.album}
              fill
              sizes="56px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full" />
          )}

          {/* Play overlay — only when preview available */}
          {hasPreview && (
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {isPlaying ? (
                <Pause className="w-5 h-5 text-white fill-white" />
              ) : (
                <Play className="w-5 h-5 text-white fill-white ml-0.5" />
              )}
            </div>
          )}

          {isPlaying && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
              <div
                className="h-full bg-[#1DB954]"
                style={{ width: `${playProgress * 100}%` }}
              />
            </div>
          )}
        </div>

        {/* Info — all left-aligned */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-gray-100 truncate leading-tight">
              {moment.trackName}
            </p>
            {moment.spotifyUrl && (
              <a
                href={moment.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 text-gray-500 hover:text-[#1DB954] transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
          <p className="text-xs text-gray-400 truncate leading-tight mt-0.5">
            {moment.artist}
          </p>
          <p className="text-[11px] font-medium mt-1.5" style={{ color: '#1DB954' }}>
            {dateLabel}
          </p>

          {/* Stats — left-aligned, inline */}
          <div className="flex gap-3 mt-2 text-[10px]">
            <span className="text-gray-400">
              <span className="font-bold text-gray-200">{moment.playCount}</span> plays
            </span>
            <span className="text-gray-400">
              <span className="font-bold text-gray-200">{moment.weeksCount}</span> {moment.weeksCount === 1 ? 'week' : 'weeks'}
            </span>
          </div>
        </div>
      </div>

      {/* Admin detail */}
      {adminMode && insight && (
        <div className="mt-3">
          <SpotifyAdminDetail insight={insight} />
        </div>
      )}
    </div>
  );
}
