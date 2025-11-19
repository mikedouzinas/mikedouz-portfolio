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
}

/**
 * Shared About content component
 * Used in both AboutSheet (mobile) and about_section (desktop)
 */
export default function AboutContent({ 
  expanded = false, 
  textClassName = "text-sm font-light text-gray-600 dark:text-gray-400", 
  containerClassName = ""
}: AboutContentProps) {
  return (
    <div className={containerClassName}>
      <p className={`mb-3 ${textClassName} leading-relaxed`}>
        I&apos;m <strong className="font-semibold">Mike Veson</strong>, a{" "}
        <span className="font-semibold bg-gradient-to-r from-blue-700 to-blue-400 dark:from-blue-400 dark:to-white text-transparent bg-clip-text">
          Greek
        </span>
        -
        <span className="font-semibold bg-gradient-to-r from-red-600 via-blue-400 to-blue-700 dark:from-red-500 dark:via-white dark:to-blue-300 text-transparent bg-clip-text">
          American{" "}
        </span>
        Computer Science major at{" "}
        <span className="font-semibold bg-gradient-to-r from-blue-600 to-gray-600 dark:from-blue-400 dark:to-gray-400 text-transparent bg-clip-text">
          Rice University
        </span>{" "}
        🦉 who loves building things that make life easier. I grew up around{" "}
        <span className="font-semibold bg-gradient-to-r from-blue-700 to-orange-600 dark:from-blue-400 dark:to-orange-400 text-transparent bg-clip-text">
          shipping software
        </span>{" "}
        🚢 and learned early how tech can transform industries and power
        products that people rely on.
      </p>

      {expanded && (
        <>
          <p className={`mb-3 ${textClassName} leading-relaxed`}>
            I&apos;m a fast learner, I break down big problems into clear steps, and always
            put users first. I&apos;ve worked in supporting
            startups, shipping software, and defense, mainly in software engineering,
            product, and client-facing roles. My primary technical skillset spans{" "}
            <strong className="font-semibold">
              Mobile, Web, Backend, and Data Engineering
            </strong>
            , but I&apos;m always learning new skills and pushing myself to take on new challenges.
          </p>

          <p className={`mb-3 ${textClassName} leading-relaxed`}>
            Outside of CS, I love soccer ⚽ (or football, wherever you&apos;re
            from). It&apos;s been a life goal of mine to understand players and
            teams better through data. I&apos;ve built analytics tools, highlight
            generators, and reached the{" "}
            <strong className="font-semibold">top 3%</strong> in Euro 2024
            predictions. I&apos;m also studying abroad in{" "}
            <span className="font-semibold bg-gradient-to-r from-red-600 to-blue-700 dark:from-red-500 dark:to-blue-400 text-transparent bg-clip-text">
              Barcelona
            </span>{" "}
            this year, exploring new cultures while
            improving my Greek and Spanish.
          </p>

          <p className={`${textClassName} leading-relaxed`}>
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
        </>
      )}
    </div>
  );
}