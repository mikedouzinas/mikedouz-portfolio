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
        I&apos;m <strong className="font-semibold">Mike Veson</strong>, a junior at{" "}
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
        studying computer science, probably graduating May 2027. Grew up in Boston watching my parents build{" "}
        <a
          href="https://veson.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:opacity-80 transition-opacity"
        >
          <span className="font-semibold bg-gradient-to-r from-blue-700 to-orange-600 dark:from-blue-400 dark:to-orange-400 text-transparent bg-clip-text">
            Veson Nautical
          </span>
        </a>; learned early that you can make something meaningful if you care about the problem and the people.
      </p>

      {expanded && (
        <>
          <p className={`mb-3 ${textClassName} leading-relaxed`}>
            Spent Fall 2025 studying abroad in{" "}
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
            . Traveled around Europe, got to see my lifelong club{" "}
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
            play week in week out at the new Camp Nou, and spent the semester getting better at Spanish and Greek. Had a lot of conversations about what people should want out of life. I learned the hard way that it doesn&apos;t matter how hard you work if you&apos;re working hard for the wrong reasons. So I started spending more time figuring out what&apos;s worth doing in the first place, and now I&apos;m building products to help with that.
          </p>
          <p className={`mb-3 ${textClassName} leading-relaxed`}>
            I love talking to people about what success means to them. Not success in the typical sense, but a life that fulfills you every day for reasons true to who you are. Learning more every day through writing books, blogs, movie scripts, and having conversations with people who push me forward.
          </p>
          <p className={`${textClassName} leading-relaxed`}>
            Learn more about me, shoot me a message, or schedule a chat with me through{" "}
            <button
              onClick={handleIrisClick}
              className="hover:opacity-80 transition-opacity inline-block focus:outline-none"
            >
              <span className="font-semibold bg-gradient-to-r from-blue-500 via-emerald-500 to-blue-500 dark:from-blue-400 dark:via-emerald-400 dark:to-blue-400 text-transparent bg-clip-text">
                Iris
              </span>
            </button>.
          </p>
        </>
      )}
    </div>
  );
}