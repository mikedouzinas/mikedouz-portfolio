"use client";
import { usePageTransition } from '@/components/PageTransition';
import PageTransition from '@/components/PageTransition';

export default function CircuitPage() {
  const { transitionTo } = usePageTransition();

  const handleBack = () => {
    transitionTo('/');
  };

  return (
    <PageTransition>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 relative">
        <button
          onClick={handleBack}
          className="absolute top-6 left-6 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-400 dark:border-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-300"
        >
          Back
        </button>
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-200 mb-4">
            Circuit Game
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Coming soon...
          </p>
        </div>
      </div>
    </PageTransition>
  );
} 