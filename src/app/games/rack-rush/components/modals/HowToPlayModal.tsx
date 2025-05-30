import React, { useContext } from 'react';
import { GameContext } from '../../context/GameContext';
import { useRouter } from 'next/navigation';
import { GameMode } from '../../types';

export const HowToPlayModal: React.FC = () => {
  const context = useContext(GameContext);
  const router = useRouter();
  
  if (!context) return null;
  
  const { state, startGame } = context;
  
  if (state.phase !== 'ready') return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-2xl mx-4 relative">
        <button
          onClick={() => router.push('/')}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          ✕
        </button>
        
        <h1 className="text-4xl font-bold text-center mb-6 text-purple-600 dark:text-purple-400">
          RACK RUSH
        </h1>
        
        <div className="mb-6 space-y-3">
          <h2 className="text-xl font-semibold mb-2">How to Play:</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
            <li>Form words on the board using your 7-tile rack</li>
            <li>First word must cross the center star</li>
            <li>Click or drag tiles to place them on the board</li>
            <li>Score points based on letter values and premium squares</li>
            <li>Reach the target score before time runs out!</li>
            <li>3 invalid words = Game Over</li>
          </ul>
        </div>
        
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Premium Squares:</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-red-500 text-white flex items-center justify-center text-xs font-bold">TW</div>
              <span>Triple Word Score</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-pink-400 text-white flex items-center justify-center text-xs font-bold">DW</div>
              <span>Double Word Score</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 text-white flex items-center justify-center text-xs font-bold">TL</div>
              <span>Triple Letter Score</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-300 text-white flex items-center justify-center text-xs font-bold">DL</div>
              <span>Double Letter Score</span>
            </div>
          </div>
        </div>
        
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold mb-2">Choose Difficulty:</h3>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => startGame('slow' as GameMode)}
              className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              <div className="font-bold">SLOW</div>
              <div className="text-xs">10 min • 300 pts</div>
            </button>
            <button
              onClick={() => startGame('medium' as GameMode)}
              className="px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
            >
              <div className="font-bold">MEDIUM</div>
              <div className="text-xs">6 min • 200 pts</div>
            </button>
            <button
              onClick={() => startGame('fast' as GameMode)}
              className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              <div className="font-bold">FAST</div>
              <div className="text-xs">3 min • 120 pts</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 