"use client";
import { useRouter } from 'next/navigation';

export default function BoredButton() {
  const router = useRouter();

  const handlePlaygroundClick = () => {
    router.push('/playground');
  };


  return (
    <div className="flex flex-col space-y-3 mb-4 hidden sm:flex">
      {/* Primary CTA - The Playground */}
      <button
        onClick={handlePlaygroundClick}
        className="relative w-36 inline-flex items-center justify-center rounded-2xl font-medium transition-all duration-200 text-sm focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 transform hover:scale-105 hover:-translate-y-0.5 hover:shadow-xl"
        style={{
          background: 'linear-gradient(90deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #6366f1, #a855f7)',
          padding: '2px'
        }}
      >
        <span className="bg-gray-50 dark:bg-gray-900 rounded-xl px-3 py-1 font-semibold text-gray-800 dark:text-gray-200 w-full text-center transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800">
          The Playground
        </span>
      </button>
    </div>
  );
} 