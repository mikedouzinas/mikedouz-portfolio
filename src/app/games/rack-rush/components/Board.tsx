"use client";
import React, { useState, useEffect, useContext, useCallback, DragEvent, useRef } from 'react';
import { GameContext } from '../context/GameContext';
import { TileType, CellType } from '../types';
import { BOARD_SIZE } from '../constants';

export const Board: React.FC = () => {
  const context = useContext(GameContext);
  const [selectedTile, setSelectedTile] = useState<{ tile: TileType; rackIndex: number } | null>(null);
  const [draggedTile, setDraggedTile] = useState<{ tile: TileType; fromRack: boolean; row?: number; col?: number } | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<{ row: number; col: number } | null>(null);
  const [direction, setDirection] = useState<'right' | 'down' | 'none'>('none');
  const [isDraggingToRack, setIsDraggingToRack] = useState(false);
  const prevPlacedTilesLength = useRef(0);

  // Helper function to find the last placed tile in the current sequence
  const findLastPlacedTileInSequence = useCallback((currentPos: { row: number; col: number }, dir: 'right' | 'down' | 'none') => {
    if (!context || dir === 'none' || context.state.placedTiles.length === 0) return null;
    
    // Get all placed tiles that are in line with our current position
    const tilesInSequence = context.state.placedTiles.filter(tile => {
      if (dir === 'right') {
        return tile.row === currentPos.row && tile.col < currentPos.col;
      } else if (dir === 'down') {
        return tile.col === currentPos.col && tile.row < currentPos.row;
      }
      return false;
    });
    
    if (tilesInSequence.length === 0) return null;
    
    // Sort by position and get the last one
    tilesInSequence.sort((a, b) => {
      if (dir === 'right') {
        return b.col - a.col; // Descending order for rightward
      } else {
        return b.row - a.row; // Descending order for downward
      }
    });
    
    return tilesInSequence[0];
  }, [context]);

  const getNextAvailablePosition = useCallback((position: { row: number; col: number }, dir: 'right' | 'down' | 'none', advance: boolean = false) => {
    if (!context || dir === 'none') return position;
    
    let nextRow = position.row;
    let nextCol = position.col;
    
    // If advance is true, start from the next position
    if (advance) {
      if (dir === 'right') {
        nextCol++;
      } else if (dir === 'down') {
        nextRow++;
      }
    }
    
    // Find the next available position
    while (nextRow < BOARD_SIZE && nextCol < BOARD_SIZE) {
      // Check if current position is available
      const cellHasTile = context.state.board[nextRow][nextCol].tile;
      const cellHasPlacedTile = context.state.placedTiles.some(t => t.row === nextRow && t.col === nextCol);
      
      if (!cellHasTile && !cellHasPlacedTile) {
        return { row: nextRow, col: nextCol };
      }
      
      // Move to next position based on direction
      if (dir === 'right') {
        nextCol++;
        if (nextCol >= BOARD_SIZE) return null; // Out of bounds
      } else if (dir === 'down') {
        nextRow++;
        if (nextRow >= BOARD_SIZE) return null; // Out of bounds
      }
    }
    
    return null; // No available position found
  }, [context]);

  // Handle typing from parent component
  const handleTyping = useCallback((letter: string): boolean => {
    if (!context) return false;
    
    const { state, placeWord, removePlacedTile, setBlankLetter } = context;
    
    // Handle backspace/delete
    if (letter === 'BACKSPACE' || letter === 'DELETE') {
      if (!selectedPosition || direction === 'none' || state.placedTiles.length === 0) {
        return false;
      }
      
      // Find the last placed tile that would be in our current word sequence
      const lastPlacedTile = findLastPlacedTileInSequence(selectedPosition, direction);
      
      if (lastPlacedTile) {
        // Remove the tile
        removePlacedTile(lastPlacedTile.row, lastPlacedTile.col);
        // Move selection back to that position
        setSelectedPosition({ row: lastPlacedTile.row, col: lastPlacedTile.col });
        return true;
      }
      
      return false;
    }

    // Only handle letter keys when a position is selected, direction is set, and no blank letter input is active
    if (!selectedPosition || direction === 'none' || state.blankLetterInput) {
      return false; // Return false to indicate we didn't handle it
    }
    
    // Find matching tile in rack (prefer non-blank tiles first)
    const availableRackTiles = state.rack.filter(tile => 
      !state.placedTiles.some(p => p.tile.id === tile.id)
    );
    
    let tileToPlace = availableRackTiles.find(tile => !tile.isBlank && tile.letter === letter);
    
    // If no exact match, use a blank tile
    if (!tileToPlace) {
      tileToPlace = availableRackTiles.find(tile => tile.isBlank);
      if (tileToPlace) {
        // Create a copy with the letter set
        tileToPlace = { ...tileToPlace, letter };
      }
    }
    
    if (!tileToPlace) {
      return false; // No available tile for this letter
    }
    
    // Check if the selected position is available
    const cellHasTile = state.board[selectedPosition.row][selectedPosition.col].tile;
    const cellHasPlacedTile = state.placedTiles.some(t => t.row === selectedPosition.row && t.col === selectedPosition.col);
    
    let targetPosition = selectedPosition;
    
    // If the selected position is occupied, find the next available position
    if (cellHasTile || cellHasPlacedTile) {
      const nextPos = getNextAvailablePosition(selectedPosition, direction, true);
      if (!nextPos) {
        return false;
      }
      targetPosition = nextPos;
    }
    
    // Place the tile
    const newPlacedTiles = [...state.placedTiles, { row: targetPosition.row, col: targetPosition.col, tile: tileToPlace }];
    placeWord(newPlacedTiles);
    
    // Update selected position to next available spot
    const nextPosition = getNextAvailablePosition(targetPosition, direction, true);
    if (nextPosition) {
      setSelectedPosition(nextPosition);
    }
    
    // If it was a blank tile, handle the blank letter input
    if (tileToPlace.isBlank) {
      setBlankLetter({ row: targetPosition.row, col: targetPosition.col, tile: tileToPlace });
    }

    return true; // Return true to indicate we handled it
  }, [selectedPosition, direction, context, findLastPlacedTileInSequence, getNextAvailablePosition]);

  // Expose the handler via imperative handle or callback
  useEffect(() => {
    if (!context) return;
    
    // Store the handler on the window object so GameScreen can call it
    (window as unknown as { boardTypingHandler?: (letter: string) => boolean }).boardTypingHandler = handleTyping;
    return () => {
      delete (window as unknown as { boardTypingHandler?: (letter: string) => boolean }).boardTypingHandler;
    };
  }, [handleTyping, context]);

  // Reset selected position when turn is played or no tiles available
  useEffect(() => {
    if (!context) return;
    
    const currentPlacedTilesLength = context.state.placedTiles.length;
    
    // Only reset when we transition from having tiles to no tiles (word was submitted)
    if (currentPlacedTilesLength === 0 && prevPlacedTilesLength.current > 0 && context.state.phase === 'play') {
      setSelectedPosition(null);
      setDirection('none');
    }
    
    // Update the ref for next render
    prevPlacedTilesLength.current = currentPlacedTilesLength;
  }, [context?.state.placedTiles.length, context?.state.phase, context]);

  if (!context) return null;
  
  const { state, placeWord, removePlacedTile } = context;

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
    
    // Check if there are any available tiles in the rack
    const availableRackTiles = state.rack.filter(tile => 
      !state.placedTiles.some(p => p.tile.id === tile.id)
    );
    
    // Don't allow selection if no tiles available (unless we have a selected tile from rack)
    if (availableRackTiles.length === 0 && !selectedTile) {
      return;
    }
    
    // If clicking on the same position, cycle through directions
    if (selectedPosition && selectedPosition.row === row && selectedPosition.col === col) {
      if (direction === 'none') {
        setDirection('right');
      } else if (direction === 'right') {
        setDirection('down');
      } else {
        setDirection('none');
        setSelectedPosition(null);
      }
      return;
    }
    
    // Set new selected position and start with right direction
    setSelectedPosition({ row, col });
    setDirection('right');
    
    // If we have a selected tile from rack, place it immediately
    if (selectedTile) {
      // If it's a blank tile, prompt for letter
      if (selectedTile.tile.isBlank) {
        const newPlacedTiles = [...state.placedTiles, { row, col, tile: selectedTile.tile }];
        placeWord(newPlacedTiles);
        context.setBlankLetter({ row, col, tile: selectedTile.tile });
        setSelectedTile(null);
        return;
      }
      
      // Add new placed tile
      const newPlacedTiles = [...state.placedTiles, { row, col, tile: selectedTile.tile }];
      placeWord(newPlacedTiles);
      
      // Clear selection
      setSelectedTile(null);
      
      // Move to next position
      const nextPosition = getNextAvailablePosition({ row, col }, direction, true);
      if (nextPosition && (nextPosition.row !== row || nextPosition.col !== col)) {
        setSelectedPosition(nextPosition);
      }
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, row: number, col: number) => {
    e.preventDefault();
    
    if (!draggedTile) return;
    
    // Check if there's already a placed tile here
    const existingPlacedTile = state.placedTiles.find(t => t.row === row && t.col === col);
    
    // If dropping on another placed tile, handle swapping
    if (existingPlacedTile) {
      if (draggedTile.fromRack) {
        // Dragging from rack onto board tile - replace board tile and return it to rack
        const newPlacedTiles = state.placedTiles.filter(t => !(t.row === row && t.col === col));
        newPlacedTiles.push({ row, col, tile: draggedTile.tile });
        placeWord(newPlacedTiles);
        
        // If the new tile is a blank, prompt for letter
        if (draggedTile.tile.isBlank) {
          context.setBlankLetter({ row, col, tile: draggedTile.tile });
        }
      } else if (draggedTile.row !== undefined && draggedTile.col !== undefined) {
        // Dragging from board to board - swap positions
        const newPlacedTiles = state.placedTiles.map(t => {
          if (t.row === row && t.col === col) {
            return { ...t, row: draggedTile.row!, col: draggedTile.col! };
          }
          if (t.row === draggedTile.row && t.col === draggedTile.col) {
            return { ...t, row, col };
          }
          return t;
        });
        placeWord(newPlacedTiles);
      }
      setDraggedTile(null);
      return;
    }
    
    // If dropping on an empty cell
    if (!state.board[row][col].tile) {
      // If dragging from another board position, remove from old position
      if (!draggedTile.fromRack && draggedTile.row !== undefined && draggedTile.col !== undefined) {
        removePlacedTile(draggedTile.row, draggedTile.col);
      }
      
      // Add new placed tile
      const newPlacedTiles = [...state.placedTiles.filter(t => !(t.row === draggedTile.row && t.col === draggedTile.col)), { row, col, tile: draggedTile.tile }];
      placeWord(newPlacedTiles);
      
      // If it's a blank tile, prompt for letter
      if (draggedTile.tile.isBlank) {
        context.setBlankLetter({ row, col, tile: draggedTile.tile });
      }
    }
    
    setDraggedTile(null);
    setIsDraggingToRack(false);
  };

  // Add rack drop handling
  const handleRackDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    if (!draggedTile) return;
    
    // If dragging from the board, remove the tile from the board
    if (!draggedTile.fromRack && draggedTile.row !== undefined && draggedTile.col !== undefined) {
      removePlacedTile(draggedTile.row, draggedTile.col);
    }
    
    setDraggedTile(null);
    setIsDraggingToRack(false);
  };

  const handleRackDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (draggedTile && !draggedTile.fromRack) {
      setIsDraggingToRack(true);
    }
  };

  const handleRackDragLeave = () => {
    setIsDraggingToRack(false);
  };

  // Add rack tile drag start handler
  const handleRackTileDragStart = (tile: TileType) => {
    // Check if this tile is already placed on the board
    const placedTile = state.placedTiles.find(p => p.tile.id === tile.id);
    if (placedTile) {
      setDraggedTile({ tile, fromRack: false, row: placedTile.row, col: placedTile.col });
    } else {
      setDraggedTile({ tile, fromRack: true });
    }
  };

  const getCellClass = (cell: CellType, row: number, col: number) => {
    let baseClass = "w-10 h-10 border border-gray-300 flex items-center justify-center text-xs font-bold relative cursor-pointer transition-all select-none ";
    
    const placedTile = state.placedTiles.find(t => t.row === row && t.col === col);
    const isSelected = selectedPosition && selectedPosition.row === row && selectedPosition.col === col;
    
    if (cell.tile || placedTile) {
      baseClass += "bg-amber-300 ";
      if (placedTile) {
        baseClass += "ring-2 ring-blue-500 ";
      }
    } else if (isSelected) {
      baseClass += "bg-blue-100 dark:bg-blue-900 ring-2 ring-blue-400 ";
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

  const renderDirectionArrow = (row: number, col: number) => {
    if (!selectedPosition || selectedPosition.row !== row || selectedPosition.col !== col || direction === 'none') {
      return null;
    }
    
    // Check if there are any available tiles in the rack
    const availableRackTiles = state.rack.filter(tile => 
      !state.placedTiles.some(p => p.tile.id === tile.id)
    );
    
    // Hide arrow if no tiles available
    if (availableRackTiles.length === 0) {
      return null;
    }
    
    return (
      <div className="absolute top-0 right-0 w-3 h-3 bg-blue-500 text-white text-[8px] flex items-center justify-center rounded-bl cursor-pointer hover:bg-blue-600 transition-colors z-10">
        {direction === 'right' ? '→' : '↓'}
      </div>
    );
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
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, rowIndex, colIndex)}
                >
                  {displayTile ? (
                    <div
                      draggable={!!placedTile}
                      onDragStart={() => placedTile && setDraggedTile({ tile: displayTile, fromRack: false, row: rowIndex, col: colIndex })}
                      className="w-full h-full flex items-center justify-center cursor-move select-none"
                    >
                      <span className="text-lg text-gray-800 select-none">{displayTile.letter}</span>
                      <span className="absolute bottom-0 right-1 text-[8px] text-gray-700 select-none">
                        {displayTile.points}
                      </span>
                    </div>
                  ) : (
                    <span className="select-none">
                      {rowIndex === 7 && colIndex === 7 ? '★' : 
                      cell.premium !== 'normal' ? cell.premium : ''}
                    </span>
                  )}
                  {renderDirectionArrow(rowIndex, colIndex)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      
      {/* Rack component with drop handling */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">Your Rack:</h3>
        <div 
          className={`flex gap-2 p-4 bg-amber-100 dark:bg-amber-900 rounded-lg transition-colors ${
            isDraggingToRack ? 'bg-amber-200 dark:bg-amber-800' : ''
          }`}
          onDragOver={handleRackDragOver}
          onDragLeave={handleRackDragLeave}
          onDrop={handleRackDrop}
        >
          {state.rack.map((tile) => {
            const isUsed = state.placedTiles.some(p => p.tile.id === tile.id);
            if (isUsed) return null;
            
            return (
              <div
                key={tile.id}
                draggable
                onDragStart={() => handleRackTileDragStart(tile)}
                className={`w-12 h-12 bg-amber-300 border-2 border-amber-600 rounded flex items-center justify-center cursor-pointer relative transition-transform hover:scale-110 select-none ${
                  selectedTile?.tile.id === tile.id ? 'ring-2 ring-blue-500 scale-110' : ''
                }`}
                onClick={() => setSelectedTile({ tile, rackIndex: state.rack.indexOf(tile) })}
              >
                <span className="text-xl font-bold text-gray-800 select-none">{tile.letter}</span>
                <span className="absolute bottom-0 right-1 text-[10px] font-semibold text-gray-700 select-none">
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