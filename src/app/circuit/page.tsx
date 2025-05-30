"use client";
import React, { useState, useEffect, useContext, createContext, useCallback, useRef } from 'react';
import { usePageTransition } from '@/components/PageTransition';
import PageTransition from '@/components/PageTransition';

// Types
type TileType = {
  letter: string;
  points: number;
  id: string;
  isBlank?: boolean;
};

type CellType = {
  tile?: TileType;
  premium: 'TW' | 'DW' | 'TL' | 'DL' | 'normal';
  premiumUsed: boolean;
};

type GamePhase = 'ready' | 'play' | 'end';
type GameMode = 'slow' | 'medium' | 'fast';

type PlacedTile = {
  row: number;
  col: number;
  tile: TileType;
};

type GameState = {
  phase: GamePhase;
  mode: GameMode;
  score: number;
  strikes: number;
  timeLeft: number;
  board: CellType[][];
  rack: TileType[];
  letterBag: TileType[];
  placedTiles: PlacedTile[];
  isFirstMove: boolean;
  highScores: Record<GameMode, number>;
};

// Premium square layout for standard Scrabble board
const PREMIUM_LAYOUT: { [key: string]: 'TW' | 'DW' | 'TL' | 'DL' } = {
  '0,0': 'TW', '0,7': 'TW', '0,14': 'TW',
  '7,0': 'TW', '7,14': 'TW',
  '14,0': 'TW', '14,7': 'TW', '14,14': 'TW',
  '1,1': 'DW', '1,13': 'DW', '2,2': 'DW', '2,12': 'DW',
  '3,3': 'DW', '3,11': 'DW', '4,4': 'DW', '4,10': 'DW',
  '10,4': 'DW', '10,10': 'DW', '11,3': 'DW', '11,11': 'DW',
  '12,2': 'DW', '12,12': 'DW', '13,1': 'DW', '13,13': 'DW',
  '7,7': 'DW', // Center star
  '0,3': 'DL', '0,11': 'DL', '2,6': 'DL', '2,8': 'DL',
  '3,0': 'DL', '3,7': 'DL', '3,14': 'DL', '6,2': 'DL',
  '6,6': 'DL', '6,8': 'DL', '6,12': 'DL', '7,3': 'DL',
  '7,11': 'DL', '8,2': 'DL', '8,6': 'DL', '8,8': 'DL',
  '8,12': 'DL', '11,0': 'DL', '11,7': 'DL', '11,14': 'DL',
  '12,6': 'DL', '12,8': 'DL', '14,3': 'DL', '14,11': 'DL',
  '1,5': 'TL', '1,9': 'TL', '5,1': 'TL', '5,5': 'TL',
  '5,9': 'TL', '5,13': 'TL', '9,1': 'TL', '9,5': 'TL',
  '9,9': 'TL', '9,13': 'TL', '13,5': 'TL', '13,9': 'TL',
};

// Letter distribution and points (standard English Scrabble)
const LETTER_DISTRIBUTION: { [key: string]: { count: number; points: number } } = {
  'A': { count: 9, points: 1 }, 'B': { count: 2, points: 3 },
  'C': { count: 2, points: 3 }, 'D': { count: 4, points: 2 },
  'E': { count: 12, points: 1 }, 'F': { count: 2, points: 4 },
  'G': { count: 3, points: 2 }, 'H': { count: 2, points: 4 },
  'I': { count: 9, points: 1 }, 'J': { count: 1, points: 8 },
  'K': { count: 1, points: 5 }, 'L': { count: 4, points: 1 },
  'M': { count: 2, points: 3 }, 'N': { count: 6, points: 1 },
  'O': { count: 8, points: 1 }, 'P': { count: 2, points: 3 },
  'Q': { count: 1, points: 10 }, 'R': { count: 6, points: 1 },
  'S': { count: 4, points: 1 }, 'T': { count: 6, points: 1 },
  'U': { count: 4, points: 1 }, 'V': { count: 2, points: 4 },
  'W': { count: 2, points: 4 }, 'X': { count: 1, points: 8 },
  'Y': { count: 2, points: 4 }, 'Z': { count: 1, points: 10 },
  '_': { count: 2, points: 0 }, // Blanks
};

// Game configuration
const GAME_CONFIG = {
  slow: { time: 600, target: 300 }, // 10 minutes
  medium: { time: 360, target: 200 }, // 6 minutes
  fast: { time: 180, target: 120 }, // 3 minutes
};

// Trie Node class for dictionary
class TrieNode {
  children: Map<string, TrieNode>;
  isEndOfWord: boolean;
  
  constructor() {
    this.children = new Map();
    this.isEndOfWord = false;
  }
}

// Trie class for efficient word lookup
class Trie {
  root: TrieNode;
  
  constructor() {
    this.root = new TrieNode();
  }
  
  insert(word: string): void {
    let current = this.root;
    for (const char of word.toUpperCase()) {
      if (!current.children.has(char)) {
        current.children.set(char, new TrieNode());
      }
      current = current.children.get(char)!;
    }
    current.isEndOfWord = true;
  }
  
  search(word: string): boolean {
    let current = this.root;
    for (const char of word.toUpperCase()) {
      if (!current.children.has(char)) {
        return false;
      }
      current = current.children.get(char)!;
    }
    return current.isEndOfWord;
  }
}

// Create dictionary trie (subset of OWL3 for demo - in production, load full dictionary)
const createDictionary = (): Trie => {
  const trie = new Trie();
  
  // Common 2-letter words
  const twoLetterWords = ['AT', 'BE', 'DO', 'GO', 'HE', 'IF', 'IN', 'IS', 'IT', 'ME', 'MY', 'NO', 'OF', 'ON', 'OR', 'SO', 'TO', 'UP', 'WE', 'AA', 'AB', 'AD', 'AE', 'AG', 'AH', 'AI', 'AL', 'AM', 'AN', 'AR', 'AS', 'AW', 'AX', 'AY', 'BA', 'BI', 'BO', 'BY', 'DE', 'ED', 'EF', 'EH', 'EL', 'EM', 'EN', 'ER', 'ES', 'ET', 'EX', 'FA', 'FE', 'HA', 'HI', 'HM', 'HO', 'ID', 'JO', 'KA', 'KI', 'LA', 'LI', 'LO', 'MA', 'MI', 'MM', 'MO', 'MU', 'NA', 'NE', 'NU', 'OD', 'OE', 'OH', 'OI', 'OK', 'OM', 'OP', 'OS', 'OW', 'OX', 'OY', 'PA', 'PE', 'PI', 'QI', 'RE', 'SH', 'SI', 'TA', 'TI', 'UM', 'UN', 'US', 'UT', 'WO', 'XI', 'XU', 'YA', 'YE', 'YO', 'ZA'];
  
  // Common 3+ letter words
  const commonWords = [
    'CAT', 'DOG', 'HELLO', 'WORLD', 'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT',
    'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'DAY', 'GET',
    'HAS', 'HIM', 'HIS', 'HOW', 'ITS', 'MAY', 'NEW', 'NOW', 'OLD', 'SEE',
    'TWO', 'WAY', 'WHO', 'BOY', 'DID', 'LET', 'PUT', 'SAY', 'SHE', 'ACE',
    'TOO', 'USE', 'LONG', 'MAKE', 'MANY', 'OVER', 'SUCH', 'THEM', 'ZOO',
    'THAN', 'SOME', 'TIME', 'VERY', 'WHEN', 'COME', 'HERE', 'JUST', 'LIKE',
    'WORD', 'PLAY', 'GAME', 'SCORE', 'POINT', 'TILE', 'BOARD', 'LETTER',
    'QUICK', 'BROWN', 'FOX', 'JUMPS', 'LAZY', 'QUIZ', 'JAZZ', 'FIZZ',
    'BUZZ', 'JINX', 'JOKE', 'JACK', 'JUMP', 'JUNK', 'QUAD', 'QUIT',
    'QUEUE', 'QUIET', 'QUITE', 'QUOTE', 'ZEBRA', 'ZERO', 'ZONE', 'ZOOM',
    'BAT', 'BIT', 'BOT', 'CUT', 'DOT', 'FIT', 'GOT', 'HIT', 'JOT', 'KIT',
    'LOT', 'MAT', 'NET', 'NUT', 'PET', 'POT', 'RAT', 'ROT', 'SAT', 'SET',
    'TAT', 'VET', 'WET', 'YET', 'ABET', 'ABLE', 'ABOUT', 'ABOVE', 'ACID',
    'ACRE', 'ACTOR', 'ADAPT', 'ADMIT', 'ADOPT', 'ADULT', 'AFTER', 'AGAIN',
    'AGENT', 'AGREE', 'AHEAD', 'ALARM', 'ALBUM', 'ALERT', 'ALIEN', 'ALIGN',
    'ALIVE', 'ALLOW', 'ALONE', 'ALONG', 'ALTER', 'AMBER', 'AMAZE', 'AMONG',
    'AMPLE', 'ANGLE', 'ANGRY', 'APART', 'APPLE', 'APPLY', 'ARENA', 'ARGUE',
    'ARISE', 'ARMED', 'ARMOR', 'ARROW', 'ASIDE', 'ASSET', 'AVOID', 'AWAKE',
    'AWARD', 'AWARE', 'BADGE', 'BADLY', 'BAKER', 'BARELY', 'BASIC', 'BATCH',
    'BEACH', 'BEARD', 'BEAST', 'BEGIN', 'BEING', 'BELOW', 'BENCH', 'BERRY',
    'BIRTH', 'BLACK', 'BLADE', 'BLAME', 'BLANK', 'BLAST', 'BLAZE', 'BLEED',
    'BLEND', 'BLESS', 'BLIND', 'BLOCK', 'BLOOD', 'BLOOM', 'BLOWN', 'BOARD',
    'BOOST', 'BOOTH', 'BOUND', 'BRAIN', 'BRAND', 'BRAVE', 'BREAD', 'BREAK',
    'BREED', 'BRICK', 'BRIDE', 'BRIEF', 'BRING', 'BROAD', 'BROKE', 'BROWN',
    'BUILD', 'BUILT', 'BURST', 'BUYER', 'CABLE', 'CACHE', 'CAMEL', 'CANAL',
    'CANDY', 'CARGO', 'CARRY', 'CARVE', 'CATCH', 'CAUSE', 'CHAIN', 'CHAIR',
    'CHALK', 'CHAMP', 'CHANT', 'CHAOS', 'CHARM', 'CHART', 'CHASE', 'CHEAP',
    'CHEAT', 'CHECK', 'CHEST', 'CHIEF', 'CHILD', 'CHINA', 'CHOICE', 'CHOSE',
    'CIVIC', 'CLAIM', 'CLAMP', 'CLASH', 'CLASS', 'CLEAN', 'CLEAR', 'CLERK',
    'CLICK', 'CLIFF', 'CLIMB', 'CLOCK', 'CLONE', 'CLOSE', 'CLOTH', 'CLOUD',
    'CLOWN', 'COACH', 'COAST', 'COLON', 'COLOR', 'COMIC', 'CORAL', 'COULD',
    'COUNT', 'COURT', 'COVER', 'CRACK', 'CRAFT', 'CRANE', 'CRASH', 'CRAZY',
    'CREAM', 'CREDIT', 'CREEK', 'CRIME', 'CRISP', 'CROSS', 'CROWD', 'CROWN',
    'CRUDE', 'CRUSH', 'CURVE', 'CYCLE', 'DAILY', 'DANCE', 'DATED', 'DEALT',
    'DEATH', 'DEBUT', 'DELAY', 'DELTA', 'DENSE', 'DEPOT', 'DEPTH', 'DERBY',
    'DETER', 'DIARY', 'DIGIT', 'DINER', 'DIRTY', 'DISCO', 'DITCH', 'DODGE',
    'DOING', 'DONOR', 'DOUBT', 'DOZEN', 'DRAFT', 'DRAIN', 'DRAMA', 'DRANK'
  ];
  
  // Insert all words into trie
  twoLetterWords.forEach(word => trie.insert(word));
  commonWords.forEach(word => trie.insert(word));
  
  return trie;
};

// Global dictionary instance
const dictionary = createDictionary();

// Context
const GameContext = createContext<{
  state: GameState;
  startGame: (mode: GameMode) => void;
  placeWord: (tiles: PlacedTile[]) => void;
  submitWord: () => void;
  shuffleRack: () => void;
  exchangeTiles: (indices: number[]) => void;
  resetGame: () => void;
  removePlacedTile: (row: number, col: number) => void;
} | null>(null);

// Create initial board
const createEmptyBoard = (): CellType[][] => {
  const board: CellType[][] = [];
  for (let row = 0; row < 15; row++) {
    board[row] = [];
    for (let col = 0; col < 15; col++) {
      const key = `${row},${col}`;
      board[row][col] = {
        premium: PREMIUM_LAYOUT[key] || 'normal',
        premiumUsed: false,
      };
    }
  }
  return board;
};

// Create letter bag
const createLetterBag = (): TileType[] => {
  const bag: TileType[] = [];
  let id = 0;
  
  Object.entries(LETTER_DISTRIBUTION).forEach(([letter, info]) => {
    for (let i = 0; i < info.count; i++) {
      bag.push({
        letter,
        points: info.points,
        id: `tile-${id++}`,
        isBlank: letter === '_',
      });
    }
  });
  
  // Shuffle bag
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  
  return bag;
};

// Game Provider Component
const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<GameState>(() => {
    // Initialize state with default values
    const defaultState: GameState = {
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
    };

    // Only access localStorage on the client side
    if (typeof window !== 'undefined') {
      defaultState.highScores = {
        slow: parseInt(localStorage.getItem('rackrush-high-slow') || '0'),
        medium: parseInt(localStorage.getItem('rackrush-high-medium') || '0'),
        fast: parseInt(localStorage.getItem('rackrush-high-fast') || '0'),
      };
    }

    return defaultState;
  });

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

  const drawTiles = (count: number, currentBag: TileType[]): [TileType[], TileType[]] => {
    const drawn: TileType[] = [];
    const newBag = [...currentBag];
    
    for (let i = 0; i < count && newBag.length > 0; i++) {
      drawn.push(newBag.pop()!);
    }
    
    return [drawn, newBag];
  };

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
    });
  };

  const validatePlacement = (tiles: PlacedTile[], board: CellType[][], isFirstMove: boolean): { valid: boolean; error?: string } => {
    if (tiles.length === 0) return { valid: false, error: "No tiles placed" };
    
    // Check first move crosses center
    if (isFirstMove) {
      const centerTile = tiles.find(t => t.row === 7 && t.col === 7);
      if (!centerTile) {
        return { valid: false, error: "First word must cross center star" };
      }
    }
    
    // Check all tiles are in a straight line
    const rows = tiles.map(t => t.row);
    const cols = tiles.map(t => t.col);
    const uniqueRows = new Set(rows);
    const uniqueCols = new Set(cols);
    
    const isHorizontal = uniqueRows.size === 1;
    const isVertical = uniqueCols.size === 1;
    
    if (!isHorizontal && !isVertical) {
      return { valid: false, error: "Tiles must be in a straight line" };
    }
    
    // Sort tiles by position
    const sortedTiles = [...tiles].sort((a, b) => {
      if (isHorizontal) return a.col - b.col;
      return a.row - b.row;
    });
    
    // Check for gaps between placed tiles
    for (let i = 1; i < sortedTiles.length; i++) {
      const prev = sortedTiles[i - 1];
      const curr = sortedTiles[i];
      
      if (isHorizontal) {
        let hasGap = false;
        for (let col = prev.col + 1; col < curr.col; col++) {
          if (!board[prev.row][col].tile) {
            hasGap = true;
            break;
          }
        }
        if (hasGap) {
          return { valid: false, error: "Word cannot have gaps" };
        }
      } else {
        let hasGap = false;
        for (let row = prev.row + 1; row < curr.row; row++) {
          if (!board[row][prev.col].tile) {
            hasGap = true;
            break;
          }
        }
        if (hasGap) {
          return { valid: false, error: "Word cannot have gaps" };
        }
      }
    }
    
    // Check if word connects to existing tiles (except first move)
    if (!isFirstMove) {
      let connectsToExisting = false;
      
      for (const { row, col } of tiles) {
        // Check adjacent cells
        const adjacentCells = [
          { r: row - 1, c: col },
          { r: row + 1, c: col },
          { r: row, c: col - 1 },
          { r: row, c: col + 1 },
        ];
        
        for (const { r, c } of adjacentCells) {
          if (r >= 0 && r < 15 && c >= 0 && c < 15) {
            if (board[r][c].tile && !tiles.some(t => t.row === r && t.col === c)) {
              connectsToExisting = true;
              break;
            }
          }
        }
        
        if (connectsToExisting) break;
      }
      
      if (!connectsToExisting) {
        return { valid: false, error: "Word must connect to existing tiles" };
      }
    }
    
    return { valid: true };
  };

  const getFormedWords = (placedTiles: PlacedTile[], board: CellType[][]): { word: string; tiles: PlacedTile[] }[] => {
    const words: { word: string; tiles: PlacedTile[] }[] = [];
    const processedPositions = new Set<string>();
    
    // Create temporary board with placed tiles
    const tempBoard = board.map(row => row.map(cell => ({ ...cell })));
    placedTiles.forEach(({ row, col, tile }) => {
      tempBoard[row][col] = { ...tempBoard[row][col], tile };
    });
    
    // Get main word
    const rows = placedTiles.map(t => t.row);
    const cols = placedTiles.map(t => t.col);
    const isHorizontal = new Set(rows).size === 1;
    const isVertical = new Set(cols).size === 1;
    
    if (isHorizontal) {
      const row = rows[0];
      let startCol = Math.min(...cols);
      let endCol = Math.max(...cols);
      
      // Extend to include existing tiles
      while (startCol > 0 && tempBoard[row][startCol - 1].tile) startCol--;
      while (endCol < 14 && tempBoard[row][endCol + 1].tile) endCol++;
      
      let word = '';
      const wordTiles: PlacedTile[] = [];
      
      for (let col = startCol; col <= endCol; col++) {
        const tile = tempBoard[row][col].tile;
        if (tile) {
          word += tile.letter;
          const placedTile = placedTiles.find(t => t.row === row && t.col === col);
          if (placedTile) {
            wordTiles.push(placedTile);
          }
          processedPositions.add(`${row},${col}`);
        }
      }
      
      if (word.length > 1) {
        words.push({ word, tiles: wordTiles });
      }
    } else if (isVertical) {
      const col = cols[0];
      let startRow = Math.min(...rows);
      let endRow = Math.max(...rows);
      
      while (startRow > 0 && tempBoard[startRow - 1][col].tile) startRow--;
      while (endRow < 14 && tempBoard[endRow + 1][col].tile) endRow++;
      
      let word = '';
      const wordTiles: PlacedTile[] = [];
      
      for (let row = startRow; row <= endRow; row++) {
        const tile = tempBoard[row][col].tile;
        if (tile) {
          word += tile.letter;
          const placedTile = placedTiles.find(t => t.row === row && t.col === col);
          if (placedTile) {
            wordTiles.push(placedTile);
          }
          processedPositions.add(`${row},${col}`);
        }
      }
      
      if (word.length > 1) {
        words.push({ word, tiles: wordTiles });
      }
    }
    
    // Check perpendicular words formed by each placed tile
    placedTiles.forEach(({ row, col }) => {
      if (isHorizontal) {
        // Check vertical word
        let startRow = row;
        let endRow = row;
        
        while (startRow > 0 && tempBoard[startRow - 1][col].tile) startRow--;
        while (endRow < 14 && tempBoard[endRow + 1][col].tile) endRow++;
        
        if (startRow < row || endRow > row) {
          let word = '';
          const wordTiles: PlacedTile[] = [];
          
          for (let r = startRow; r <= endRow; r++) {
            const tile = tempBoard[r][col].tile;
            if (tile) {
              word += tile.letter;
              if (r === row) {
                wordTiles.push({ row, col, tile });
              }
            }
          }
          
          if (word.length > 1) {
            words.push({ word, tiles: wordTiles });
          }
        }
      } else {
        // Check horizontal word
        let startCol = col;
        let endCol = col;
        
        while (startCol > 0 && tempBoard[row][startCol - 1].tile) startCol--;
        while (endCol < 14 && tempBoard[row][endCol + 1].tile) endCol++;
        
        if (startCol < col || endCol > col) {
          let word = '';
          const wordTiles: PlacedTile[] = [];
          
          for (let c = startCol; c <= endCol; c++) {
            const tile = tempBoard[row][c].tile;
            if (tile) {
              word += tile.letter;
              if (c === col) {
                wordTiles.push({ row, col, tile });
              }
            }
          }
          
          if (word.length > 1) {
            words.push({ word, tiles: wordTiles });
          }
        }
      }
    });
    
    return words;
  };

  const calculateScore = (wordTiles: PlacedTile[], board: CellType[][]): number => {
    let totalScore = 0;
    let wordMultiplier = 1;
    
    wordTiles.forEach(({ row, col, tile }) => {
      let tileScore = tile.points;
      const cell = board[row][col];
      
      if (!cell.premiumUsed) {
        switch (cell.premium) {
          case 'DL':
            tileScore *= 2;
            break;
          case 'TL':
            tileScore *= 3;
            break;
          case 'DW':
            wordMultiplier *= 2;
            break;
          case 'TW':
            wordMultiplier *= 3;
            break;
        }
      }
      
      totalScore += tileScore;
    });
    
    totalScore *= wordMultiplier;
    
    return totalScore;
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
      // Show error message
      console.log('Invalid placement:', placementResult.error);
      setState(prev => ({ ...prev, placedTiles: [] }));
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
        if (newStrikes >= 3) {
          return { ...prev, strikes: newStrikes, phase: 'end', placedTiles: [] };
        }
        return { ...prev, strikes: newStrikes, placedTiles: [] };
      });
      return;
    }
    
    // Calculate total score
    let moveScore = 0;
    formedWords.forEach(({ tiles }) => {
      moveScore += calculateScore(tiles, state.board);
    });
    
    // 50 point bonus for using all 7 tiles
    if (state.placedTiles.length === 7) {
      moveScore += 50;
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
    const [drawnTiles, newBag] = drawTiles(7 - newRack.length, state.letterBag);
    
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
      phase: newScore >= target ? 'end' : prev.phase,
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
    if (state.letterBag.length < indices.length) return;
    
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
    }}>
      {children}
    </GameContext.Provider>
  );
};

// Board Component
const Board: React.FC = () => {
  const context = useContext(GameContext);
  if (!context) return null;
  
  const { state, placeWord, removePlacedTile } = context;
  const [selectedTile, setSelectedTile] = useState<{ tile: TileType; rackIndex: number } | null>(null);

  const handleCellClick = (row: number, col: number) => {
    // Check if there's already a placed tile here
    const existingPlacedTile = state.placedTiles.find(t => t.row === row && t.col === col);
    
    if (existingPlacedTile) {
      // Remove the placed tile
      removePlacedTile(row, col);
      return;
    }
    
    // Check if cell already has a permanent tile
    if (state.board[row][col].tile) return;
    
    // Check if we have a selected tile from rack
    if (!selectedTile) return;
    
    // Add new placed tile
    const newPlacedTiles = [...state.placedTiles, { row, col, tile: selectedTile.tile }];
    placeWord(newPlacedTiles);
    
    // Clear selection
    setSelectedTile(null);
  };

  const getCellClass = (cell: CellType, row: number, col: number) => {
    let baseClass = "w-10 h-10 border border-gray-300 flex items-center justify-center text-xs font-bold relative cursor-pointer transition-all ";
    
    const placedTile = state.placedTiles.find(t => t.row === row && t.col === col);
    
    if (cell.tile || placedTile) {
      baseClass += "bg-amber-300 ";
      if (placedTile) {
        baseClass += "ring-2 ring-blue-500 ";
      }
    } else if (row === 7 && col === 7) {
      baseClass += "bg-pink-200 ";
    } else {
      switch (cell.premium) {
        case 'TW':
          baseClass += "bg-red-500 text-white ";
          break;
        case 'DW':
          baseClass += "bg-pink-400 text-white ";
          break;
        case 'TL':
          baseClass += "bg-blue-500 text-white ";
          break;
        case 'DL':
          baseClass += "bg-blue-300 text-white ";
          break;
        default:
          baseClass += "bg-green-50 ";
      }
    }
    
    return baseClass;
  };

  return (
    <div>
      <div className="inline-block border-2 border-gray-800">
        {state.board.map((row, rowIndex) => (
          <div key={rowIndex} className="flex">
            {row.map((cell, colIndex) => {
              const placedTile = state.placedTiles.find(t => t.row === rowIndex && t.col === colIndex);
              const displayTile = placedTile?.tile || cell.tile;
              
              return (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={getCellClass(cell, rowIndex, colIndex)}
                  onClick={() => handleCellClick(rowIndex, colIndex)}
                >
                  {displayTile ? (
                    <>
                      <span className="text-lg text-gray-800">{displayTile.letter}</span>
                      <span className="absolute bottom-0 right-1 text-[8px] text-gray-700">
                        {displayTile.points}
                      </span>
                    </>
                  ) : (
                    rowIndex === 7 && colIndex === 7 ? '★' : 
                    cell.premium !== 'normal' ? cell.premium : ''
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      
      {/* Rack component integrated here for tile selection */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">Your Rack:</h3>
        <div className="flex gap-2 p-4 bg-amber-100 dark:bg-amber-900 rounded-lg">
          {state.rack.map((tile, index) => {
            const isUsed = state.placedTiles.some(p => p.tile.id === tile.id);
            if (isUsed) return null;
            
            return (
              <div
                key={tile.id}
                className={`w-12 h-12 bg-amber-300 border-2 border-amber-600 rounded flex items-center justify-center cursor-pointer relative transition-transform hover:scale-110 ${
                  selectedTile?.tile.id === tile.id ? 'ring-2 ring-blue-500 scale-110' : ''
                }`}
                onClick={() => setSelectedTile({ tile, rackIndex: index })}
              >
                <span className="text-xl font-bold text-gray-800">{tile.letter}</span>
                <span className="absolute bottom-0 right-1 text-[10px] font-semibold text-gray-700">
                  {tile.points}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Timer Component
const Timer: React.FC = () => {
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

// Strike Display Component
const StrikeDisplay: React.FC = () => {
  const context = useContext(GameContext);
  if (!context) return null;
  
  const { state } = context;
  
  return (
    <div className="flex gap-2">
      {[0, 1, 2].map(i => (
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

// How To Play Modal
const HowToPlayModal: React.FC = () => {
  const context = useContext(GameContext);
  if (!context) return null;
  
  const { state, startGame } = context;
  
  if (state.phase !== 'ready') return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-2xl mx-4">
        <h1 className="text-4xl font-bold text-center mb-6 text-purple-600 dark:text-purple-400">
          RACK RUSH
        </h1>
        
        <div className="mb-6 space-y-3">
          <h2 className="text-xl font-semibold mb-2">How to Play:</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
            <li>Form words on the board using your 7-tile rack</li>
            <li>First word must cross the center star</li>
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
              onClick={() => startGame('slow')}
              className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              <div className="font-bold">SLOW</div>
              <div className="text-xs">10 min • 300 pts</div>
            </button>
            <button
              onClick={() => startGame('medium')}
              className="px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
            >
              <div className="font-bold">MEDIUM</div>
              <div className="text-xs">6 min • 200 pts</div>
            </button>
            <button
              onClick={() => startGame('fast')}
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

// Game Screen Component
const GameScreen: React.FC = () => {
  const context = useContext(GameContext);
  if (!context) return null;
  
  const { state, submitWord, shuffleRack, exchangeTiles } = context;
  
  if (state.phase !== 'play') return null;
  
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
        
        <div className="flex gap-4">
          <button
            onClick={shuffleRack}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Shuffle
          </button>
          <button
            onClick={() => exchangeTiles([])}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
            disabled={state.letterBag.length === 0}
          >
            Exchange
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
          {state.placedTiles.length > 0 && (
            <p className="mt-2 text-green-600">
              {state.placedTiles.length} tile{state.placedTiles.length > 1 ? 's' : ''} placed
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// End Screen Component
const EndScreen: React.FC = () => {
  const context = useContext(GameContext);
  const { transitionTo } = usePageTransition();
  const [hasSavedHighScore, setHasSavedHighScore] = useState(false);
  
  useEffect(() => {
    if (!context || context.state.phase !== 'end') return;
    
    const { state } = context;
    const isHighScore = state.score > state.highScores[state.mode];
    
    if (isHighScore && state.score > 0 && !hasSavedHighScore) {
      localStorage.setItem(`rackrush-high-${state.mode}`, state.score.toString());
      setHasSavedHighScore(true);
    }
  }, [context, hasSavedHighScore]);
  
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
            onClick={() => transitionTo('/')}
            className="w-full px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-semibold"
          >
            Back to Portfolio
          </button>
        </div>
      </div>
    </div>
  );
};

// Main Circuit Page Component
export default function CircuitPage() {
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
        </div>
      </GameProvider>
    </PageTransition>
  );
}