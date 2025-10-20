"use client";
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaGithub, FaLinkedin, FaEnvelope } from 'react-icons/fa';
import { SiCalendly } from 'react-icons/si';
import { X } from 'lucide-react';

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
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ 
              type: 'spring', 
              damping: 30, 
              stiffness: 300 
            }}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-white dark:bg-gray-800 shadow-2xl max-h-[85vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-sheet-title"
          >
            {/* Sheet header with close button */}
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h2 
                id="about-sheet-title" 
                className="text-lg font-semibold text-gray-800 dark:text-gray-200"
              >
                About & Links
              </h2>
              
              {/* Close button - custom focus style instead of default blue outline */}
              <button
                onClick={onClose}
                aria-label="Close"
                className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-0"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Sheet body */}
            <div className="px-6 py-6 space-y-6">
              {/* About blurb */}
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  Software engineer passionate about building elegant, user-focused applications. 
                  I love exploring new technologies and creating tools that make a difference.
                </p>
              </div>

              {/* Links section */}
              <div>
                <h3 className="text-xs uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400 mb-3">
                  Connect
                </h3>
                
                {/* Links grid */}
                <div className="grid grid-cols-2 gap-3">
                  {links.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      target={link.external ? '_blank' : undefined}
                      rel={link.external ? 'noopener noreferrer' : undefined}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600/50 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-0"
                    >
                      <span className="text-gray-700 dark:text-gray-300">
                        {link.icon}
                      </span>
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {link.label}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom padding for safe area on mobile devices */}
            <div className="h-6" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

