import React, { useContext, useEffect } from 'react';
import { GameContext } from '../../context/GameContext';
import { useRouter } from 'next/navigation';
import { GAME_CONFIG } from '../../constants';

export const EndScreen: React.FC = () => {
  const context = useContext(GameContext);
  const router = useRouter();
  
  // Move useEffect to top level and make it conditional inside
  useEffect(() => {
    if (context && context.state.phase === 'end') {
      const state = context.state;
      const isHighScore = state.score > state.highScores[state.mode];
      
      if (isHighScore && state.score > 0) {
        localStorage.setItem(`rackrush-high-${state.mode}`, state.score.toString());
      }
    }
  }, [context]);
  
  if (!context) return null;
  
  const { state, resetGame } = context;
  
  if (state.phase !== 'end') return null;
  
  const won = state.score >= GAME_CONFIG[state.mode].target;
  const isHighScore = state.score > state.highScores[state.mode];
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className={`bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md mx-4 text-center ${
        won ? '' : 'grayscale'
      }`}>
        <h2 className={`text-3xl font-bold mb-4 ${
          won ? 'text-green-500' : 'text-red-500'
        }`}>
          {won ? '🎉 YOU WIN! 🎉' : '😔 GAME OVER'}
        </h2>
        
        <div className="mb-6">
          <p className="text-2xl font-semibold mb-2">Final Score: {state.score}</p>
          {!won && (
            <p className="text-gray-600 dark:text-gray-400">
              {state.strikes >= 3 ? '3 invalid words' : 'Out of time'}
            </p>
          )}
          {isHighScore && state.score > 0 && (
            <p className="text-yellow-500 font-bold mt-2">
              ✨ New Personal Best! ✨
            </p>
          )}
        </div>
        
        <div className="space-y-3">
          <button
            onClick={resetGame}
            className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold"
          >
            Play Again
          </button>
          <button
            className="w-full px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors font-semibold"
            disabled
          >
            See Leaderboard
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}; 