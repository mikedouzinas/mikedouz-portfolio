# Hover Memories Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add three types of hover cards (memory bubbles, music memories, definition cards) woven throughout the site, making the portfolio feel alive with real personal moments.

**Architecture:** Data-driven hover card system. A single `<HoverTrigger>` wrapper component reads from a hover data file, picks the right card type, and handles positioning + interaction (desktop hover, mobile tap). Framer Motion for animations. Web Audio for music previews. No external popover library needed.

**Tech Stack:** React 19, Next.js (App Router), TypeScript, Framer Motion 12, Tailwind CSS, Web Audio API, Next.js `<Image>` component.

**Design Doc:** `docs/plans/2026-03-10-hover-memories-design.md`

---

### Task 1: Create Hover Card Data Types and Data File

**Files:**
- Create: `src/data/hover-cards.ts`

**Step 1: Create the data file with types and initial placeholder entries**

```ts
// src/data/hover-cards.ts

export interface MemoryBubbleData {
  type: "memory";
  id: string;
  photos: string[];       // paths relative to /images/memories/
  caption?: string;
  location?: string;
  year?: number;
  song?: {
    title: string;
    artist: string;
    previewUrl: string;   // Spotify 30s preview URL
  };
}

export interface DefinitionCardData {
  type: "definition";
  id: string;
  term: string;
  definition: string;
  source?: string;
  greek?: string;
}

export type HoverCardData = MemoryBubbleData | DefinitionCardData;

// Map from trigger ID to hover card data.
// Trigger IDs match the data-hover attribute on trigger elements.
export const hoverCards: Record<string, HoverCardData> = {
  barcelona: {
    type: "memory",
    id: "barcelona",
    photos: [
      "/images/memories/barcelona-1.jpg",
      "/images/memories/barcelona-2.jpg",
      "/images/memories/barcelona-3.jpg",
    ],
    caption: "Barcelona, Fall 2025",
    location: "Barcelona",
    year: 2025,
    song: {
      title: "TBD",
      artist: "TBD",
      previewUrl: "",  // Fill with Spotify preview URL
    },
  },
  barca: {
    type: "memory",
    id: "barca",
    photos: [
      "/images/memories/barca-1.jpg",
      "/images/memories/barca-2.jpg",
    ],
    caption: "Camp Nou",
    location: "Barcelona",
    year: 2025,
    song: {
      title: "TBD",
      artist: "TBD",
      previewUrl: "",
    },
  },
  rice: {
    type: "memory",
    id: "rice",
    photos: [
      "/images/memories/rice-1.jpg",
    ],
    caption: "Rice University",
    location: "Houston",
  },
  "veson-nautical": {
    type: "memory",
    id: "veson-nautical",
    photos: [
      "/images/memories/veson-1.jpg",
      "/images/memories/veson-2.jpg",
    ],
    caption: "Where it started",
  },
  "good-life": {
    type: "definition",
    id: "good-life",
    term: "Eudaimonia",
    greek: "εὐδαιμονία",
    definition:
      "The condition of human flourishing or of living well. The highest human good, achieved not through pleasure or wealth, but through virtuous activity of the soul in accordance with excellence, over a complete life.",
    source: "Aristotle, Nicomachean Ethics, Book I",
  },
  "iron-sharpens-iron": {
    type: "definition",
    id: "iron-sharpens-iron",
    term: "Iron Sharpens Iron",
    definition:
      "As iron sharpens iron, so one person sharpens another.",
    source: "Proverbs 27:17",
  },
};
```

**Step 2: Create the images directory**

Run: `mkdir -p public/images/memories`

**Step 3: Commit**

```bash
git add src/data/hover-cards.ts
git commit -m "feat: add hover card data types and initial entries"
```

---

### Task 2: Build useHoverCard Hook

**Files:**
- Create: `src/hooks/useHoverCard.ts`

**Step 1: Build the hook**

This hook handles:
- Hover state (desktop) and tap state (mobile)
- Positioning the card relative to the trigger (above or below, left/right aware)
- Touch detection to switch between hover and tap modes

```ts
// src/hooks/useHoverCard.ts
"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface Position {
  x: number;
  y: number;
  placement: "above" | "below";
}

interface UseHoverCardReturn {
  isOpen: boolean;
  position: Position | null;
  triggerRef: React.RefObject<HTMLSpanElement | null>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onTap: () => void;
  dismiss: () => void;
  isTouchDevice: boolean;
}

const CARD_WIDTH = 240;
const CARD_HEIGHT = 200;
const OFFSET_Y = 12;

export function useHoverCard(): UseHoverCardReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setIsTouchDevice(
      window.matchMedia("(pointer: coarse)").matches
    );
  }, []);

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return null;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Prefer above, fall back to below if not enough space
    const spaceAbove = rect.top;
    const placement = spaceAbove > CARD_HEIGHT + OFFSET_Y ? "above" : "below";

    // Center horizontally on trigger, clamp to viewport
    let x = rect.left + rect.width / 2 - CARD_WIDTH / 2;
    x = Math.max(8, Math.min(x, viewportWidth - CARD_WIDTH - 8));

    const y =
      placement === "above"
        ? rect.top - OFFSET_Y
        : rect.bottom + OFFSET_Y;

    return { x, y, placement };
  }, []);

  const onMouseEnter = useCallback(() => {
    if (isTouchDevice) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setPosition(calculatePosition());
    setIsOpen(true);
  }, [isTouchDevice, calculatePosition]);

  const onMouseLeave = useCallback(() => {
    if (isTouchDevice) return;
    // Small delay to allow moving cursor to the card itself
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  }, [isTouchDevice]);

  const onTap = useCallback(() => {
    if (!isTouchDevice) return;
    if (isOpen) {
      setIsOpen(false);
    } else {
      setPosition(calculatePosition());
      setIsOpen(true);
    }
  }, [isTouchDevice, isOpen, calculatePosition]);

  const dismiss = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Dismiss on scroll (mobile especially)
  useEffect(() => {
    if (!isOpen) return;
    const handleScroll = () => setIsOpen(false);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isOpen]);

  // Dismiss on outside tap (mobile)
  useEffect(() => {
    if (!isOpen || !isTouchDevice) return;
    const handleTouchOutside = (e: TouchEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    // Delay to avoid immediate dismiss from the tap that opened it
    const timer = setTimeout(() => {
      document.addEventListener("touchstart", handleTouchOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("touchstart", handleTouchOutside);
    };
  }, [isOpen, isTouchDevice]);

  return {
    isOpen,
    position,
    triggerRef,
    onMouseEnter,
    onMouseLeave,
    onTap,
    dismiss,
    isTouchDevice,
  };
}
```

**Step 2: Commit**

```bash
git add src/hooks/useHoverCard.ts
git commit -m "feat: add useHoverCard hook for positioning and interaction"
```

---

### Task 3: Build MemoryBubble Component

**Files:**
- Create: `src/components/hover-cards/MemoryBubble.tsx`

**Step 1: Build the component**

Handles single photo and film strip (crossfading) modes. Uses Next.js Image for optimization.

```tsx
// src/components/hover-cards/MemoryBubble.tsx
"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import type { MemoryBubbleData } from "@/data/hover-cards";

interface MemoryBubbleProps {
  data: MemoryBubbleData;
  href?: string;           // original link URL for mobile "Visit" button
  isTouchDevice: boolean;
}

export default function MemoryBubble({
  data,
  href,
  isTouchDevice,
}: MemoryBubbleProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const isFilmStrip = data.photos.length > 1;

  // Rotate photos every 3.5 seconds in film strip mode
  useEffect(() => {
    if (!isFilmStrip) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % data.photos.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [isFilmStrip, data.photos.length]);

  return (
    <div className="w-[240px] rounded-xl overflow-hidden bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-xl border border-gray-200/50 dark:border-gray-700/50">
      {/* Photo area */}
      <div className="relative w-full h-[160px] overflow-hidden bg-gray-100 dark:bg-gray-800">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0"
          >
            <Image
              src={data.photos[currentIndex]}
              alt={data.caption || "Memory"}
              fill
              className="object-cover"
              sizes="240px"
            />
          </motion.div>
        </AnimatePresence>

        {/* Film strip dots */}
        {isFilmStrip && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {data.photos.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                  i === currentIndex
                    ? "bg-white"
                    : "bg-white/40"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Caption area */}
      <div className="px-3 py-2 flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400 font-light">
          {data.caption}
        </span>
        {isTouchDevice && href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-blue-500 dark:text-blue-400 font-medium hover:underline"
          >
            Visit &rarr;
          </a>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/hover-cards/MemoryBubble.tsx
git commit -m "feat: add MemoryBubble component with film strip mode"
```

---

### Task 4: Build MusicOverlay Component

**Files:**
- Create: `src/components/hover-cards/MusicOverlay.tsx`

**Step 1: Build the component**

Handles audio playback at low volume with fade in/out, plus floating music note animation.

```tsx
// src/components/hover-cards/MusicOverlay.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface MusicOverlayProps {
  previewUrl: string;
  songTitle: string;
  artist: string;
  isActive: boolean;  // true when hover card is visible
}

const VOLUME = 0.15;
const FADE_DURATION = 400; // ms

// Floating music note that drifts upward and fades out
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
      ♪
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

  // Spawn floating notes while active
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

  // Audio fade in/out
  useEffect(() => {
    if (!previewUrl) return;

    if (isActive) {
      // Fade in
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
          audioRef.current.volume = Math.min(VOLUME, volumeStep * currentStep);
        }
        if (currentStep >= steps && fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current);
        }
      }, 50);
    } else {
      // Fade out
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
          audio.volume = Math.max(0, startVolume - volumeStep * currentStep);
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
      {/* Floating music notes */}
      <div className="absolute -top-2 right-0 w-8 h-12 pointer-events-none">
        <AnimatePresence>
          {noteKeys.map((key, i) => (
            <FloatingNote key={key} delay={i * 0.1} />
          ))}
        </AnimatePresence>
      </div>

      {/* Song info bar at bottom of card */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-3 pb-2 flex items-center gap-1.5"
          >
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              ♪ {songTitle} — {artist}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/hover-cards/MusicOverlay.tsx
git commit -m "feat: add MusicOverlay with audio fade and floating notes"
```

---

### Task 5: Build DefinitionCard Component

**Files:**
- Create: `src/components/hover-cards/DefinitionCard.tsx`

**Step 1: Build the component**

Typographic dictionary-style card, visually distinct from memory bubbles.

```tsx
// src/components/hover-cards/DefinitionCard.tsx
"use client";

import React from "react";
import type { DefinitionCardData } from "@/data/hover-cards";

interface DefinitionCardProps {
  data: DefinitionCardData;
}

export default function DefinitionCard({ data }: DefinitionCardProps) {
  return (
    <div className="w-[260px] rounded-xl overflow-hidden bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-xl border border-gray-200/50 dark:border-gray-700/50 px-4 py-3">
      {/* Term header */}
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="text-base font-serif font-semibold text-gray-900 dark:text-gray-100 italic">
          {data.term}
        </span>
        {data.greek && (
          <span className="text-xs text-gray-400 dark:text-gray-500 font-light">
            {data.greek}
          </span>
        )}
      </div>

      {/* Subtle divider */}
      <div className="w-8 h-px bg-gradient-to-r from-blue-400 to-emerald-400 mb-2" />

      {/* Definition */}
      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed font-light">
        {data.definition}
      </p>

      {/* Source */}
      {data.source && (
        <p className="mt-2 text-[10px] text-gray-400 dark:text-gray-500 italic">
          {data.source}
        </p>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/hover-cards/DefinitionCard.tsx
git commit -m "feat: add DefinitionCard component with dictionary style"
```

---

### Task 6: Build HoverTrigger Wrapper Component

**Files:**
- Create: `src/components/hover-cards/HoverTrigger.tsx`

**Step 1: Build the wrapper component**

This is the main integration point. Wraps any trigger element (link, button, text) and renders the appropriate card type on hover/tap. Uses React Portal for proper stacking.

```tsx
// src/components/hover-cards/HoverTrigger.tsx
"use client";

import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useHoverCard } from "@/hooks/useHoverCard";
import { hoverCards, type HoverCardData } from "@/data/hover-cards";
import MemoryBubble from "./MemoryBubble";
import DefinitionCard from "./DefinitionCard";
import MusicOverlay from "./MusicOverlay";

interface HoverTriggerProps {
  /** The key into the hoverCards data map */
  cardId: string;
  /** The original href for links (passed to mobile "Visit" button) */
  href?: string;
  /** The trigger content (the linked word, button, etc.) */
  children: React.ReactNode;
}

function CardContent({
  data,
  href,
  isTouchDevice,
  isOpen,
}: {
  data: HoverCardData;
  href?: string;
  isTouchDevice: boolean;
  isOpen: boolean;
}) {
  if (data.type === "definition") {
    return <DefinitionCard data={data} />;
  }

  // Memory bubble (with optional music)
  return (
    <div className="relative">
      <MemoryBubble data={data} href={href} isTouchDevice={isTouchDevice} />
      {data.song && data.song.previewUrl && (
        <MusicOverlay
          previewUrl={data.song.previewUrl}
          songTitle={data.song.title}
          artist={data.song.artist}
          isActive={isOpen}
        />
      )}
    </div>
  );
}

export default function HoverTrigger({
  cardId,
  href,
  children,
}: HoverTriggerProps) {
  const data = hoverCards[cardId];
  const {
    isOpen,
    position,
    triggerRef,
    onMouseEnter,
    onMouseLeave,
    onTap,
    isTouchDevice,
  } = useHoverCard();

  // If no hover card data for this ID, just render children as-is
  if (!data) {
    return <>{children}</>;
  }

  const handleClick = (e: React.MouseEvent) => {
    if (isTouchDevice) {
      e.preventDefault();
      onTap();
    }
    // On desktop, click follows the link normally (default behavior)
  };

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={handleClick}
        className="inline"
      >
        {children}
      </span>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isOpen && position && (
              <motion.div
                initial={{ opacity: 0, y: position.placement === "above" ? 8 : -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: position.placement === "above" ? 8 : -8, scale: 0.96 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                style={{
                  position: "fixed",
                  left: position.x,
                  top: position.placement === "above" ? "auto" : position.y,
                  bottom:
                    position.placement === "above"
                      ? `${window.innerHeight - position.y}px`
                      : "auto",
                  zIndex: 9999,
                }}
                className="pointer-events-auto"
              >
                <CardContent
                  data={data}
                  href={href}
                  isTouchDevice={isTouchDevice}
                  isOpen={isOpen}
                />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
```

**Step 2: Create barrel export**

```ts
// src/components/hover-cards/index.ts
export { default as HoverTrigger } from "./HoverTrigger";
export { default as MemoryBubble } from "./MemoryBubble";
export { default as DefinitionCard } from "./DefinitionCard";
export { default as MusicOverlay } from "./MusicOverlay";
```

**Step 3: Commit**

```bash
git add src/components/hover-cards/
git commit -m "feat: add HoverTrigger wrapper with portal rendering"
```

---

### Task 7: Integrate into AboutContent

**Files:**
- Modify: `src/components/AboutContent.tsx`

**Step 1: Wrap existing linked words with HoverTrigger**

Each existing `<a>` tag gets wrapped in `<HoverTrigger>`. The link itself stays as-is (desktop click still works). The HoverTrigger adds hover/tap card behavior.

For definition triggers, wrap the target text in a `<HoverTrigger>` with no link behavior.

**Key changes:**
1. Import `HoverTrigger` from `@/components/hover-cards`
2. Wrap Barcelona link with `<HoverTrigger cardId="barcelona" href="...">`
3. Wrap Barça link with `<HoverTrigger cardId="barca" href="...">`
4. Wrap Rice link with `<HoverTrigger cardId="rice" href="...">`
5. Wrap Veson Nautical link with `<HoverTrigger cardId="veson-nautical" href="...">`
6. Wrap "a good one" phrase with `<HoverTrigger cardId="good-life">`
7. Wrap "Iron sharpens iron" with `<HoverTrigger cardId="iron-sharpens-iron">`

**For definition triggers on plain text (not links):** Add a subtle underline style to hint they're interactive:
```tsx
<HoverTrigger cardId="good-life">
  <span className="underline decoration-dotted decoration-gray-300 dark:decoration-gray-600 underline-offset-2 cursor-default">
    a good one
  </span>
</HoverTrigger>
```

**Step 2: Verify the build compiles**

Run: `cd ~/Downloads/Dev/mikedouz-portfolio && npx next build`
Expected: Build succeeds with no type errors.

**Step 3: Test locally**

Run: `npx next dev`
- Hover over "Barcelona" — memory bubble should appear (with placeholder image paths, may show broken images until real photos added)
- Hover over "a good one" — definition card should appear with eudaimonia definition
- On mobile viewport — tap to reveal, tap elsewhere to dismiss

**Step 4: Commit**

```bash
git add src/components/AboutContent.tsx
git commit -m "feat: integrate hover cards into About section links"
```

---

### Task 8: Add Placeholder Photos for Testing

**Files:**
- Create: `public/images/memories/placeholder.jpg` (or use generated colored placeholders)

**Step 1: Create simple colored placeholder images**

For testing before Mike provides real photos, create small colored SVG placeholders or use a single test image. Alternatively, add a fallback to MemoryBubble that renders a colored div when the image fails to load.

Update `MemoryBubble.tsx` to handle missing images gracefully:
- Add `onError` handler to `<Image>` that swaps to a colored fallback div
- The fallback shows the caption text centered on a gradient background

**Step 2: Verify all hover triggers work with placeholders**

Run: `npx next dev`
Test each trigger: Barcelona, Barça, Rice, Veson Nautical, "a good one", "Iron sharpens iron"

**Step 3: Commit**

```bash
git add public/images/memories/ src/components/hover-cards/MemoryBubble.tsx
git commit -m "feat: add image fallback and placeholder support"
```

---

### Task 9: Final Polish and Build Verification

**Files:**
- All hover-cards components (review pass)

**Step 1: Run full build**

Run: `cd ~/Downloads/Dev/mikedouz-portfolio && npx next build`
Expected: Clean build, no errors, no warnings.

**Step 2: Test dark mode**

Verify all three card types look correct in both light and dark mode.

**Step 3: Test mobile behavior**

Using browser dev tools mobile viewport:
- Tap triggers show card
- "Visit" link appears in memory bubbles
- Tap outside dismisses
- Scroll dismisses

**Step 4: Push branch**

```bash
git push -u origin feature/hover-memories
```

---

## Photo Sourcing (Manual Step — Mike)

After the components are built, Mike needs to:
1. Select photos from iCloud for each trigger (Barcelona, Barça, Rice, Veson Nautical)
2. Drop them into `public/images/memories/` with the filenames matching the data file
3. Update `src/data/hover-cards.ts` with correct filenames and captions
4. For music memories: find Spotify preview URLs for associated songs

## Future Expansion

Adding a new hover card anywhere on the site:
1. Add entry to `hoverCards` in `src/data/hover-cards.ts`
2. Wrap the trigger text with `<HoverTrigger cardId="new-id">` in the component
3. Drop any photos into `public/images/memories/`
4. Done — no new components needed
