"use client";
import React, { useState, useContext, useEffect } from 'react';
import { GameContext } from '../context/GameContext';
import { Board } from './Board';
import { Timer } from './Timer';
import { StrikeDisplay } from './StrikeDisplay';
import { WordsPlayed } from './WordsPlayed';
import { ExchangeModal } from './modals/ExchangeModal';
import { GAME_CONFIG, MAX_EXCHANGES } from '../constants';

export const GameScreen: React.FC = () => {
  const context = useContext(GameContext);
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [selectedForExchange, setSelectedForExchange] = useState<string[]>([]);

  useEffect(() => {
    if (!context) return;
    
    const { state, submitWord, setBlankLetter, cancelBlankLetter } = context;
    
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && state.placedTiles.length > 0) {
        submitWord();
        return;
      }
      
      // Handle letter input for blank tiles only
      if (state.blankLetterInput) {
        if (e.key === 'Escape') {
          cancelBlankLetter();
        } else if (/^[a-zA-Z]$/.test(e.key)) {
          setBlankLetter(e.key);
        }
        return;
      }
      
      // Handle regular letter typing for board placement
      if (/^[a-zA-Z]$/.test(e.key)) {
        const letter = e.key.toUpperCase();
        
        // Call the Board's typing handler
        const boardHandler = (window as unknown as { boardTypingHandler?: (letter: string) => boolean }).boardTypingHandler;
        if (boardHandler && typeof boardHandler === 'function') {
          const handled = boardHandler(letter);
          if (handled) {
            return; // Board handled it, we're done
          }
        }
      }
      
      // Handle backspace/delete for board placement
      if (e.key === 'Backspace' || e.key === 'Delete') {
        // Call the Board's typing handler with backspace
        const boardHandler = (window as unknown as { boardTypingHandler?: (letter: string) => boolean }).boardTypingHandler;
        if (boardHandler && typeof boardHandler === 'function') {
          const handled = boardHandler('BACKSPACE');
          if (handled) {
            return; // Board handled it, we're done
          }
        }
      }
      
      // Don't consume other keyboard events - let them bubble to other handlers
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [context]);
  
  if (!context) return null;
  
  const { state, submitWord, shuffleRack, exchangeTiles, clearPlacedTiles } = context;
  
  if (state.phase !== 'play') return null;
  
  const handleOpenExchange = () => {
    setSelectedForExchange([]);
    setShowExchangeModal(true);
  };

  const handleCloseExchange = () => {
    setShowExchangeModal(false);
    setSelectedForExchange([]);
  };

  const handleToggleTileForExchange = (tileId: string) => {
    setSelectedForExchange(prev => 
      prev.includes(tileId) 
        ? prev.filter(id => id !== tileId)
        : [...prev, tileId]
    );
  };

  const handleExchange = () => {
    if (selectedForExchange.length > 0) {
      exchangeTiles(selectedForExchange.map(id => state.rack.findIndex(tile => tile.id === id)));
      handleCloseExchange();
    }
  };

  const remainingExchanges = MAX_EXCHANGES - state.exchangesUsed;
  const placedTileIds = state.placedTiles.map(t => t.tile.id);
  const isExchangeDisabled = state.letterBag.length === 0 || state.exchangesUsed >= MAX_EXCHANGES;

  return (
    <div className="flex gap-8 p-8 max-w-7xl mx-auto">
      <div className="flex-shrink-0">
        <Board />
      </div>
      
      <div className="flex-1 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-2xl font-bold">Score: {state.score}</div>
            <div className="text-sm text-gray-600">
              Target: {GAME_CONFIG[state.mode].target}
            </div>
          </div>
          <Timer />
          <StrikeDisplay />
        </div>
        
        <WordsPlayed />
        
        <div className="flex gap-4">
          <button
            onClick={shuffleRack}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Shuffle
          </button>
          <button
            onClick={handleOpenExchange}
            className={`px-4 py-2 rounded transition-colors relative ${
              isExchangeDisabled 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-gray-500 text-white hover:bg-gray-600'
            }`}
            disabled={isExchangeDisabled}
          >
            Exchange
            <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {remainingExchanges}
            </span>
          </button>
          <button
            onClick={clearPlacedTiles}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            disabled={state.placedTiles.length === 0}
          >
            Clear
          </button>
          <button
            onClick={submitWord}
            className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors font-bold"
            disabled={state.placedTiles.length === 0}
          >
            Submit Word
          </button>
        </div>
        
        <div className="text-sm text-gray-600">
          <p>Tiles in bag: {state.letterBag.length}</p>
          <p>Exchanges remaining: {remainingExchanges}/{MAX_EXCHANGES}</p>
          {state.placedTiles.length > 0 && (
            <p className="mt-2 text-green-600">
              {state.placedTiles.length} tile{state.placedTiles.length > 1 ? 's' : ''} placed
            </p>
          )}
        </div>
      </div>
      
      <ExchangeModal
        isOpen={showExchangeModal}
        onClose={handleCloseExchange}
        selectedTileIds={selectedForExchange}
        onToggleTile={handleToggleTileForExchange}
        onExchange={handleExchange}
        rack={state.rack}
        placedTileIds={placedTileIds}
      />
    </div>
  );
}; 