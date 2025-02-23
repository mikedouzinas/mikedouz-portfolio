// src/components/BaseCard.tsx
"use client";

import React from "react";
import { motion, MotionProps } from "framer-motion";
import clsx from "clsx";

export interface BaseCardProps extends MotionProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  href?: string;
}

export default function BaseCard({
  children,
  className,
  onClick,
  href,
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
      className={clsx(
        "max-w-[42rem] mx-auto w-full relative rounded-xl",
        "md:hover:shadow-lg mb-6 cursor-pointer",
        "md:hover:bg-gradient-to-br md:hover:from-gray-100 md:hover:to-gray-200 md:hover:bg-opacity-80",
        "dark:md:hover:from-gray-800 dark:md:hover:to-gray-700 dark:md:hover:bg-opacity-80",
        className
      )}
      {...motionProps}
    >
      <div className="max-w-2xl mx-auto px-4 py-6">
        {children}
      </div>
    </motion.div>
  );
}
