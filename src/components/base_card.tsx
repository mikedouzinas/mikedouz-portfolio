// src/components/BaseCard.tsx
"use client";

import React from "react";
import { motion, MotionProps } from "framer-motion";
import clsx from "clsx";

interface BaseCardProps extends MotionProps {
  children: React.ReactNode;
  className?: string;
}

export default function BaseCard({
  children,
  className,
  initial = { opacity: 0, y: 10 },
  animate = { opacity: 1, y: 0 },
  exit = { opacity: 0, y: -10 },
  transition = { duration: 0.3 },
  ...motionProps
}: BaseCardProps) {
  return (
    <motion.div
      initial={initial}
      animate={animate}
      exit={exit}
      transition={transition}
      className={clsx(
        "relative p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700",
        "transition-all ease-in-out",
        "h-[250px] flex flex-col overflow-hidden", 
        "bg-gradient-to-br from-white to-gray-100",
        "dark:from-gray-800 dark:to-gray-700",
        className
      )}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
}
