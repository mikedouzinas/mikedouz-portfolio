import React, { useContext, useEffect } from 'react';
import { GameContext } from '../context/GameContext';

export const ErrorMessage: React.FC = () => {
  const context = useContext(GameContext);
  if (!context) return null;
  
  const { state } = context;
  
  useEffect(() => {
    // Add animation styles if not already present
    if (typeof document !== 'undefined') {
      const styleId = 'error-message-animations';
      if (!document.getElementById(styleId)) {
        const styleSheet = document.createElement('style');
        styleSheet.id = styleId;
        styleSheet.textContent = `
          @keyframes fadeInOut {
            0% { opacity: 0; transform: translate(-50%, -20px); }
            10% { opacity: 1; transform: translate(-50%, 0); }
            90% { opacity: 1; transform: translate(-50%, 0); }
            100% { opacity: 0; transform: translate(-50%, -20px); }
          }
          
          .animate-fade-in-out {
            animation: fadeInOut 3s ease-in-out forwards;
          }
        `;
        document.head.appendChild(styleSheet);
      }
    }
  }, []);
  
  if (!state.errorMessage) return null;
  
  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in-out">
      {state.errorMessage}
    </div>
  );
}; 