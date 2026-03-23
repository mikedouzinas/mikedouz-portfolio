'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { MusicMoment } from '@/lib/spotify/types';

/* ── Spotify IFrame API types ── */

interface EmbedController {
  togglePlay: () => void;
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  destroy: () => void;
  loadUri: (uri: string) => void;
  addListener: (event: string, callback: (data: unknown) => void) => void;
  removeListener: (event: string, callback: (data: unknown) => void) => void;
}

interface PlaybackUpdate {
  isPaused: boolean;
  isBuffering: boolean;
  duration: number; // ms
  position: number; // ms
}

interface SpotifyIFrameAPI {
  createController: (
    element: HTMLElement,
    options: { uri: string; width: number; height: number },
    callback: (controller: EmbedController) => void,
  ) => void;
}

/* ── Helpers ── */

export function extractTrackId(moment: MusicMoment): string | null {
  if (moment.trackUri) {
    const parts = moment.trackUri.split(':');
    if (parts.length === 3) return parts[2];
  }
  if (moment.spotifyUrl) {
    const match = moment.spotifyUrl.match(/track\/([a-zA-Z0-9]+)/);
    if (match) return match[1];
  }
  return null;
}

/* ── Singleton API loader ── */

let apiPromise: Promise<SpotifyIFrameAPI> | null = null;

function loadIFrameAPI(): Promise<SpotifyIFrameAPI> {
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<SpotifyIFrameAPI>((resolve) => {
    const win = window as unknown as Record<string, unknown>;
    if (win.__spotifyIFrameAPI) {
      resolve(win.__spotifyIFrameAPI as SpotifyIFrameAPI);
      return;
    }

    win.onSpotifyIframeApiReady = (IFrameAPI: unknown) => {
      win.__spotifyIFrameAPI = IFrameAPI;
      resolve(IFrameAPI as SpotifyIFrameAPI);
    };

    const script = document.createElement('script');
    script.src = 'https://open.spotify.com/embed/iframe-api/v1';
    script.async = true;
    document.head.appendChild(script);
  });

  return apiPromise;
}

/* ── Hook ── */

export interface UseSpotifyEmbedReturn {
  currentMomentId: string | null;
  isPlaying: boolean;
  progress: number; // 0–1
  position: number; // seconds
  duration: number; // seconds
  togglePlay: (moment: MusicMoment) => void;
  stop: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useSpotifyEmbed(): UseSpotifyEmbedReturn {
  const [currentMomentId, setCurrentMomentId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<EmbedController | null>(null);
  const pendingTrackRef = useRef<string | null>(null);
  const momentIdRef = useRef<string | null>(null);

  const clearContainer = useCallback(() => {
    if (containerRef.current) containerRef.current.innerHTML = '';
  }, []);

  const stop = useCallback(() => {
    if (controllerRef.current) {
      try { controllerRef.current.destroy(); } catch { /* ignore */ }
      controllerRef.current = null;
    }
    pendingTrackRef.current = null;
    momentIdRef.current = null;
    clearContainer();
    setCurrentMomentId(null);
    setIsPlaying(false);
    setProgress(0);
    setPosition(0);
    setDuration(0);
  }, [clearContainer]);

  const createEmbed = useCallback(
    (trackId: string, momentId: string) => {
      clearContainer();
      pendingTrackRef.current = trackId;
      momentIdRef.current = momentId;

      setCurrentMomentId(momentId);
      setIsPlaying(false);
      setProgress(0);
      setPosition(0);
      setDuration(0);

      loadIFrameAPI().then((IFrameAPI) => {
        // Bail if user switched tracks while API was loading
        if (pendingTrackRef.current !== trackId) return;
        if (!containerRef.current) return;

        const el = document.createElement('div');
        containerRef.current.appendChild(el);

        IFrameAPI.createController(
          el,
          { uri: `spotify:track:${trackId}`, width: 1, height: 1 },
          (controller) => {
            // Bail if track changed during controller creation
            if (pendingTrackRef.current !== trackId) {
              try { controller.destroy(); } catch { /* ignore */ }
              return;
            }

            controllerRef.current = controller;

            controller.addListener('playback_update', (raw: unknown) => {
              const d = raw as PlaybackUpdate;
              setIsPlaying(!d.isPaused);
              if (d.duration > 0) {
                setProgress(d.position / d.duration);
                setPosition(Math.floor(d.position / 1000));
                setDuration(Math.floor(d.duration / 1000));
              }
            });

            // Auto-play when the embed is ready
            controller.addListener('ready', () => {
              controller.play();
            });
          },
        );
      });
    },
    [clearContainer],
  );

  const togglePlay = useCallback(
    (moment: MusicMoment) => {
      const trackId = extractTrackId(moment);
      if (!trackId) return;

      // Same track → toggle
      if (momentIdRef.current === moment.id && controllerRef.current) {
        controllerRef.current.togglePlay();
        return;
      }

      // Different track → destroy old, create new
      if (controllerRef.current) {
        try { controllerRef.current.destroy(); } catch { /* ignore */ }
        controllerRef.current = null;
      }

      createEmbed(trackId, moment.id);
    },
    [createEmbed],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (controllerRef.current) {
        try { controllerRef.current.destroy(); } catch { /* ignore */ }
      }
    };
  }, []);

  return {
    currentMomentId,
    isPlaying,
    progress,
    position,
    duration,
    togglePlay,
    stop,
    containerRef,
  };
}
