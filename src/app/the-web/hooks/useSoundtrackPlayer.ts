'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import type { SoundtrackTrack } from '@/lib/blog';
import type { MusicMoment } from '@/lib/spotify/types';
import { useSpotifyEmbed } from '@/hooks/useSpotifyEmbed';

/**
 * Adapts the existing useSpotifyEmbed hook for playlist-style playback.
 * Manages track index, prev/next, and auto-advance.
 */
export function useSoundtrackPlayer(soundtrack: SoundtrackTrack[]) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previewEnded, setPreviewEnded] = useState(false);
  const [autoAdvancing, setAutoAdvancing] = useState(false);

  const embed = useSpotifyEmbed();

  // Convert SoundtrackTrack to a MusicMoment-shaped object for useSpotifyEmbed.
  // Only the fields that useSpotifyEmbed actually uses: id, trackUri, spotifyUrl.
  const asMoments: MusicMoment[] = useMemo(
    () =>
      soundtrack.map((t, i) => ({
        id: `soundtrack-${i}`,
        trackName: t.trackName,
        artist: t.artist,
        album: '',
        trackUri: t.trackUri,
        albumArtUrl: t.albumArtUrl,
        previewUrl: null,
        spotifyUrl: '',
        dateRange: { start: '', end: '' },
        playCount: 0,
        weeksCount: 0,
        intensity: 0,
        maxState: 0,
        peakDay: '',
        peakDayPlays: 0,
        hotDays: [],
      })),
    [soundtrack],
  );

  const currentTrack = soundtrack[currentIndex] ?? null;
  const isCurrentPlaying =
    embed.currentMomentId === `soundtrack-${currentIndex}`;

  // Detect track ended (progress >= 1 and stopped playing) → auto-advance
  const trackEnded =
    isCurrentPlaying && embed.progress >= 1 && !embed.isPlaying;

  useEffect(() => {
    if (trackEnded && !autoAdvancing && soundtrack.length > 1) {
      setAutoAdvancing(true);
      const nextIdx = (currentIndex + 1) % soundtrack.length;
      setCurrentIndex(nextIdx);
      setPreviewEnded(false);
      embed.togglePlay(asMoments[nextIdx]);
      // Reset flag after a short delay to avoid re-triggering
      const timer = setTimeout(() => setAutoAdvancing(false), 500);
      return () => clearTimeout(timer);
    }
    // If single track and it ended, mark preview ended
    if (trackEnded && soundtrack.length === 1) {
      setPreviewEnded(true);
    }
  }, [trackEnded, autoAdvancing, currentIndex, soundtrack.length, asMoments, embed]);

  const play = useCallback(() => {
    if (!asMoments[currentIndex]) return;
    setPreviewEnded(false);
    embed.togglePlay(asMoments[currentIndex]);
  }, [asMoments, currentIndex, embed]);

  const pause = useCallback(() => {
    if (isCurrentPlaying && embed.isPlaying) {
      embed.togglePlay(asMoments[currentIndex]);
    }
  }, [asMoments, currentIndex, embed, isCurrentPlaying]);

  const togglePlay = useCallback(() => {
    if (isCurrentPlaying) {
      embed.togglePlay(asMoments[currentIndex]);
    } else {
      play();
    }
  }, [asMoments, currentIndex, embed, isCurrentPlaying, play]);

  const next = useCallback(() => {
    const nextIdx = (currentIndex + 1) % soundtrack.length;
    setCurrentIndex(nextIdx);
    setPreviewEnded(false);
    embed.togglePlay(asMoments[nextIdx]);
  }, [asMoments, currentIndex, embed, soundtrack.length]);

  const prev = useCallback(() => {
    const prevIdx = (currentIndex - 1 + soundtrack.length) % soundtrack.length;
    setCurrentIndex(prevIdx);
    setPreviewEnded(false);
    embed.togglePlay(asMoments[prevIdx]);
  }, [asMoments, currentIndex, embed, soundtrack.length]);

  return {
    currentTrack,
    currentIndex,
    trackCount: soundtrack.length,
    isPlaying: isCurrentPlaying && embed.isPlaying,
    isLoading: isCurrentPlaying && embed.isLoading,
    progress: isCurrentPlaying ? embed.progress : 0,
    position: isCurrentPlaying ? embed.position : 0,
    duration: isCurrentPlaying ? embed.duration : 0,
    previewEnded,
    togglePlay,
    play,
    pause,
    next,
    prev,
    containerRef: embed.containerRef,
  };
}
