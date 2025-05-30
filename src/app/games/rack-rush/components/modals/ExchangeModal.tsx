import React from 'react';
import { TileType } from '../../types';

interface ExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTileIds: string[];
  onToggleTile: (tileId: string) => void;
  onExchange: () => void;
  rack: TileType[];
  placedTileIds: string[];
}

export const ExchangeModal: React.FC<ExchangeModalProps> = ({ 
  isOpen, 
  onClose, 
  selectedTileIds, 
  onToggleTile, 
  onExchange, 
  rack, 
  placedTileIds 
}) => {
  if (!isOpen) return null;

  const availableTiles = rack.filter(tile => !placedTileIds.includes(tile.id));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md mx-4">
        <h2 className="text-2xl font-bold mb-4 text-center">Exchange Tiles</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6 text-center">
          Select tiles to exchange from your rack
        </p>
        
        <div className="flex flex-wrap gap-2 justify-center mb-6">
          {availableTiles.map((tile) => {
            const isSelected = selectedTileIds.includes(tile.id);
            return (
              <div
                key={tile.id}
                onClick={() => onToggleTile(tile.id)}
                className={`w-12 h-12 border-2 rounded flex items-center justify-center cursor-pointer relative transition-all hover:scale-110 select-none ${
                  isSelected
                    ? 'bg-blue-300 border-blue-600 ring-2 ring-blue-500'
                    : 'bg-amber-300 border-amber-600 hover:border-amber-700'
                }`}
              >
                <span className="text-xl font-bold text-gray-800 select-none">{tile.letter}</span>
                <span className="absolute bottom-0 right-1 text-[10px] font-semibold text-gray-700 select-none">
                  {tile.points}
                </span>
                {isSelected && (
                  <div className="absolute top-0 right-0 w-4 h-4 bg-blue-500 text-white text-xs flex items-center justify-center rounded-full -translate-y-1 translate-x-1">
                    ✓
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        <div className="flex justify-center gap-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onExchange}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            disabled={selectedTileIds.length === 0}
          >
            Exchange {selectedTileIds.length} tile{selectedTileIds.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}; 