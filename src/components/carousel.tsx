// src/components/Carousel.tsx
"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Reusable slide variants
const slideVariants = {
    enter: (direction: number) => ({
        x: direction > 0 ? 150 : -150,
        opacity: 0,
    }),
    center: {
        x: 0,
        opacity: 1,
    },
    exit: (direction: number) => ({
        x: direction < 0 ? 150 : -150,
        opacity: 0,
    }),
};

interface CarouselProps<T> {
    items: T[];
    renderItem: (item: T) => React.ReactNode;
    itemsPerPage?: number;
    sectionTitle?: string;
    sectionId?: string;
}

export default function Carousel<T>({
    items,
    renderItem,
    itemsPerPage = 1,
    sectionTitle,
    sectionId,
}: CarouselProps<T>) {
    const [currentPage, setCurrentPage] = useState(0);
    const [direction, setDirection] = useState(0);

    const totalPages = Math.ceil(items.length / itemsPerPage);

    const nextPage = () => {
        setDirection(1);
        setCurrentPage((prev) => (prev + 1) % totalPages);
    };

    const prevPage = () => {
        setDirection(-1);
        setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages);
    };

    // Slice the items for the current “page”
    const pageStart = currentPage * itemsPerPage;
    const currentItems = items.slice(pageStart, pageStart + itemsPerPage);

    return (
        <section
            id={sectionId}
            className="min-h-[10vh] bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 py-16 px-6 flex flex-col items-center"
        >
            {sectionTitle && (
                <motion.h2
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    viewport={{ once: true }}
                    className="text-4xl font-bold mb-8 text-center"
                >
                    {sectionTitle}
                </motion.h2>
            )}

            {/* Animated Container */}
            <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                    key={currentPage}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className={`w-full max-w-7xl 
            grid grid-cols-1 
            ${itemsPerPage > 1 ? "md:grid-cols-2" : ""}
            gap-8`}
                >
                    {currentItems.map((item, index) => (
                        <React.Fragment key={index}>{renderItem(item)}</React.Fragment>
                    ))}
                </motion.div>
            </AnimatePresence>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center mt-8 space-x-6">
                    <button
                        onClick={prevPage}
                        className="p-2 rounded-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        aria-label="Previous Page"
                    >
                        <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-200" />
                    </button>


                    {/* Dot Indicators */}
                    <div className="flex space-x-2">
                        {Array.from({ length: totalPages }).map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => {
                                    setDirection(idx > currentPage ? 1 : -1);
                                    setCurrentPage(idx);
                                }}
                                className={`w-3 h-3 rounded-full transition-colors ${currentPage === idx ? "bg-blue-500" : "bg-gray-400"
                                    }`}
                                aria-label={`Go to page ${idx + 1}`}
                            />
                        ))}
                    </div>

                    <button
                        onClick={nextPage}
                        className="p-2 rounded-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        aria-label="Next Page"
                    >
                        <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-200" />
                    </button>

                </div>
            )}
        </section>
    );
}
