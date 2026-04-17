// src/hooks/useAudioPlayer.ts
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { AudioTimestamps } from '@/lib/audioUtils';

export type AudioStatus =
  | 'idle'       // never played
  | 'loading'    // fetching audio URL from API
  | 'generating' // ElevenLabs is generating (first play, no cache)
  | 'ready'      // audio URL loaded, not yet played
  | 'playing'
  | 'paused'
  | 'error';

const SPEED_STEPS = [1, 1.25, 1.5, 2] as const;

export interface UseAudioPlayerReturn {
  status: AudioStatus;
  currentTime: number;
  duration: number;
  activeParagraphIndex: number;
  speed: number;
  errorMessage: string | null;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  cycleSpeed: () => void;
  jumpToActiveParagraph: () => void;
}

export function useAudioPlayer(slug: string, postTitle: string, coverImage: string | null): UseAudioPlayerReturn {
  const [status, setStatus] = useState<AudioStatus>('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeParagraphIndex, setActiveParagraphIndex] = useState(-1);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timestampsRef = useRef<AudioTimestamps | null>(null);
  const rafRef = useRef<number | null>(null);
  const hasInitiatedRef = useRef(false);
  // Store initiate in a ref to allow safe recursive calls without dependency issues
  const initiateRef = useRef<() => Promise<void>>(async () => {});

  const speed = SPEED_STEPS[speedIndex];

  // Cancel animation frame
  const cancelRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Update progress via rAF
  const tick = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = audio.currentTime;
    setCurrentTime(t);

    // Derive active paragraph from timestamps
    const ts = timestampsRef.current;
    if (ts) {
      const idx = ts.paragraphs.findIndex((p) => t >= p.start && t < p.end);
      setActiveParagraphIndex(idx >= 0 ? idx : ts.paragraphs.length - 1);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // Register Media Session
  const registerMediaSession = useCallback((title: string, artwork: string | null) => {
    if (!('mediaSession' in navigator)) return;
    const audio = audioRef.current;
    if (!audio) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: 'Mike Veson',
      artwork: artwork
        ? [{ src: artwork, sizes: '512x512', type: 'image/jpeg' }]
        : [{ src: '/og-image.png', sizes: '512x512', type: 'image/png' }],
    });

    navigator.mediaSession.setActionHandler('play', () => {
      audio.play().catch(() => {});
      setStatus('playing');
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      audio.pause();
      setStatus('paused');
    });
    navigator.mediaSession.setActionHandler('seekforward', () => {
      audio.currentTime = Math.min(audio.currentTime + 30, audio.duration);
    });
    navigator.mediaSession.setActionHandler('seekbackward', () => {
      audio.currentTime = Math.max(audio.currentTime - 15, 0);
    });
  }, []);

  // Initiate: fetch audio URL from API, load audio + timestamps
  const initiate = useCallback(async () => {
    if (hasInitiatedRef.current) return;
    hasInitiatedRef.current = true;
    setStatus('loading');
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/the-web/${slug}/audio`, { method: 'POST' });

      if (res.status === 429) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        if (body.error === 'audio_generating') {
          // Generation in progress elsewhere — retry after delay
          setStatus('generating');
          await new Promise((r) => setTimeout(r, 5000));
          hasInitiatedRef.current = false;
          // Use ref to avoid stale-closure recursion lint warnings
          initiateRef.current();
          return;
        }
        throw new Error('Rate limited');
      }

      if (!res.ok) {
        throw new Error('Failed to get audio URL');
      }

      const { audioUrl, timestampsUrl } = await res.json() as {
        audioUrl: string;
        timestampsUrl: string;
      };

      // Fetch timestamps JSON
      const tsRes = await fetch(timestampsUrl);
      if (!tsRes.ok) throw new Error('Failed to load timestamps');
      const ts = await tsRes.json() as AudioTimestamps;
      timestampsRef.current = ts;

      // Create and configure audio element
      const audio = new Audio(audioUrl);
      audio.preload = 'auto';
      audioRef.current = audio;

      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration);
      });

      audio.addEventListener('ended', () => {
        cancelRaf();
        setStatus('paused');
        setCurrentTime(audio.duration);
        setActiveParagraphIndex(-1);
      });

      audio.addEventListener('error', () => {
        cancelRaf();
        setStatus('error');
        setErrorMessage("Couldn't load audio.");
      });

      setStatus('ready');
    } catch (err) {
      console.error('[useAudioPlayer] initiate error:', err);
      setStatus('error');
      setErrorMessage("Couldn't load audio. Try again.");
      hasInitiatedRef.current = false;
    }
  }, [slug, cancelRaf]);

  // Keep initiateRef in sync so recursive calls always use the latest version
  useEffect(() => {
    initiateRef.current = initiate;
  }, [initiate]);

  const play = useCallback(async () => {
    if (status === 'idle' || status === 'error') {
      await initiate();
    }

    const audio = audioRef.current;
    if (!audio) return;

    try {
      audio.playbackRate = speed;
      await audio.play();
      setStatus('playing');
      registerMediaSession(postTitle, coverImage);
      cancelRaf();
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.error('[useAudioPlayer] play error:', err);
      setStatus('error');
      setErrorMessage("Couldn't start playback.");
    }
  }, [status, initiate, speed, postTitle, coverImage, registerMediaSession, cancelRaf, tick]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    cancelRaf();
    setStatus('paused');
  }, [cancelRaf]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const cycleSpeed = useCallback(() => {
    setSpeedIndex((i) => {
      const next = (i + 1) % SPEED_STEPS.length;
      if (audioRef.current) {
        audioRef.current.playbackRate = SPEED_STEPS[next];
      }
      return next;
    });
  }, []);

  const jumpToActiveParagraph = useCallback(() => {
    if (activeParagraphIndex < 0) return;
    const el = document.querySelector<HTMLElement>(`[data-para-idx="${activeParagraphIndex}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeParagraphIndex]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelRaf();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, [cancelRaf]);

  // When status transitions to 'ready', auto-play
  // This fires exactly once: 'ready' → play() → 'playing', preventing re-trigger
  useEffect(() => {
    if (status === 'ready' && audioRef.current) {
      play();
    }
  }, [status, play]);

  return {
    status,
    currentTime,
    duration,
    activeParagraphIndex,
    speed,
    errorMessage,
    play,
    pause,
    seek,
    cycleSpeed,
    jumpToActiveParagraph,
  };
}
