// Dictionary utilities using O(1) word lookup from TWL06
import { 
  loadWordDatabase, 
  isValidWord, 
  isValidWordSync, 
  getWordCount, 
  isDatabaseLoaded 
} from './words-database';

/**
 * Check if a word is valid in the Scrabble dictionary (async)
 * Uses O(1) lookup time after initial loading
 */
export const isValidScrabbleWord = async (word: string): Promise<boolean> => {
  if (!word || word.length < 2) {
    return false;
  }
  return isValidWord(word);
};

/**
 * Check if a word is valid in the Scrabble dictionary (sync)
 * Only works after the dictionary has been loaded
 * Returns false if dictionary not loaded yet
 */
export const isValidScrabbleWordSync = (word: string): boolean => {
  if (!word || word.length < 2) {
    return false;
  }
  return isValidWordSync(word);
};

/**
 * Initialize the dictionary by loading all words
 * Returns a promise that resolves when loading is complete
 */
export const initializeDictionary = async (): Promise<void> => {
  await loadWordDatabase();
};

/**
 * Get statistics about the loaded dictionary
 */
export const getDictionaryStats = () => {
  return {
    isLoaded: isDatabaseLoaded(),
    wordCount: getWordCount(),
    source: 'TWL06 (Tournament Word List 2006)'
  };
};

/**
 * Legacy compatibility - maintains the same interface
 * @deprecated Use isValidScrabbleWord or isValidScrabbleWordSync instead
 */
export const dictionary = {
  search: (word: string): boolean => {
    return isValidScrabbleWordSync(word);
  }
};

// Auto-initialize the dictionary when this module is imported
initializeDictionary().catch(console.error); 