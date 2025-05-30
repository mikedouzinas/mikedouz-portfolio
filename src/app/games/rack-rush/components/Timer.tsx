import React, { useContext } from 'react';
import { GameContext } from '../context/GameContext';

export const Timer: React.FC = () => {
  const context = useContext(GameContext);
  if (!context) return null;
  
  const { state } = context;
  const minutes = Math.floor(state.timeLeft / 60);
  const seconds = state.timeLeft % 60;
  
  return (
    <div className={`text-3xl font-mono ${state.timeLeft < 60 ? 'text-red-500' : ''}`}>
      {minutes}:{seconds.toString().padStart(2, '0')}
    </div>
  );
}; 