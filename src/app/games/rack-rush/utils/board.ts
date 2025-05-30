import { CellType, TileType, PlacedTile } from '../types';
import { BOARD_SIZE, PREMIUM_LAYOUT } from '../constants';

// Create empty board
export const createEmptyBoard = (): CellType[][] => {
  const board: CellType[][] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    board[row] = [];
    for (let col = 0; col < BOARD_SIZE; col++) {
      const key = `${row},${col}`;
      board[row][col] = {
        premium: PREMIUM_LAYOUT[key] || 'normal',
        premiumUsed: false,
      };
    }
  }
  return board;
};

// Validate tile placement
export const validatePlacement = (tiles: PlacedTile[], board: CellType[][], isFirstMove: boolean): { valid: boolean; error?: string } => {
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
        if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
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