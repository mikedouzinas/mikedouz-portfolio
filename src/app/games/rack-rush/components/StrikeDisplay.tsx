import React, { useContext } from 'react';
import { GameContext } from '../context/GameContext';
import { MAX_STRIKES } from '../constants';

export const StrikeDisplay: React.FC = () => {
  const context = useContext(GameContext);
  if (!context) return null;
  
  const { state } = context;
  
  return (
    <div className="flex gap-2">
      {Array.from({ length: MAX_STRIKES }, (_, i) => (
        <div
          key={i}
          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
            i < state.strikes
              ? 'bg-red-500 border-red-600 text-white'
              : 'border-gray-300'
          }`}
        >
          {i < state.strikes && '✕'}
        </div>
      ))}
    </div>
  );
}; 