"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface MusicOverlayProps {
  previewUrl: string;
  songTitle: string;
  artist: string;
  isActive: boolean;
}

const VOLUME = 0.15;
const FADE_DURATION = 400;

function FloatingNote({ delay }: { delay: number }) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 0, x: 0 }}
      animate={{
        opacity: [0, 0.7, 0],
        y: -40,
        x: Math.random() * 20 - 10,
      }}
      transition={{
        duration: 2,
        delay,
        ease: "easeOut",
      }}
      className="absolute bottom-0 right-2 text-sm text-blue-400/60 dark:text-blue-300/60 pointer-events-none select-none"
    >
      &#9835;
    </motion.span>
  );
}

export default function MusicOverlay({
  previewUrl,
  songTitle,
  artist,
  isActive,
}: MusicOverlayProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [noteKeys, setNoteKeys] = useState<number[]>([]);

  useEffect(() => {
    if (!isActive || !previewUrl) return;
    const spawnNote = () => {
      setNoteKeys((prev) => [...prev.slice(-5), Date.now()]);
    };
    spawnNote();
    const interval = setInterval(spawnNote, 1200);
    return () => {
      clearInterval(interval);
      setNoteKeys([]);
    };
  }, [isActive, previewUrl]);

  useEffect(() => {
    if (!previewUrl) return;

    if (isActive) {
      const audio = new Audio(previewUrl);
      audio.volume = 0;
      audio.loop = true;
      audioRef.current = audio;
      audio.play().catch(() => {});

      const steps = FADE_DURATION / 50;
      const volumeStep = VOLUME / steps;
      let currentStep = 0;
      fadeIntervalRef.current = setInterval(() => {
        currentStep++;
        if (audioRef.current) {
          audioRef.current.volume = Math.min(
            VOLUME,
            volumeStep * currentStep,
          );
        }
        if (currentStep >= steps && fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current);
        }
      }, 50);
    } else {
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
      const audio = audioRef.current;
      if (!audio) return;

      const startVolume = audio.volume;
      const steps = FADE_DURATION / 50;
      const volumeStep = startVolume / steps;
      let currentStep = 0;
      fadeIntervalRef.current = setInterval(() => {
        currentStep++;
        if (audio) {
          audio.volume = Math.max(
            0,
            startVolume - volumeStep * currentStep,
          );
        }
        if (currentStep >= steps) {
          if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
          audio.pause();
          audioRef.current = null;
        }
      }, 50);
    }

    return () => {
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [isActive, previewUrl]);

  if (!previewUrl) return null;

  return (
    <>
      <div className="absolute -top-2 right-0 w-8 h-12 pointer-events-none">
        <AnimatePresence>
          {noteKeys.map((key, i) => (
            <FloatingNote key={key} delay={i * 0.1} />
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-3 pb-2 flex items-center gap-1.5"
          >
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              &#9835; {songTitle} — {artist}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
