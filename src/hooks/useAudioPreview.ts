"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { MusicMoment } from "@/lib/spotify/types";

interface UseAudioPreviewReturn {
  currentMomentId: string | null;
  isPlaying: boolean;
  progress: number; // 0-1
  togglePlay: (moment: MusicMoment) => void;
  stop: () => void;
}

export function useAudioPreview(): UseAudioPreviewReturn {
  const [currentMomentId, setCurrentMomentId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const cancelRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    cancelRaf();
    setCurrentMomentId(null);
    setIsPlaying(false);
    setProgress(0);
  }, [cancelRaf]);

  const updateProgress = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.duration === 0 || isNaN(audio.duration)) {
      rafRef.current = requestAnimationFrame(updateProgress);
      return;
    }
    setProgress(audio.currentTime / audio.duration);
    rafRef.current = requestAnimationFrame(updateProgress);
  }, []);

  const togglePlay = useCallback(
    (moment: MusicMoment) => {
      if (!moment.previewUrl) return;

      // Same track: toggle pause/resume
      if (currentMomentId === moment.id && audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause();
          cancelRaf();
          setIsPlaying(false);
        } else {
          audioRef.current.play().catch(() => stop());
          rafRef.current = requestAnimationFrame(updateProgress);
          setIsPlaying(true);
        }
        return;
      }

      // Different track: stop current, start new
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
      cancelRaf();

      const audio = new Audio(moment.previewUrl);
      audioRef.current = audio;

      audio.addEventListener("ended", () => {
        cancelRaf();
        setCurrentMomentId(null);
        setIsPlaying(false);
        setProgress(0);
        audioRef.current = null;
      });

      audio.addEventListener("error", () => {
        stop();
      });

      audio.play().catch(() => stop());

      setCurrentMomentId(moment.id);
      setIsPlaying(true);
      setProgress(0);
      rafRef.current = requestAnimationFrame(updateProgress);
    },
    [currentMomentId, isPlaying, cancelRaf, updateProgress, stop]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      cancelRaf();
    };
  }, [cancelRaf]);

  return { currentMomentId, isPlaying, progress, togglePlay, stop };
}
