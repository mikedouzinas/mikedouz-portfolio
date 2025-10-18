/**
 * Iris Configuration
 * 
 * Central configuration for Iris command palette behavior, limits, and features.
 * This controls performance budgets, API limits, and feature toggles.
 */

export const config = {
  // Feature toggles
  useLLMSuggest: true,              // Enable hybrid Fuse + LLM refinement for suggestions
  
  // Rate limiting and session management
  maxAnswersPerSession: 20,         // Maximum answers per user session before soft cap
  
  // RAG and retrieval settings
  topK: 10,                         // Number of knowledge base chunks to retrieve for answers - increased for better context
  chunkSize: 400,                   // Size of KB chunks for embeddings (chars)
  
  // Caching and performance
  commitTtlMs: 24 * 60 * 60 * 1000, // Cache recent commits for 24 hours
  suggestDebounceMs: 150,           // Debounce suggestions API calls
  answerTimeoutMs: 400,             // Timeout for LLM suggestion refinement
  
  // GitHub integration
  repo: { 
    owner: 'mikedouzinas',             // GitHub repo owner for commit fetching
    name: 'mikedouz-portfolio'               // GitHub repo name for commit fetching
  },
  
  // Placeholder URLs (to be replaced with real endpoints)
  availabilityUrl: 'https://fantastical.app/mikeveson/mikeveson-meeting',
  
  // Performance budgets
  typeaheadMaxMs: 16,               // Local typeahead must respond under 16ms
  answerTargetLatencyMs: 1500,      // Target p50 latency for answers on broadband
  maxKBChunks: 100,                 // Maximum chunks to process for embeddings
  
  // OpenAI model configuration
  models: {
    query_processing: 'gpt-4o-mini',
    chat: 'gpt-4.1-mini',                // Nano is the cheapest model and will do for now
    embedding: 'text-embedding-3-small' // Embedding model for RAG
  },
  
  // Answer generation settings
  chatSettings: {
    temperature: 1,               // Slightly higher temperature for more natural, conversational responses
    maxTokens: 800,                 // Longer answers to provide more detailed, complete information
    stream: true                    // Enable streaming responses
  }
} as const;

/**
 * Environment variable requirements check
 * Validates that required environment variables are present
 */
export function validateEnvironment(): { valid: boolean; missing: string[] } {
  const required = ['OPENAI_API_KEY'];
  // const optional = ['GITHUB_TOKEN']; // Gracefully degrade if missing
  
  const missing = required.filter(key => !process.env[key]);
  
  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Runtime configuration that adapts based on environment
 */
export function getRuntimeConfig() {
  const hasGitHubToken = !!process.env.GITHUB_TOKEN;
  
  return {
    ...config,
    features: {
      ...config,
      githubIntegration: hasGitHubToken,
      // Disable LLM suggestions in development for faster iteration
      useLLMSuggest: config.useLLMSuggest && process.env.NODE_ENV === 'production'
    }
  };
}
