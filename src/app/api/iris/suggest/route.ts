/**
 * Iris Suggestions API
 * 
 * GET /api/iris/suggest?q=<query>&signals=<signals_json>
 * 
 * Returns 5 suggestions using hybrid approach:
 * - Top suggestion: exact user text (if non-empty)
 * - 4 predicted completions from Fuse.js + optional LLM refinement
 * - If no text: default suggestions reordered by user signals
 * 
 * All suggestions are within allowed intents and include action metadata.
 */

import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/iris/config';
import { isAllowedIntent, rewriteToValidQuery } from '@/lib/iris/intents';
import { getSuggestionsLocal, initializeTypeahead } from '@/lib/iris/typeahead';
import { getDefaultSuggestions, type IrisSuggestion } from '@/data/iris/suggestions';
import type { SignalSummary } from '@/lib/iris/signals';

// Initialize typeahead on first load
let initPromise: Promise<void> | null = null;

async function ensureInitialized() {
  if (!initPromise) {
    initPromise = initializeTypeahead();
  }
  await initPromise;
}

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const signalsParam = searchParams.get('signals');
    
    // Parse signals if provided
    let signals: SignalSummary | undefined;
    if (signalsParam) {
      try {
        signals = JSON.parse(signalsParam);
      } catch (error) {
        console.warn('Invalid signals parameter:', error);
      }
    }
    
    // Ensure typeahead is initialized
    await ensureInitialized();
    
    // Generate suggestions based on query presence
    let suggestions: IrisSuggestion[];
    
    if (!query.trim()) {
      // No query: return default suggestions reordered by signals
      suggestions = getDefaultSuggestions(signals, 5);
    } else {
      // Has query: hybrid approach
      suggestions = await generateHybridSuggestions(query.trim(), signals);
    }
    
    // Convert to API format
    const items = suggestions.map(suggestion => ({
      title: suggestion.title,
      subtitle: suggestion.subtitle,
      icon: suggestion.icon,
      action: suggestion.action
    }));
    
    return NextResponse.json({ 
      items,
      query,
      cached: false, // TODO: implement caching metadata
      timing: Date.now() // Simple timestamp for debugging
    });
    
  } catch (error) {
    console.error('Suggestions API error:', error);
    
    // Return safe fallback suggestions
    const fallbackSuggestions = getDefaultSuggestions(undefined, 5);
    const items = fallbackSuggestions.map(suggestion => ({
      title: suggestion.title,
      subtitle: suggestion.subtitle,
      icon: suggestion.icon,
      action: suggestion.action
    }));
    
    return NextResponse.json({ 
      items,
      error: 'Failed to generate suggestions',
      fallback: true
    }, { status: 200 }); // Return 200 with fallback data rather than 500
  }
}

/**
 * Generate hybrid suggestions: exact text + predicted completions
 */
async function generateHybridSuggestions(
  query: string,
  signals?: SignalSummary
): Promise<IrisSuggestion[]> {
  const suggestions: IrisSuggestion[] = [];
  
  // First suggestion: exact user text (if allowed)
  const exactSuggestion = createExactSuggestion(query);
  if (exactSuggestion) {
    suggestions.push(exactSuggestion);
  }
  
  // Get local completions from Fuse.js
  const localCompletions = getSuggestionsLocal(query, signals, 4);
  
  // Convert local completions to suggestion objects
  const localSuggestions = localCompletions.map((text, index) => 
    createSuggestionFromText(text, `local-${index}`)
  ).filter(Boolean) as IrisSuggestion[];
  
  suggestions.push(...localSuggestions);
  
  // Optional LLM refinement (if enabled and query is substantial)
  if (config.useLLMSuggest && query.length > 5) {
    try {
      const llmSuggestions = await getLLMRefinedSuggestions(query, suggestions);
      
      // Merge LLM suggestions, avoiding duplicates
      const existingTexts = suggestions.map(s => s.title.toLowerCase());
      const newLLMSuggestions = llmSuggestions.filter(s => 
        !existingTexts.includes(s.title.toLowerCase())
      );
      
      suggestions.push(...newLLMSuggestions);
    } catch (error) {
      console.warn('LLM suggestion refinement failed:', error);
      // Continue with local suggestions only
    }
  }
  
  // Ensure all suggestions are within allowed intents
  const validSuggestions = suggestions.filter(suggestion => {
    const query = suggestion.action.payload;
    return isAllowedIntent(query) || suggestion.action.type !== 'ask';
  });
  
  console.log(`[Suggest API] Query: "${query}" - Returning ${validSuggestions.length} suggestions`);
  
  // Don't fill with defaults - only return actual matches
  // This prevents showing irrelevant suggestions for poor matches
  return validSuggestions;
}

/**
 * Create suggestion from exact user text if it's valid
 */
function createExactSuggestion(query: string): IrisSuggestion | null {
  // Check if query is in allowed scope
  if (isAllowedIntent(query)) {
    return {
      id: 'exact-query',
      title: query,
      subtitle: 'Ask Iris about this',
      icon: 'MessageSquare',
      action: { type: 'ask', payload: query },
      weight: 1.0
    };
  }
  
  // Try to rewrite out-of-scope query
  const rewritten = rewriteToValidQuery(query);
  if (rewritten) {
    return {
      id: 'rewritten-query',
      title: rewritten,
      subtitle: 'Related question',
      icon: 'ArrowRight',
      action: { type: 'ask', payload: rewritten },
      weight: 1.0
    };
  }
  
  return null;
}

/**
 * Create suggestion object from text string
 */
function createSuggestionFromText(text: string, id: string): IrisSuggestion | null {
  if (!text || !isAllowedIntent(text)) {
    return null;
  }
  
  // Determine appropriate icon based on text content
  const icon = getIconForText(text);
  
  return {
    id,
    title: text,
    icon,
    action: { type: 'ask', payload: text },
    weight: 0.8
  };
}

/**
 * Get appropriate icon for suggestion text
 */
function getIconForText(text: string): string {
  const lower = text.toLowerCase();
  
  if (lower.includes('project') || lower.includes('built')) return 'FolderOpen';
  if (lower.includes('experience') || lower.includes('work')) return 'Briefcase';
  if (lower.includes('contact') || lower.includes('email')) return 'Mail';
  if (lower.includes('values') || lower.includes('philosophy')) return 'Heart';
  if (lower.includes('tech') || lower.includes('skill')) return 'Code';
  if (lower.includes('playground') || lower.includes('experiment')) return 'Rocket';
  if (lower.includes('rack rush') || lower.includes('game')) return 'Gamepad2';
  if (lower.includes('language') || lower.includes('speak')) return 'Globe';
  if (lower.includes('barcelona') || lower.includes('fun')) return 'Star';
  if (lower.includes('available') || lower.includes('opportunity')) return 'Calendar';
  if (lower.includes('recent') || lower.includes('new')) return 'Clock';
  
  return 'Search'; // Default icon
}

/**
 * Get LLM-refined suggestions (optional enhancement)
 */
async function getLLMRefinedSuggestions(
  query: string,
  existingSuggestions: IrisSuggestion[]
): Promise<IrisSuggestion[]> {
  // This would call OpenAI to refine suggestions
  // For now, return empty array to keep API fast
  // TODO: Implement with proper timeout and error handling
  console.log('LLM refinement for query:', query, 'with suggestions:', existingSuggestions.length);
  
  return [];
}

/**
 * Health check endpoint
 */
export async function HEAD() {
  try {
    await ensureInitialized();
    return new NextResponse(null, { status: 200 });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
