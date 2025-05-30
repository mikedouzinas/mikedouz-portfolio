import { TileType, CellType, PlacedTile } from '../types';
import { LETTER_DISTRIBUTION } from '../constants';

// Create letter bag
export const createLetterBag = (): TileType[] => {
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

// Draw tiles from bag
export const drawTiles = (count: number, currentBag: TileType[]): [TileType[], TileType[]] => {
  const drawn: TileType[] = [];
  const newBag = [...currentBag];
  
  for (let i = 0; i < count && newBag.length > 0; i++) {
    drawn.push(newBag.pop()!);
  }
  
  return [drawn, newBag];
};

// Get all words formed by placed tiles
export const getFormedWords = (placedTiles: PlacedTile[], board: CellType[][]): { word: string; tiles: PlacedTile[] }[] => {
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

// Calculate score for a word
export const calculateScore = (wordTiles: PlacedTile[], board: CellType[][]): number => {
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