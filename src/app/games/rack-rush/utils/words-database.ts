// Words database for O(1) word lookup
let wordSet: Set<string> | null = null;
let loadingPromise: Promise<Set<string>> | null = null;

/**
 * Load all words from the TWL06 dictionary file into a Set for O(1) lookup
 */
export const loadWordDatabase = async (): Promise<Set<string>> => {
  // Return existing promise if already loading
  if (loadingPromise) {
    return loadingPromise;
  }
  
  // Return cached set if already loaded
  if (wordSet) {
    return wordSet;
  }
  
  // Start loading
  loadingPromise = (async () => {
    try {
      const response = await fetch('/twl06.txt');
      if (!response.ok) {
        throw new Error(`Failed to load word database: ${response.statusText}`);
      }
      
      const text = await response.text();
      const words = text.trim().split('\n').map(word => word.trim().toUpperCase());
      
      wordSet = new Set(words);
      console.log(`Loaded ${wordSet.size} words into dictionary`);
      
      return wordSet;
    } catch (error) {
      console.error('Error loading word database:', error);
      // Fallback to empty set
      wordSet = new Set();
      return wordSet;
    }
  })();
  
  return loadingPromise;
};

/**
 * Check if a word is valid (O(1) lookup)
 */
export const isValidWord = async (word: string): Promise<boolean> => {
  const words = await loadWordDatabase();
  return words.has(word.toUpperCase());
};

/**
 * Synchronous word check - only works after database is loaded
 */
export const isValidWordSync = (word: string): boolean => {
  if (!wordSet) {
    console.warn('Word database not loaded yet. Use isValidWord() for async loading.');
    return false;
  }
  return wordSet.has(word.toUpperCase());
};

/**
 * Get the number of words in the database
 */
export const getWordCount = (): number => {
  return wordSet?.size ?? 0;
};

/**
 * Check if the database is loaded
 */
export const isDatabaseLoaded = (): boolean => {
  return wordSet !== null;
};

// Pre-load the database when this module is imported (optional)
// You can comment this out if you prefer to load on-demand
loadWordDatabase().catch(console.error); 