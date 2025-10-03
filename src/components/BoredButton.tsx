"use client";
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

export default function BoredButton() {
  const router = useRouter();

  const handlePlaygroundClick = () => {
    router.push('/playground');
  };

  const handleLearnMoreClick = () => {
    // Dispatch custom event for command palette integration
    window.dispatchEvent(new CustomEvent('mv-open-cmdk'));
  };

  return (
    <div className="flex flex-col space-y-3 mb-4 hidden sm:flex">
      {/* Primary CTA - Playground */}
      <motion.button
        onClick={handlePlaygroundClick}
        className="mv-btn-primary text-sm"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <strong>Playground</strong>
      </motion.button>
      
      {/* Secondary CTA - Learn more about me */}
      <motion.button
        onClick={handleLearnMoreClick}
        className="mv-btn-neutral text-xs"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        Learn more about me ⌘K
      </motion.button>
    </div>
  );
} 