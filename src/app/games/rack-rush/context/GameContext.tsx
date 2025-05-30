"use client";
import React, { createContext, useState, useEffect } from 'react';
import { GameState, GameMode, PlacedTile, PlayedWord, GameContextType, TileType } from '../types';
import { GAME_CONFIG, RACK_SIZE, BINGO_BONUS, MAX_STRIKES } from '../constants';
import { createEmptyBoard, validatePlacement } from '../utils/board';
import { createLetterBag, drawTiles, getFormedWords, calculateScore } from '../utils/game';
import { dictionary } from '../utils/dictionary';

// Create context
export const GameContext = createContext<GameContextType | null>(null);

// Game Provider Component
export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<GameState>({
    phase: 'ready',
    mode: 'medium',
    score: 0,
    strikes: 0,
    timeLeft: 360,
    board: createEmptyBoard(),
    rack: [],
    letterBag: createLetterBag(),
    placedTiles: [],
    isFirstMove: true,
    highScores: {
      slow: 0,
      medium: 0,
      fast: 0,
    },
    playedWords: [],
    blankLetterInput: null,
    errorMessage: null,
    exchangesUsed: 0,
  });

  // Initialize high scores from localStorage after component mounts
  useEffect(() => {
    const loadHighScores = () => {
      setState(prev => ({
        ...prev,
        highScores: {
          slow: parseInt(localStorage.getItem('rackrush-high-slow') || '0'),
          medium: parseInt(localStorage.getItem('rackrush-high-medium') || '0'),
          fast: parseInt(localStorage.getItem('rackrush-high-fast') || '0'),
        }
      }));
    };

    loadHighScores();
  }, []);

  // Timer effect
  useEffect(() => {
    if (state.phase !== 'play' || state.timeLeft <= 0) return;

    const timer = setInterval(() => {
      setState(prev => {
        const newTimeLeft = prev.timeLeft - 1;
        if (newTimeLeft <= 0) {
          return { ...prev, timeLeft: 0, phase: 'end' };
        }
        return { ...prev, timeLeft: newTimeLeft };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [state.phase, state.timeLeft]);

  const startGame = (mode: GameMode) => {
    const newBag = createLetterBag();
    const [initialRack, remainingBag] = drawTiles(7, newBag);
    
    setState({
      ...state,
      phase: 'play',
      mode,
      score: 0,
      strikes: 0,
      timeLeft: GAME_CONFIG[mode].time,
      board: createEmptyBoard(),
      rack: initialRack,
      letterBag: remainingBag,
      placedTiles: [],
      isFirstMove: true,
      playedWords: [],
      exchangesUsed: 0,
    });
  };

  const placeWord = (tiles: PlacedTile[]) => {
    setState(prev => ({ ...prev, placedTiles: tiles }));
  };

  const removePlacedTile = (row: number, col: number) => {
    setState(prev => ({
      ...prev,
      placedTiles: prev.placedTiles.filter(t => !(t.row === row && t.col === col))
    }));
  };

  const submitWord = () => {
    if (state.placedTiles.length === 0) return;
    
    // Validate placement
    const placementResult = validatePlacement(state.placedTiles, state.board, state.isFirstMove);
    if (!placementResult.valid) {
      setState(prev => ({ 
        ...prev, 
        errorMessage: placementResult.error || "Invalid word placement",
        placedTiles: [] 
      }));
      
      setTimeout(() => {
        setState(prev => ({ ...prev, errorMessage: null }));
      }, 3000);
      
      return;
    }
    
    // Get all formed words
    const formedWords = getFormedWords(state.placedTiles, state.board);
    
    // Validate all words
    const invalidWords = formedWords.filter(({ word }) => !dictionary.search(word));
    
    if (invalidWords.length > 0) {
      // Invalid word - add strike
      setState(prev => {
        const newStrikes = prev.strikes + 1;
        const newState = { 
          ...prev, 
          strikes: newStrikes, 
          placedTiles: [],
          errorMessage: `"${invalidWords[0].word}" is not a valid word. Strike ${newStrikes}/3`
        };
        
        setTimeout(() => {
          setState(prev => ({ ...prev, errorMessage: null }));
        }, 3000);
        
        if (newStrikes >= MAX_STRIKES) {
          return { ...newState, phase: 'end' };
        }
        return newState;
      });
      return;
    }
    
    // Calculate total score and track words
    let moveScore = 0;
    const newPlayedWords: PlayedWord[] = [];
    
    formedWords.forEach(({ word, tiles }) => {
      const wordScore = calculateScore(tiles, state.board);
      moveScore += wordScore;
      newPlayedWords.push({
        word,
        score: wordScore,
        timestamp: Date.now()
      });
    });
    
    // Bingo bonus for using all 7 tiles
    if (state.placedTiles.length === RACK_SIZE) {
      moveScore += BINGO_BONUS;
      newPlayedWords.push({
        word: 'BONUS: All 7 tiles!',
        score: BINGO_BONUS,
        timestamp: Date.now()
      });
    }
    
    // Update board
    const newBoard = state.board.map(row => row.map(cell => ({ ...cell })));
    state.placedTiles.forEach(({ row, col, tile }) => {
      newBoard[row][col] = {
        ...newBoard[row][col],
        tile,
        premiumUsed: true,
      };
    });
    
    // Remove used tiles from rack
    const usedTileIds = state.placedTiles.map(t => t.tile.id);
    const newRack = state.rack.filter(t => !usedTileIds.includes(t.id));
    
    // Draw new tiles
    const [drawnTiles, newBag] = drawTiles(RACK_SIZE - newRack.length, state.letterBag);
    
    // Check win condition
    const newScore = state.score + moveScore;
    const target = GAME_CONFIG[state.mode].target;
    
    setState(prev => ({
      ...prev,
      board: newBoard,
      rack: [...newRack, ...drawnTiles],
      letterBag: newBag,
      score: newScore,
      placedTiles: [],
      isFirstMove: false,
      playedWords: [...prev.playedWords, ...newPlayedWords],
      phase: newScore >= target ? 'end' : prev.phase,
      errorMessage: null
    }));
  };

  const shuffleRack = () => {
    setState(prev => {
      const shuffled = [...prev.rack];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return { ...prev, rack: shuffled };
    });
  };

  const exchangeTiles = (indices: number[]) => {
    if (state.letterBag.length < indices.length || state.exchangesUsed >= 2) return;
    
    setState(prev => {
      const tilesToExchange = indices.map(i => prev.rack[i]);
      const keptTiles = prev.rack.filter((_, i) => !indices.includes(i));
      
      const [drawnTiles, newBag] = drawTiles(indices.length, prev.letterBag);
      const finalBag = [...newBag, ...tilesToExchange];
      
      // Shuffle the bag
      for (let i = finalBag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [finalBag[i], finalBag[j]] = [finalBag[j], finalBag[i]];
      }
      
      return {
        ...prev,
        rack: [...keptTiles, ...drawnTiles],
        letterBag: finalBag,
        exchangesUsed: prev.exchangesUsed + 1,
      };
    });
  };

  const resetGame = () => {
    const newBag = createLetterBag();
    setState(prev => ({
      ...prev,
      phase: 'ready',
      score: 0,
      strikes: 0,
      board: createEmptyBoard(),
      rack: [],
      letterBag: newBag,
      placedTiles: [],
      isFirstMove: true,
      playedWords: [],
      exchangesUsed: 0,
    }));
  };

  const clearPlacedTiles = () => {
    setState(prev => ({
      ...prev,
      placedTiles: []
    }));
  };

  const setBlankLetter = (input: { row: number; col: number; tile: TileType } | string) => {
    if (typeof input === 'string') {
      if (!state.blankLetterInput) return;
      
      const { row, col, tile } = state.blankLetterInput;
      const newTile = { ...tile, letter: input.toUpperCase() };
      
      setState(prev => ({
        ...prev,
        placedTiles: prev.placedTiles.map(t => 
          t.row === row && t.col === col ? { ...t, tile: newTile } : t
        ),
        blankLetterInput: null
      }));
    } else {
      setState(prev => ({
        ...prev,
        blankLetterInput: input
      }));
    }
  };

  const cancelBlankLetter = () => {
    setState(prev => ({
      ...prev,
      blankLetterInput: null
    }));
  };

  return (
    <GameContext.Provider value={{
      state,
      startGame,
      placeWord,
      submitWord,
      shuffleRack,
      exchangeTiles,
      resetGame,
      removePlacedTile,
      clearPlacedTiles,
      setBlankLetter,
      cancelBlankLetter,
    }}>
      {children}
    </GameContext.Provider>
  );
}; 