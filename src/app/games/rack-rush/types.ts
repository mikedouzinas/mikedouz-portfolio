export type TileType = {
  letter: string;
  points: number;
  id: string;
  isBlank?: boolean;
};

export type CellType = {
  tile?: TileType;
  premium: 'TW' | 'DW' | 'TL' | 'DL' | 'normal';
  premiumUsed: boolean;
};

export type GamePhase = 'ready' | 'play' | 'end';
export type GameMode = 'slow' | 'medium' | 'fast';

export type PlacedTile = {
  row: number;
  col: number;
  tile: TileType;
};

export type PlayedWord = {
  word: string;
  score: number;
  timestamp: number;
};

export type GameState = {
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
  playedWords: PlayedWord[];
  blankLetterInput: { row: number; col: number; tile: TileType } | null;
  errorMessage: string | null;
  exchangesUsed: number;
};

export type GameContextType = {
  state: GameState;
  startGame: (mode: GameMode) => void;
  placeWord: (tiles: PlacedTile[]) => void;
  submitWord: () => void;
  shuffleRack: () => void;
  exchangeTiles: (indices: number[]) => void;
  resetGame: () => void;
  removePlacedTile: (row: number, col: number) => void;
  clearPlacedTiles: () => void;
  setBlankLetter: (input: { row: number; col: number; tile: TileType } | string) => void;
  cancelBlankLetter: () => void;
}; 