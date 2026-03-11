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

const CARD_WIDTH = 280;
const CARD_HEIGHT = 200;
const OFFSET_Y = 12;

export function useHoverCard(): UseHoverCardReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setIsTouchDevice(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return null;

    // Use getClientRects to get per-line rects for wrapped text
    const rects = triggerRef.current.getClientRects();
    const fallbackRect = triggerRef.current.getBoundingClientRect();

    // Use the first line rect for positioning (where the user is reading)
    const anchorRect = rects.length > 0 ? rects[0] : fallbackRect;
    const viewportWidth = window.innerWidth;

    const spaceAbove = anchorRect.top;
    const placement =
      spaceAbove > CARD_HEIGHT + OFFSET_Y ? "above" : "below";

    // Position horizontally centered on the anchor rect, clamped to viewport
    let x = anchorRect.left + anchorRect.width / 2 - CARD_WIDTH / 2;
    x = Math.max(8, Math.min(x, viewportWidth - CARD_WIDTH - 8));

    const y =
      placement === "above"
        ? anchorRect.top - OFFSET_Y
        : anchorRect.bottom + OFFSET_Y;

    return { x, y, placement } as Position;
  }, []);

  const onMouseEnter = useCallback(() => {
    if (isTouchDevice) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setPosition(calculatePosition());
    setIsOpen(true);
  }, [isTouchDevice, calculatePosition]);

  const onMouseLeave = useCallback(() => {
    if (isTouchDevice) return;
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

  // Dismiss on scroll
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
