"use client";
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

export default function BoredButton() {
  const router = useRouter();

  const handleClick = () => {
    router.push('/games');
  };

  return (
    <motion.button
      onClick={handleClick}
      className="relative w-36 px-3 py-2 mb-4 text-xs font-light text-gray-700 dark:text-gray-300 
               border-2 border-dashed border-gray-400 dark:border-gray-600 rounded-lg
               hover:border-gray-600 dark:hover:border-gray-400 transition-colors duration-300
               hidden md:block"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
    Try <strong>Rack Rush</strong> here!
    </motion.button>
  );
} 