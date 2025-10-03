"use client";
import { useState, useEffect } from "react";

export default function AboutSection() {
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile devices
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const mobileKeywords = ['mobile', 'iphone', 'ipad', 'android', 'blackberry', 'nokia', 'opera mini'];
      setIsMobile(mobileKeywords.some(keyword => userAgent.includes(keyword)));
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleHeroClick = () => {
    if (!isMobile) {
      window.dispatchEvent(new CustomEvent('mv-open-cmdk'));
    }
  };
  return (
    <section
      id="about"
      className="min-h-[50vh] py-4 bg-gray-50 dark:bg-gray-900 flex flex-col items-center"
    >
      <div className="max-w-[42rem] mx-auto w-full relative">
        <div className="max-w-2xl mx-auto px-4">
          <p className="mb-4 text-md font-light text-gray-600 dark:text-gray-400">
            I&apos;m <strong className="font-semibold">Mike Veson</strong>, a{" "}
            <span className="font-semibold bg-gradient-to-r from-blue-600 to-blue-300 dark:from-blue-600 dark:to-white text-transparent bg-clip-text">
              Greek
            </span>
            <span role="img" aria-label="Greek flag" className="ml-1 align-middle">🇬🇷</span>
            -
            <span className="font-semibold bg-gradient-to-r from-red-600 via-blue-300 to-blue-600 dark:from-red-600 dark:via-white dark:to-blue-300 text-transparent bg-clip-text">
              American
            </span>
            <span role="img" aria-label="United States flag" className="ml-1 align-middle">🇺🇸</span>{" "}
            Computer Science major at{" "}
            <span className="font-semibold bg-gradient-to-r from-blue-500 to-gray-500 text-transparent bg-clip-text">
              Rice University
            </span>{" "}
            🦉 who loves building things that make life easier. I grew up around{" "}
            <span className="font-semibold bg-gradient-to-r from-blue-600 to-orange-500 text-transparent bg-clip-text">
              shipping software
            </span>{" "}
            🚢 and learned early how tech can transform industries and power
            products that people rely on.
          </p>

          <p className="mb-4 text-md font-light text-gray-600 dark:text-gray-400">
            I&apos;m a fast learner, I break down big problems into clear steps, and always
            put users first. I&apos;ve worked everywhere from shipping software to
            defense, usually in software engineering, product, and client-facing
            roles. My primary technical skillset spans{" "}
            <strong className="font-semibold">
              Mobile, Web, Backend, and Data Engineering
            </strong>
            , but I&apos;m always learning new skills and pushing myself to take on new challenges.
          </p>

          <p className="mb-4 text-md font-light text-gray-600 dark:text-gray-400">
            Outside of CS, I love soccer ⚽ (or football, wherever you&apos;re
            from). It&apos;s been a life goal of mine to understand players and
            teams better through data. I&apos;ve built analytics tools, highlight
            generators, and reached the{" "}
            <strong className="font-semibold">top 3%</strong> in Euro 2024
            predictions. I&apos;m also studying abroad in{" "}
            <span className="font-semibold bg-gradient-to-r from-red-600 to-blue-600 text-transparent bg-clip-text">
              Barcelona
            </span>{" "}
            this Fall, where I&apos;ll keep exploring new cultures while
            improving my Greek and Spanish.
          </p>

          <p className="mb-6 text-md font-light text-gray-600 dark:text-gray-400">
            Long-term, I want to build products that meaningfully help people
            at scale. If you&apos;re working on challenges in{" "}
            <strong className="font-semibold">big tech</strong> 🖥️,{" "}
            <strong className="font-semibold">finance</strong> 💰,{" "}
            <strong className="font-semibold">shipping</strong> 🚢, or any space
            where fast learners who connect{" "}
            <strong className="font-semibold">customer needs</strong> to{" "}
            <strong className="font-semibold">fast output</strong> are valuable,
            let&apos;s connect.
          </p>

          {/* Hero Button for Command Palette */}
          <div className="flex justify-center mt-8">
            <button
              onClick={handleHeroClick}
              disabled={isMobile}
              className={`group relative inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-500 hover:from-blue-700 hover:via-purple-700 hover:to-blue-600 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 hover:-translate-y-0.5 ${isMobile ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="text-lg">Learn more about me</span>
              {!isMobile && (
                <div className="flex items-center gap-1 text-sm opacity-90 group-hover:opacity-100 transition-opacity">
                  <span className="font-mono bg-black/20 px-2 py-0.5 rounded text-xs">⌘K</span>
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
