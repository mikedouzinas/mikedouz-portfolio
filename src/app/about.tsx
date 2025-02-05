"use client";

import { useState } from "react";

export default function About() {
  // Slides array: each slide has an image and a description
  const slides = [
    {
      img: "/about1.jpg",
      alt: "Photo 1",
      text: "My first journey: Studying abroad in Greece.",
    },
    {
      img: "/about2.jpg",
      alt: "Photo 2",
      text: "Exploring coding and hackathons at Rice University.",
    },
    {
      img: "/about3.jpg",
      alt: "Photo 3",
      text: "Interning at a startup and learning real-world development.",
    },
  ];

  const [currentSlide, setCurrentSlide] = useState(0);

  // Helper functions for navigation
  const handlePrev = () => {
    setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };
  const handleNext = () => {
    setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
  };

  return (
    <section id="about" className="min-h-screen py-16 bg-gray-50 flex flex-col items-center">
      {/* Centered Header */}
      <h1 className="text-4xl font-bold mb-8 text-center">About Me</h1>

      {/* Carousel & Text Container */}
      <div className="flex flex-col md:flex-row items-center justify-center w-full max-w-5xl">
        {/* Left Side: Carousel */}
        <div className="relative w-full md:w-1/2 flex items-center justify-center mb-8 md:mb-0">
          {/* Image */}
          <img
            src={slides[currentSlide].img}
            alt={slides[currentSlide].alt}
            className="w-80 h-80 object-cover rounded-lg shadow-md"
          />

          {/* Left Arrow */}
          <button
            onClick={handlePrev}
            className="absolute left-2 text-gray-800 bg-white/80 rounded-full p-2 hover:bg-white shadow-md"
          >
            ◀
          </button>

          {/* Right Arrow */}
          <button
            onClick={handleNext}
            className="absolute right-2 text-gray-800 bg-white/80 rounded-full p-2 hover:bg-white shadow-md"
          >
            ▶
          </button>

          {/* Slide Indicator */}
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-white/80 rounded px-2 py-1 text-sm shadow-md">
            {`Slide ${currentSlide + 1} of ${slides.length}`}
          </div>
        </div>

        {/* Right Side: Text */}
        <div className="md:w-1/2 px-4">
          <p className="text-xl text-gray-700 mb-4">
            {slides[currentSlide].text}
          </p>
          <p className="text-lg text-gray-600">
            I’m Mike Veson, a passionate Computer Science student at Rice University.
            I love solving problems through technology and innovation. Each photo
            represents a key milestone in my personal or academic journey.
          </p>
        </div>
      </div>
    </section>
  );
}
