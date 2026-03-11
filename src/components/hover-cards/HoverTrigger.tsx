"use client";

import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useHoverCard } from "@/hooks/useHoverCard";
import {
  hoverCards,
  type HoverCardData,
  type DefinitionCardData,
} from "@/data/hover-cards";
import MemoryBubble from "./MemoryBubble";
import DefinitionCard from "./DefinitionCard";
import MusicOverlay from "./MusicOverlay";

interface HoverTriggerProps {
  cardId?: string;
  inlineData?: HoverCardData;
  /** ID of a definition card to show below memory bubble photos */
  definitionId?: string;
  href?: string;
  variant?: "portfolio" | "blog";
  children: React.ReactNode;
}

function CardContent({
  data,
  href,
  isTouchDevice,
  isOpen,
  variant = "portfolio",
  definition,
}: {
  data: HoverCardData;
  href?: string;
  isTouchDevice: boolean;
  isOpen: boolean;
  variant?: "portfolio" | "blog";
  definition?: DefinitionCardData;
}) {
  if (data.type === "definition") {
    return <DefinitionCard data={data} variant={variant} />;
  }

  return (
    <div className="relative">
      <MemoryBubble
        data={data}
        href={href}
        isTouchDevice={isTouchDevice}
        definition={definition}
      />
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
  inlineData,
  definitionId,
  href,
  variant = "portfolio",
  children,
}: HoverTriggerProps) {
  const data = inlineData || (cardId ? hoverCards[cardId] : undefined);
  const definition = definitionId
    ? (hoverCards[definitionId] as DefinitionCardData | undefined)
    : undefined;
  const {
    isOpen,
    position,
    triggerRef,
    onMouseEnter,
    onMouseLeave,
    onTap,
    isTouchDevice,
  } = useHoverCard();

  if (!data) {
    return <>{children}</>;
  }

  const handleClick = (e: React.MouseEvent) => {
    if (isTouchDevice) {
      e.preventDefault();
      onTap();
    }
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
                initial={{
                  opacity: 0,
                  y: position.placement === "above" ? 8 : -8,
                  scale: 0.96,
                }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{
                  opacity: 0,
                  y: position.placement === "above" ? 8 : -8,
                  scale: 0.96,
                }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                style={{
                  position: "fixed",
                  left: position.x,
                  top:
                    position.placement === "above" ? "auto" : position.y,
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
                  variant={variant}
                  definition={definition}
                />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
