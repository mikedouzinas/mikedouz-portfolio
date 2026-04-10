"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Lottie from "lottie-react";
import spiderWebAnim from "../../../../public/animations/spider-web.json";
import spiderSwingingAnim from "../../../../public/animations/spider-swinging.json";

/**
 * Loading messages specific to "the web" blog.
 * Mix of web/thread metaphors and Spider-Verse references.
 */
const WEB_LOADING_MESSAGES = [
  // Web/threads
  "pulling threads...",
  "untangling the web...",
  "following the signal...",
  "weaving thoughts together...",
  "one sec, the web is loading...",
  "loading thoughts...",
  "the web is wide. give me a moment.",
  "spinning up the web...",
  // Spider-Man
  "my spidey sense is tingling...",
  "just your friendly neighborhood blog...",
  "thwip thwip. loading...",
  "anyone can wear the mask...",
  // Spider-Verse
  "okay, let's do this one more time...",
  "that's all it is, miles. a leap of faith.",
  "what's up danger...",
  "you can't think about saving the world. you have to just do it.",
  "i see this spark in you. it's amazing.",
  "when do i know i'm ready? you won't. it's a leap of faith.",
  "one thing i know for sure: don't do it like me. do it like you.",
  "you're on your way. just keep going.",
  "how do i know i'm spider-man? ...long story.",
  "miles, i need you to reprogram the multiverse real quick...",
  "not every universe has the same story. that's the point.",
];

const LOTTIE_ANIMATIONS = [spiderWebAnim, spiderSwingingAnim];

function getRandom<T>(arr: readonly T[] | T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function WebLoader() {
  const [message, setMessage] = useState(WEB_LOADING_MESSAGES[0]);
  const [animIndex, setAnimIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    setMessage(getRandom(WEB_LOADING_MESSAGES));
    setAnimIndex(Math.floor(Math.random() * LOTTIE_ANIMATIONS.length));
    setMounted(true);

    intervalRef.current = setInterval(() => {
      setMessage((prev) => {
        let next = getRandom(WEB_LOADING_MESSAGES);
        while (next === prev) next = getRandom(WEB_LOADING_MESSAGES);
        return next;
      });
    }, 3000);
    return () => clearInterval(intervalRef.current);
  }, []);

  if (!mounted) {
    return <div className="py-8" />;
  }

  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <AnimatePresence mode="wait">
        <motion.span
          key={message}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="text-sm text-teal-400/70"
        >
          {message}
        </motion.span>
      </AnimatePresence>
      <Lottie
        animationData={LOTTIE_ANIMATIONS[animIndex]}
        loop
        style={{ width: 96, height: 96 }}
      />
    </div>
  );
}
