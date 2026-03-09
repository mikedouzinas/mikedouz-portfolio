"use client";

import React from 'react';

interface AboutContentProps {
  /**
   * Whether to show the full bio or just the first paragraph
   */
  expanded?: boolean;
  /**
   * Additional CSS classes for text styling
   */
  textClassName?: string;
  /**
   * Additional CSS classes for the container
   */
  containerClassName?: string;
  /**
   * Callback for when the Iris link is clicked
   * If not provided, defaults to dispatching 'mv-open-cmdk'
   */
  onIrisClick?: () => void;
}

/**
 * Shared About content component
 * Used in both AboutSheet (mobile) and about_section (desktop)
 */
export default function AboutContent({
  expanded = false,
  textClassName = "text-sm font-light text-gray-600 dark:text-gray-400",
  containerClassName = "",
  onIrisClick
}: AboutContentProps) {
  const handleIrisClick = () => {
    if (onIrisClick) {
      onIrisClick();
    } else {
      window.dispatchEvent(new CustomEvent('mv-open-cmdk'));
    }
  };

  return (
    <div className={containerClassName}>
      <p className={`mb-3 ${textClassName} leading-relaxed`}>
        I spent most of college doing what I believed I <em>should</em> be doing as opposed to what I <em>wanted</em> to do. Obsessing over grades, filling my life with noise, thinking I needed a good job to be happy. Then I let go of that. I went to{" "}
        <a
          href="https://www.salleurl.edu/en"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:opacity-80 transition-opacity"
        >
          <span className="font-semibold bg-gradient-to-r from-red-600 to-yellow-500 dark:from-red-500 dark:to-yellow-400 text-transparent bg-clip-text">
            Barcelona
          </span>
        </a>{" "}
        and somewhere along the way my perception of success changed and how I felt before no longer made any sense.
      </p>

      {expanded && (
        <>
          <p className={`mb-3 ${textClassName} leading-relaxed`}>
            I got to see my lifelong club{" "}
            <a
              href="https://youtu.be/9V2guLT3S14?si=I8x2_s2vhjppaj-d"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity"
            >
              <span className="font-semibold bg-gradient-to-r from-blue-800 to-red-700 dark:from-blue-500 dark:to-red-500 text-transparent bg-clip-text">
                Barça
              </span>
            </a>{" "}
            play at the Camp Nou, speak with amazing new people in Greek, Spanish, English, and very poorly in Catalan, and more unexpectedly but most importantly, I spent so much time alone. I was forced into looking at my life and understanding not only what I want from it, but what it means to live a good one, and I came back to{" "}
            <a
              href="https://www.rice.edu"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity"
            >
              <span className="font-semibold bg-gradient-to-r from-blue-600 to-gray-600 dark:from-blue-400 dark:to-gray-400 text-transparent bg-clip-text">
                Rice
              </span>
            </a>{" "}
            with a completely different idea of how I want to live.
          </p>
          <p className={`mb-3 ${textClassName} leading-relaxed`}>
            I&apos;m a junior computer science major at Rice from Boston, but what I study is not what I care about. I&apos;m writing movies, books, and philosophy, and building technology as a means to help people know themselves and live well. I grew up watching my parents build{" "}
            <a
              href="https://veson.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity"
            >
              <span className="font-semibold bg-gradient-to-r from-blue-700 to-orange-600 dark:from-blue-400 dark:to-orange-400 text-transparent bg-clip-text">
                Veson Nautical
              </span>
            </a>{" "}
            from the ground up and I learned young how to build software, talk with people, and understand problems. I don&apos;t want that to be my entire life, but I&apos;m grateful to have those skills to help me live the life I want to and to help others do so too.
          </p>
          <p className={`${textClassName} leading-relaxed`}>
            I hope this website gives you a window into my life, and if anything interests you, ask{" "}
            <button
              onClick={handleIrisClick}
              className="hover:opacity-80 transition-opacity inline-block focus:outline-none"
            >
              <span className="font-semibold bg-gradient-to-r from-blue-500 via-emerald-500 to-blue-500 dark:from-blue-400 dark:via-emerald-400 dark:to-blue-400 text-transparent bg-clip-text">
                Iris
              </span>
            </button>{" "}
            about it or reach out if you want to talk more. Iron sharpens iron.
          </p>
        </>
      )}
    </div>
  );
}
