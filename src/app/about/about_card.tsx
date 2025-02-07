// src/components/AboutCard.tsx
"use client";

import { motion } from "framer-motion";
import { AboutSlide } from "@/data/about";

interface AboutCardProps {
  slide: AboutSlide;
}

export default function AboutCard({ slide }: AboutCardProps) {
  return (
    <motion.div className="flex flex-col md:flex-row items-center justify-center px-4">
      {/* Left: Image */}
      <div className="w-full md:w-1/2 flex items-center justify-center py-4 mb-8 md:mb-0 bg-transparent">
        <img
          src={slide.img}
          alt={slide.alt}
          className="w-[19rem] h-[19rem] rounded-2xl object-cover shadow-lg"
        />
      </div>
      {/* Right: Text */}
      <div className="md:w-1/2 px-4">
        <p className="text-xl text-gray-700 dark:text-gray-300">{slide.text}</p>
      </div>
    </motion.div>
  );
}
