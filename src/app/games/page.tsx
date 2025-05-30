"use client";
import React from 'react';
import { usePageTransition } from '@/components/PageTransition';
import PageTransition from '@/components/PageTransition';
import { GameProvider } from './rack-rush/context/GameContext';
import { GameScreen } from './rack-rush/components/GameScreen';
import { HowToPlayModal } from './rack-rush/components/modals/HowToPlayModal';
import { EndScreen } from './rack-rush/components/modals/EndScreen';
import { BlankLetterModal } from './rack-rush/components/modals/BlankLetterModal';
import { ErrorMessage } from './rack-rush/components/ErrorMessage';

export default function GamesPage() {
  const { transitionTo } = usePageTransition();

  const handleBack = () => {
    transitionTo('/');
  };

  return (
    <PageTransition>
      <GameProvider>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 relative">
          <button
            onClick={handleBack}
            className="absolute top-6 left-6 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-400 dark:border-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-300 z-10"
          >
            Back
          </button>
          
          <HowToPlayModal />
          <GameScreen />
          <EndScreen />
          <BlankLetterModal />
          <ErrorMessage />
        </div>
      </GameProvider>
    </PageTransition>
  );
}