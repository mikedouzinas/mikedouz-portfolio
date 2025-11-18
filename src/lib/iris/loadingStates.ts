/**
 * Loading state phases for Iris query processing
 * Shows user exactly what's happening during query execution
 */
export type LoadingPhase =
  | 'detecting_intent'    // Analyzing query intent
  | 'searching'           // Searching knowledge base
  | 'analyzing'           // Analyzing results and building evidence
  | 'generating';         // Generating answer with LLM

/**
 * Get user-friendly label for loading phase
 */
export function getLoadingLabel(phase: LoadingPhase): string {
  switch (phase) {
    case 'detecting_intent':
      return 'Understanding your question...';
    case 'searching':
      return 'Searching knowledge base...';
    case 'analyzing':
      return 'Analyzing results...';
    case 'generating':
      return 'Generating answer...';
  }
}

/**
 * Get emoji icon for loading phase
 */
export function getLoadingIcon(phase: LoadingPhase): string {
  switch (phase) {
    case 'detecting_intent':
      return '🤔';
    case 'searching':
      return '🔍';
    case 'analyzing':
      return '🧠';
    case 'generating':
      return '✍️';
  }
}
