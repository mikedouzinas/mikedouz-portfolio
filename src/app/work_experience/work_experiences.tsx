"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ExperienceCard from "./experience_card";
import { workExperiences } from "@/data/workExperiences";

const ITEMS_PER_VIEW = 2;

/**
 * Variants for direction-based animation:
 * - When moving to the next page, the card slides in from the right.
 * - When moving to the previous page, the card slides in from the left.
 */
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 50 : -50,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 50 : -50,
    opacity: 0,
  }),
};

export default function ExperienceGallery() {
  const [currentPage, setCurrentPage] = useState(0);
  // direction = +1 (next), -1 (prev)
  const [direction, setDirection] = useState(0);

  const totalPages = Math.ceil(workExperiences.length / ITEMS_PER_VIEW);

  const nextPage = () => {
    setDirection(1);
    setCurrentPage((prev) => (prev + 1) % totalPages);
  };

  const prevPage = () => {
    setDirection(-1);
    setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages);
  };

  const pageStart = currentPage * ITEMS_PER_VIEW;
  const currentItems = workExperiences.slice(pageStart, pageStart + ITEMS_PER_VIEW);

  return (
    <section
      id="experience"
      className="min-h-screen bg-gray-50 text-gray-800 py-16 px-4 flex flex-col items-center"
    >
      <motion.h2
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        viewport={{ once: true }}
        className="text-4xl font-bold mb-8 text-center"
      >
        Work Experience
      </motion.h2>

      {/* Animated Card Grid */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentPage}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.3 }}
          className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {currentItems.map((exp) => (
            <ExperienceCard key={exp.id} item={exp} />
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Pagination Controls */}
      <div className="flex justify-center items-center mt-8 space-x-6">
        <button
          onClick={prevPage}
          className="p-2 rounded-full bg-white border border-gray-300 hover:bg-gray-200 transition-colors"
          aria-label="Previous Page"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>

        {/* Dots */}
        <div className="flex space-x-2">
          {Array.from({ length: totalPages }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentPage(idx)}
              className={`w-3 h-3 rounded-full transition-colors ${
                currentPage === idx ? "bg-blue-500" : "bg-gray-400"
              }`}
              aria-label={`Go to page ${idx + 1}`}
            />
          ))}
        </div>

        <button
          onClick={nextPage}
          className="p-2 rounded-full bg-white border border-gray-300 hover:bg-gray-200 transition-colors"
          aria-label="Next Page"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>
    </section>
  );
}
