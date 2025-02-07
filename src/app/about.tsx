"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Updated "About" section
 * - Replaces the range slider with left/right arrows & dot indicators (like Work Experience).
 * - Wraps the left image in a "widget" style similar to the home profile image.
 * - Animates slides horizontally instead of fading or moving vertically.
 */

// Slide content
const slides = [
  {
    img: "/about1.png",
    alt: "Photo 1",
    text: (
      <>
        I grew up in a <span className="font-semibold">startup environment</span>, watching my parents build{" "}
        <span className="font-semibold">Veson Nautical</span> from an idea into a global company. Being surrounded by{" "}
        <span className="font-semibold">problem-solving</span> and <span className="font-semibold">iteration</span> 
        {" "}from a young age taught me that <span className="font-semibold">great products come from real-world understanding, not just code.</span>
      </>
    ),
  },
  {
    img: "/about2.JPG",
    alt: "Photo 2",
    text: (
      <>
        Being <span className="font-semibold">Greek</span> isn’t just heritage—it’s <span className="font-semibold">identity</span>.
        Summers in <span className="font-semibold">Greece</span>, speaking the language, and immersing in traditions 
        shaped how I see the world. My background influences my <span className="font-semibold">perspective, my connections, and my approach to challenges</span>, 
        always balancing <span className="font-semibold">logic with storytelling.</span>
      </>
    ),
  },
  {
    img: "/about3.JPG",
    alt: "Photo 3",
    text: (
      <>
        I've always been passionate about <span className="font-semibold">soccer</span>—playing, watching, and analyzing it. 
        As a <span className="font-semibold">Barcelona fan</span>, I love the <span className="font-semibold">strategy and precision</span> behind the game. 
        That passion led me to <span className="font-semibold">sports analytics</span>, where I use{" "}
        <span className="font-semibold">software to evaluate player performance</span> and optimize tactics.
      </>
    ),
  },
  {
    img: "/about4.jpeg",
    alt: "Photo 4",
    text: (
      <>
        This is <span className="font-semibold">Poros</span>, the island where my{" "}
        <span className="font-semibold">grandfather was born</span>. Coming here always gives me{" "}
        <span className="font-semibold">perspective</span>—a place to{" "}
        <span className="font-semibold">reflect, reset, and think big. </span> 
        Some of my best ideas have come from moments like this, away from screens and in{" "}
        <span className="font-semibold">deep thought.</span>
      </>
    ),
  },
  {
    img: "/about5.jpeg",
    alt: "Photo 5",
    text: (
      <>
        I’ve always been a <span className="font-semibold">morning person</span>. 
        There’s something about the quiet energy of the morning, the fresh start, and the time to think before the world fully wakes up. 
        Whether I’m walking to work, grabbing coffee, or planning my day, mornings give me clarity and focus. 
        That daily rhythm—moving through the city, setting intentions—keeps me <span className="font-semibold">driven and ready to build.</span>
      </>
    ),
  },
];

// Direction-based variants for horizontal slide animation
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

export default function About() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);

  const totalSlides = slides.length;

  const nextSlide = () => {
    setDirection(1);
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  };

  const prevSlide = () => {
    setDirection(-1);
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  return (
    <section id="about" className="min-h-[80vh] py-16 bg-gray-50 dark:bg-gray-900 flex flex-col items-center">

      {/* Centered Header */}
      <h1 className="text-4xl font-bold mb-4 text-center text-gray-800 dark:text-gray-200">About Me</h1>

      {/* Static Intro Text */}
      <p className="mb-10 text-lg text-gray-700 dark:text-gray-300 max-w-3xl text-center">
        I’m Mike Veson, a computer science student, entrepreneur, and data-driven thinker devoted to building impactful technology. 
        My journey has taken me through software engineering, machine learning, and product development, all driven by my curiosity and 
        love for problem-solving.
        <br />
        <br />
        Beyond coding, I’m deeply into finance, sports analytics, and AI’s potential in industries like maritime, healthcare, and entertainment.
      </p>

      {/* Animated Main Content Container */}
      <div className="relative w-full max-w-5xl mb-6 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentSlide}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="flex flex-col md:flex-row items-center justify-center px-4"
          >
            {/* Left: "Widget" style for the image */}
            <div className="w-full md:w-1/2 flex items-center py-4 justify-center mb-8 md:mb-0">
              <div className="inline-block align-middle mx-3">
                <div className="w-[20rem] h-[20rem] rounded-3xl border-4 border shadow-lg inline-flex items-center justify-center">
                  <img
                    src={slides[currentSlide].img}
                    alt={slides[currentSlide].alt}
                    className="w-[19rem] h-[19rem] rounded-2xl object-cover"
                  />
                </div>
              </div>
            </div>

            {/* Right: Dynamic Text */}
            <div className="md:w-1/2 px-4">
            <p className="text-xl text-gray-700 dark:text-gray-300">{slides[currentSlide].text}</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation Controls (Arrows + Dots) */}
      <div className="flex flex-col items-center gap-4">
        {/* Arrow Buttons */}
        <div className="flex space-x-4">
          <button
            onClick={prevSlide}
            className="p-2 rounded-full bg-white border border-gray-300 hover:bg-gray-200 transition-colors"
            aria-label="Previous Slide"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={nextSlide}
            className="p-2 rounded-full bg-white border border-gray-300 hover:bg-gray-200 transition-colors"
            aria-label="Next Slide"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Dot Indicators */}
        <div className="flex space-x-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                setDirection(idx > currentSlide ? 1 : -1);
                setCurrentSlide(idx);
              }}
              className={`w-3 h-3 rounded-full transition-colors ${
                currentSlide === idx ? "bg-blue-500" : "bg-gray-400"
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
