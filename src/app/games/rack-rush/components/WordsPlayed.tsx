import React, { useContext } from 'react';
import { GameContext } from '../context/GameContext';

export const WordsPlayed: React.FC = () => {
  const context = useContext(GameContext);
  if (!context) return null;
  
  const { state } = context;
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg max-h-96 overflow-y-auto">
      <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">Words Played</h3>
      {state.playedWords.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm italic">No words played yet...</p>
      ) : (
        <div className="space-y-2">
          {state.playedWords.map((wordInfo, index) => (
            <div
              key={`${wordInfo.word}-${index}`}
              className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded transition-all hover:bg-gray-100 dark:hover:bg-gray-600"
            >
              <span className="font-medium text-gray-800 dark:text-gray-200">
                {wordInfo.word}
              </span>
              <span className="text-green-600 dark:text-green-400 font-bold">
                +{wordInfo.score}
              </span>
            </div>
          ))}
          <div className="border-t pt-2 mt-2 flex justify-between items-center">
            <span className="font-semibold text-gray-800 dark:text-gray-200">Total:</span>
            <span className="font-bold text-xl text-blue-600 dark:text-blue-400">
              {state.score}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}; 