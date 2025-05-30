import { GameMode } from './types';

// Premium square layout for standard Scrabble board
export const PREMIUM_LAYOUT: { [key: string]: 'TW' | 'DW' | 'TL' | 'DL' } = {
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
export const LETTER_DISTRIBUTION: { [key: string]: { count: number; points: number } } = {
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
export const GAME_CONFIG: Record<GameMode, { time: number; target: number }> = {
  slow: { time: 600, target: 300 }, // 10 minutes
  medium: { time: 360, target: 200 }, // 6 minutes
  fast: { time: 180, target: 120 }, // 3 minutes
};

export const BOARD_SIZE = 15;
export const RACK_SIZE = 7;
export const BINGO_BONUS = 50; // Bonus for using all 7 tiles
export const MAX_STRIKES = 3;
export const MAX_EXCHANGES = 2; 