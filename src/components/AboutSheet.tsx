"use client";
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaGithub, FaLinkedin, FaEnvelope } from 'react-icons/fa';
import { SiCalendly } from 'react-icons/si';
import { X, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * About & Links sheet component for mobile
 * 
 * Purpose:
 * - Displays a short bio/description
 * - Provides quick access to social and contact links
 * - Accessible via info icon in mobile header
 * 
 * Animation:
 * - Slides up from bottom of screen with spring physics
 * - Smooth fade-in scrim/backdrop
 * - ESC key and outside click to dismiss
 * 
 * Accessibility:
 * - Focus trap within modal when open
 * - ESC key closes modal
 * - Semantic button elements with proper labels
 * - Keyboard navigation support
 * 
 * Links:
 * - GitHub: Professional projects and code
 * - LinkedIn: Professional network and experience
 * - Email: Direct contact
 * - Calendly: Schedule a meeting
 */
interface AboutSheetProps {
  /** Controls visibility of the sheet */
  open: boolean;
  /** Callback when sheet should be closed */
  onClose: () => void;
}

export default function AboutSheet({ open, onClose }: AboutSheetProps) {
  /**
   * Track whether the full bio is expanded
   * Default is collapsed (showing only first paragraph)
   */
  const [bioExpanded, setBioExpanded] = useState(false);

  /**
   * Handle ESC key press to close modal
   * Cleanup listener on unmount or when open state changes
   */
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when sheet is open
      document.body.style.overflow = 'hidden';
    } else {
      // Reset bio expansion when sheet closes
      setBioExpanded(false);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  /**
   * Social/contact links with icons and labels
   * Each link opens in a new tab (except email which opens mail client)
   */
  const links = [
    {
      label: 'GitHub',
      icon: <FaGithub size={20} />,
      href: 'https://github.com/mikedouzinas',
      external: true,
    },
    {
      label: 'LinkedIn',
      icon: <FaLinkedin size={20} />,
      href: 'https://www.linkedin.com/in/mikedouzinas',
      external: true,
    },
    {
      label: 'Email',
      icon: <FaEnvelope size={20} />,
      href: 'mailto:mike@douzinas.com',
      external: false,
    },
    {
      label: 'Schedule',
      icon: <SiCalendly size={20} />,
      href: 'https://fantastical.app/mikeveson/mikeveson-meeting',
      external: true,
    },
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop/Scrim - click to close */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Sheet content - slides up from bottom */}
          {/* Darker blue gradient background for better visual impact */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ 
              type: 'spring', 
              damping: 30, 
              stiffness: 300 
            }}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-gradient-to-b from-blue-200 to-blue-300 dark:bg-gradient-to-b dark:from-blue-950 dark:to-blue-900 shadow-2xl max-h-[85vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-sheet-title"
          >
            {/* Sheet body - no separate header bar, just content with close button */}
            <div className="px-6 pt-4 pb-6">
              {/* Top section: Title and close button inline with same background - slightly larger for better readability */}
              <div className="flex items-center justify-between mb-3">
                <h2 
                  id="about-sheet-title" 
                  className="text-base font-semibold text-blue-950 dark:text-blue-50"
                >
                  About
                </h2>
                
                {/* Close button - slightly larger for better touch target */}
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-300 dark:bg-blue-900 hover:bg-blue-400 dark:hover:bg-blue-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-0"
                >
                  <X className="w-4 h-4 text-blue-900 dark:text-blue-100" />
                </button>
              </div>

              {/* Separator line - extends to align with About title and close button */}
              <div className="mb-6">
                <div className="h-px bg-blue-400 dark:bg-blue-800" />
              </div>

              {/* Content sections with spacing */}
              <div className="space-y-6">
              {/* About text - from about_section.tsx */}
              {/* Shows first paragraph by default, with expandable "See more" button */}
              <div>
                {/* First paragraph - always visible */}
                <p className="mb-3 text-sm font-light text-blue-950 dark:text-blue-50 leading-relaxed">
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

                {/* Additional paragraphs - shown when expanded */}
                <AnimatePresence>
                  {bioExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="space-y-3"
                    >
                      <p className="text-sm font-light text-blue-950 dark:text-blue-50 leading-relaxed">
                        I&apos;m a fast learner, I break down big problems into clear steps, and always
                        put users first. I&apos;ve worked in supporting
                        startups, shipping software, and defense, mainly in software engineering,
                        product, and client-facing roles. My primary technical skillset spans{" "}
                        <strong className="font-semibold">
                          Mobile, Web, Backend, and Data Engineering
                        </strong>
                        , but I&apos;m always learning new skills and pushing myself to take on new challenges.
                      </p>

                      <p className="text-sm font-light text-blue-950 dark:text-blue-50 leading-relaxed">
                        Outside of CS, I love soccer ⚽ (or football, wherever you&apos;re
                        from). It&apos;s been a life goal of mine to understand players and
                        teams better through data. I&apos;ve built analytics tools, highlight
                        generators, and reached the{" "}
                        <strong className="font-semibold">top 3%</strong> in Euro 2024
                        predictions. I&apos;m also studying abroad in{" "}
                        <span className="font-semibold bg-gradient-to-r from-red-600 to-blue-700 dark:from-red-500 dark:to-blue-400 text-transparent bg-clip-text">
                          Barcelona
                        </span>{" "}
                        this Fall, exploring new cultures while
                        improving my Greek and Spanish.
                      </p>

                      <p className="text-sm font-light text-blue-950 dark:text-blue-50 leading-relaxed">
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
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* See more / Collapse button - styled like ExpandableSection, closer to text */}
                <button
                  onClick={() => setBioExpanded(!bioExpanded)}
                  className="inline-flex items-center gap-1.5 px-0 py-1.5 mt-1 text-xs text-blue-800 dark:text-blue-200 hover:text-blue-950 dark:hover:text-blue-50 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-0 rounded"
                  aria-expanded={bioExpanded}
                  aria-label={bioExpanded ? 'Show less' : 'See more'}
                >
                  <span className="font-medium">{bioExpanded ? 'Collapse' : 'See more'}</span>
                  {bioExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Links section */}
              <div>
                <h3 className="text-sm uppercase tracking-wide font-semibold text-blue-800 dark:text-blue-200 mb-3">
                  Connect
                </h3>
                
                {/* Links grid - styled to complement darker blue gradient background */}
                <div className="grid grid-cols-2 gap-3">
                  {links.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      target={link.external ? '_blank' : undefined}
                      rel={link.external ? 'noopener noreferrer' : undefined}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/70 dark:bg-blue-950/50 border border-blue-400 dark:border-blue-800/50 hover:bg-white/90 dark:hover:bg-blue-950/70 hover:border-blue-500 dark:hover:border-blue-700 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-0"
                    >
                      <span className="text-blue-800 dark:text-blue-200">
                        {link.icon}
                      </span>
                      <span className="text-sm font-medium text-blue-950 dark:text-blue-50">
                        {link.label}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom padding for safe area on mobile devices */}
            <div className="h-6" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

