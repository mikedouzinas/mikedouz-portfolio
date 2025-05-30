import React, { useContext, useEffect } from 'react';
import { GameContext } from '../../context/GameContext';

export const BlankLetterModal: React.FC = () => {
  const context = useContext(GameContext);
  
  useEffect(() => {
    if (!context || !context.state.blankLetterInput) return;
    
    const { setBlankLetter, cancelBlankLetter } = context;
    
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelBlankLetter();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        setBlankLetter(e.key);
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [context]);
  
  if (!context) return null;
  
  const { state, cancelBlankLetter } = context;
  
  if (!state.blankLetterInput) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md mx-4 text-center">
        <h2 className="text-2xl font-bold mb-4">Enter Letter for Blank Tile</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Type any letter to use for this blank tile
        </p>
        <div className="flex justify-center gap-4">
          <button
            onClick={cancelBlankLetter}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}; 