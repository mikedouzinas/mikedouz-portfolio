// src/components/BaseCard.tsx
"use client";

import React from "react";
import { motion, MotionProps } from "framer-motion";
import clsx from "clsx";
import ContainedMouseGlow from "./ContainedMouseGlow";

export interface BaseCardProps extends MotionProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  href?: string;
  // Enable contained mouse glow with optional custom color
  // Color should be RGB values as string (e.g., "147, 197, 253" for blue)
  glowColor?: string;
  glowIntensity?: number;
}

export default function BaseCard({
  children,
  className,
  onClick,
  href,
  glowColor = "147, 197, 253", // Default: light blue
  glowIntensity = 0.3,
  initial = { opacity: 0, y: 10 },
  animate = { opacity: 1, y: 0 },
  exit = { opacity: 0, y: -10 },
  transition = { duration: 0.3 },
  ...motionProps
}: BaseCardProps) {
  const handleClick = () => {
    if (href) {
      window.open(href, "_blank");
    }
    onClick?.();
  };

  return (
    <motion.div
      onClick={handleClick}
      role={href || onClick ? "link" : undefined}
      tabIndex={href || onClick ? 0 : undefined}
      initial={initial}
      animate={animate}
      exit={exit}
      transition={transition}
      // Data attribute signals to MouseGlow component to hide global glow when hovering
      data-has-contained-glow="true"
      className={clsx(
        "max-w-[42rem] mx-auto w-full relative rounded-xl overflow-hidden",
        "md:hover:shadow-lg mb-6 cursor-pointer group",
        "md:hover:bg-gradient-to-br md:hover:from-gray-100 md:hover:to-gray-200 md:hover:bg-opacity-80",
        "dark:md:hover:from-gray-800 dark:md:hover:to-gray-700 dark:md:hover:bg-opacity-80",
        className
      )}
      {...motionProps}
    >
      {/* Contained mouse glow that follows cursor within card boundaries */}
      <ContainedMouseGlow color={glowColor} intensity={glowIntensity} />
      
      <div className="max-w-2xl mx-auto px-4 py-6 relative z-10">
        {children}
      </div>
    </motion.div>
  );
}
