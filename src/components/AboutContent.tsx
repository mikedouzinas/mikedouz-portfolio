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
        I&apos;m <strong className="font-semibold">Mike Veson</strong>, a
        Computer Science major at{" "}
        <a 
          href="https://www.rice.edu" 
          target="_blank" 
          rel="noopener noreferrer"
          className="hover:opacity-80 transition-opacity"
        >
          <span className="font-semibold bg-gradient-to-r from-blue-600 to-gray-600 dark:from-blue-400 dark:to-gray-400 text-transparent bg-clip-text">
            Rice University
          </span>
        </a>{" "}
        studying abroad in{" "}
        <a 
          href="https://www.salleurl.edu/en" 
          target="_blank" 
          rel="noopener noreferrer"
          className="hover:opacity-80 transition-opacity"
        >
          <span className="font-semibold bg-gradient-to-r from-red-600 to-yellow-500 dark:from-red-500 dark:to-yellow-400 text-transparent bg-clip-text">
            Barcelona
          </span>
        </a>
        . I grew up around{" "}
        <a 
          href="https://veson.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="hover:opacity-80 transition-opacity"
        >
          <span className="font-semibold bg-gradient-to-r from-blue-700 to-orange-600 dark:from-blue-400 dark:to-orange-400 text-transparent bg-clip-text">
            shipping software
          </span>
        </a>{" "}
        and learned early that the best products don&apos;t just solve problems, they change how people{" "}
        <em className="italic">experience</em> their work.
      </p>

      {expanded && (
        <>
          <p className={`mb-3 ${textClassName} leading-relaxed`}>
            I&apos;ve shipped{" "}
            <strong className="font-semibold">mobile apps</strong>,{" "}
            <strong className="font-semibold">AI systems</strong>,{" "}
            <strong className="font-semibold">data pipelines</strong>, and tools
            that compress days of work into minutes. But what I obsess over is that experience itself: the details most people skip, 
            that gap between something that works and something you keep coming back to.
          </p>
          <p className={`mb-3 ${textClassName} leading-relaxed`}>
            Explore my work below.
          </p>
          <p className={`${textClassName} leading-relaxed`}>
            
            Or, you could <strong className="font-semibold">experience</strong>{" "} it.{" "} With {" "}
            <button 
              onClick={handleIrisClick}
              className="hover:opacity-80 transition-opacity inline-block focus:outline-none"
            >
              <span className="font-semibold bg-gradient-to-r from-blue-500 via-emerald-500 to-blue-500 dark:from-blue-400 dark:via-emerald-400 dark:to-blue-400 text-transparent bg-clip-text">
                Iris.
              </span>
            </button>{" "}
          </p>
        </>
      )}
    </div>
  );
}