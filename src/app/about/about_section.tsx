// src/app/about/about_section.tsx
"use client";

import Carousel from "@/components/carousel";
import AboutCard from "@/app/about/about_card";
import { aboutSlides } from "@/data/about";

export default function AboutSection() {
  return (
    <section
      id="about"
      className="min-h-[80vh] py-16 bg-gray-50 dark:bg-gray-900 flex flex-col items-center"
    >
      {/* Centered Header */}
      <h1 className="text-4xl font-bold mb-4 text-center text-gray-800 dark:text-gray-200">
        About Me
      </h1>

      {/* Static Intro Text */}
      <p className="mb-10 text-lg text-gray-700 dark:text-gray-300 max-w-3xl text-center">
        I’m Mike Veson...
      </p>

      {/* Reusable Carousel for the “slides” portion */}
      <Carousel
        items={aboutSlides}
        itemsPerPage={1}
        renderItem={(slide) => <AboutCard slide={slide} />}
        // we won't pass sectionTitle so it doesn’t render the heading again
      />
    </section>
  );
}
