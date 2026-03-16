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

/** Show specific date range: "Jan 8 – 12, 2026" or "Dec 29 – Jan 25" */
function formatDateRange(dateRange: { start: string; end: string }): string {
  const s = new Date(dateRange.start);
  const e = new Date(dateRange.end);

  const sMonth = s.toLocaleString('default', { month: 'short' });
  const eMonth = e.toLocaleString('default', { month: 'short' });
  const sDay = s.getUTCDate();
  const eDay = e.getUTCDate();
  const sYear = s.getUTCFullYear();
  const eYear = e.getUTCFullYear();

  // Same day
  if (dateRange.start === dateRange.end) {
    return `${sMonth} ${sDay}, ${sYear}`;
  }
  // Same month + year
  if (sMonth === eMonth && sYear === eYear) {
    return `${sMonth} ${sDay} – ${eDay}, ${sYear}`;
  }
  // Same year
  if (sYear === eYear) {
    return `${sMonth} ${sDay} – ${eMonth} ${eDay}, ${sYear}`;
  }
  // Different years
  return `${sMonth} ${sDay}, ${sYear} – ${eMonth} ${eDay}, ${eYear}`;
}

/** Intensity color — green gradient from muted to vivid based on play density */
function intensityColor(moment: MusicMoment): string {
  const playsPerWeek = moment.weeksCount > 0 ? moment.playCount / moment.weeksCount : moment.playCount;
  // Scale: 2/wk = subtle, 5/wk = medium, 10+/wk = hot
  if (playsPerWeek >= 8) return 'rgb(29, 185, 84)';       // full Spotify green
  if (playsPerWeek >= 5) return 'rgb(29, 185, 84, 0.8)';  // bright
  if (playsPerWeek >= 3) return 'rgb(29, 185, 84, 0.6)';  // medium
  return 'rgb(29, 185, 84, 0.4)';                          // subtle
}

/** Left border accent thickness based on intensity */
function intensityBorderWidth(moment: MusicMoment): number {
  const playsPerWeek = moment.weeksCount > 0 ? moment.playCount / moment.weeksCount : moment.playCount;
  if (playsPerWeek >= 8) return 3;
  if (playsPerWeek >= 5) return 2.5;
  if (playsPerWeek >= 3) return 2;
  return 1.5;
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
  const accentColor = intensityColor(moment);
  const borderWidth = intensityBorderWidth(moment);

  if (compact) {
    return (
      <div className="flex items-center gap-2.5 py-1.5">
        {/* Intensity dot */}
        <div
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: accentColor }}
        />
        <div className="relative w-8 h-8 flex-shrink-0 rounded overflow-hidden bg-white/10">
          {moment.albumArtUrl ? (
            <Image
              src={moment.albumArtUrl}
              alt={moment.album}
              fill
              sizes="32px"
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

  // Full card with intensity accent border
  return (
    <div
      className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3"
      style={{ borderLeftColor: accentColor, borderLeftWidth: borderWidth }}
    >
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

        {/* Info */}
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
          <p className="text-[11px] font-medium mt-1.5" style={{ color: accentColor }}>
            {dateLabel}
          </p>
          <div className="flex gap-3 mt-1.5 text-[10px]">
            <span className="text-gray-400">
              <span className="font-bold text-gray-200">{moment.playCount}</span> plays
            </span>
            <span className="text-gray-400">
              <span className="font-bold text-gray-200">{moment.weeksCount}</span> {moment.weeksCount === 1 ? 'wk' : 'wks'}
            </span>
            {moment.peakDayPlays > 1 && (
              <span className="text-gray-400">
                peak <span className="font-bold text-gray-200">{moment.peakDayPlays}x</span>/day
              </span>
            )}
          </div>
        </div>
      </div>

      {adminMode && insight && (
        <div className="mt-3">
          <SpotifyAdminDetail insight={insight} />
        </div>
      )}
    </div>
  );
}
