// KBItem type not needed in this file

// Types for enhanced typeahead
export interface TypeaheadItem {
  id: string;
  kind?: string;
  title: string;
  summary?: string;
  tags?: string[];
  aliases?: string[];
  questions?: string[];
  patterns?: string[];
}

export interface TypeaheadData {
  items: TypeaheadItem[];
  searchIndex: Array<{
    id: string;
    searchText: string;
  }>;
  metadata: {
    generated: string;
    itemCount: number;
    questionCount: number;
  };
}

export interface TypeaheadResult {
  id: string;
  kind?: string;
  text: string; // The actual text to show/complete
  displayText?: string; // Optional different display text
  score: number;
  matchType: 'exact' | 'question' | 'pattern' | 'fuzzy';
  metadata?: {
    originalTitle?: string;
    itemKind?: string;
  };
}

/**
 * Enhanced typeahead with question/sentence completion
 * Uses a multi-stage matching strategy:
 * 1. Exact prefix matches on questions/patterns
 * 2. Word-boundary matches on questions/patterns
 * 3. Fuzzy matches on all content
 * 4. Smart completions based on partial sentences
 */
export class TypeaheadV2 {
  private data: TypeaheadData;
  private questionMap: Map<string, { itemId: string; question: string }[]> = new Map();
  private patternMap: Map<string, { itemId: string; pattern: string }[]> = new Map();

  constructor(data: TypeaheadData) {
    this.data = data;
    this.buildIndices();
  }

  private buildIndices() {
    // Build question index for fast lookups
    for (const item of this.data.items) {
      if (item.questions) {
        for (const question of item.questions) {
          const words = question.toLowerCase().split(/\s+/);
          for (let i = 0; i < words.length; i++) {
            const prefix = words.slice(0, i + 1).join(' ');
            if (!this.questionMap.has(prefix)) {
              this.questionMap.set(prefix, []);
            }
            this.questionMap.get(prefix)!.push({ itemId: item.id, question });
          }
        }
      }
      
      if (item.patterns) {
        for (const pattern of item.patterns) {
          const words = pattern.toLowerCase().split(/\s+/);
          for (let i = 0; i < words.length; i++) {
            const prefix = words.slice(0, i + 1).join(' ');
            if (!this.patternMap.has(prefix)) {
              this.patternMap.set(prefix, []);
            }
            this.patternMap.get(prefix)!.push({ itemId: item.id, pattern });
          }
        }
      }
    }
  }

  suggest(query: string, limit: number = 6): TypeaheadResult[] {
    if (!query || query.trim().length === 0) {
      return this.getDefaultSuggestions(limit);
    }

    const queryLower = query.toLowerCase().trim();
    const results: TypeaheadResult[] = [];
    const seen = new Set<string>();

    // Stage 1: Exact question/pattern prefix matches
    const exactQuestions = this.questionMap.get(queryLower) || [];
    for (const { itemId, question } of exactQuestions) {
      if (!seen.has(question)) {
        seen.add(question);
        results.push({
          id: itemId,
          text: question,
          score: 1.0,
          matchType: 'question',
          kind: 'question',
        });
      }
    }

    const exactPatterns = this.patternMap.get(queryLower) || [];
    for (const { itemId, pattern } of exactPatterns) {
      if (!seen.has(pattern)) {
        seen.add(pattern);
        results.push({
          id: itemId,
          text: pattern,
          score: 1.0,
          matchType: 'pattern',
          kind: 'pattern',
        });
      }
    }

    // Stage 2: Smart completions for partial sentences
    const completions = this.generateCompletions(queryLower);
    for (const completion of completions) {
      if (!seen.has(completion.text)) {
        seen.add(completion.text);
        results.push(completion);
      }
    }

    // Stage 3: Fuzzy search on all content
    const fuzzyResults = this.fuzzySearch(queryLower, limit * 2);
    for (const result of fuzzyResults) {
      if (!seen.has(result.text)) {
        seen.add(result.text);
        results.push(result);
      }
    }

    // Sort by score and match type preference
    return results
      .sort((a, b) => {
        // Prefer questions/patterns over fuzzy matches
        const typeOrder = { question: 0, pattern: 1, exact: 2, fuzzy: 3 };
        const typeA = typeOrder[a.matchType] ?? 3;
        const typeB = typeOrder[b.matchType] ?? 3;
        
        if (typeA !== typeB) return typeA - typeB;
        return b.score - a.score;
      })
      .slice(0, limit);
  }

  private generateCompletions(query: string): TypeaheadResult[] {
    const completions: TypeaheadResult[] = [];
    const words = query.split(/\s+/);
    // const lastWord = words[words.length - 1]; // Reserved for future use

    // Check for partial matches in questions
    for (const item of this.data.items) {
      if (item.questions) {
        for (const question of item.questions) {
          const questionLower = question.toLowerCase();
          if (questionLower.startsWith(query) && questionLower !== query) {
            completions.push({
              id: item.id,
              text: question,
              score: 0.9,
              matchType: 'question',
              kind: 'question',
              metadata: {
                originalTitle: item.title,
                itemKind: item.kind,
              },
            });
          }
        }
      }
    }

    // Contextual completions based on query patterns
    if (query.startsWith('what is ') || query.startsWith('tell me about ')) {
      // Suggest items that could complete these phrases
      const prefix = query.startsWith('what is ') ? 'what is ' : 'tell me about ';
      const partial = query.substring(prefix.length);
      
      for (const item of this.data.items) {
        if (item.title.toLowerCase().startsWith(partial)) {
          completions.push({
            id: item.id,
            text: `${prefix}${item.title}?`,
            score: 0.85,
            matchType: 'pattern',
            kind: 'question',
          });
        }
      }
    }

    // Technology-based completions
    if (query.endsWith(' projects') || query.endsWith(' experience')) {
      const techWord = words[words.length - 2];
      if (techWord) {
        for (const item of this.data.items) {
          if (item.kind === 'skill' && item.title.toLowerCase().includes(techWord)) {
            const suffix = query.endsWith(' projects') ? 'projects' : 'experience';
            completions.push({
              id: item.id,
              text: `${item.title} ${suffix}`,
              score: 0.8,
              matchType: 'pattern',
              kind: 'query',
            });
          }
        }
      }
    }

    return completions;
  }

  private fuzzySearch(query: string, limit: number): TypeaheadResult[] {
    const results: TypeaheadResult[] = [];
    const queryWords = query.split(/\s+/);

    for (const item of this.data.items) {
      const searchEntry = this.data.searchIndex.find(s => s.id === item.id);
      if (!searchEntry) continue;

      // Calculate relevance score
      let score = 0;
      const searchTextLower = searchEntry.searchText;

      // Check for word matches
      for (const word of queryWords) {
        if (searchTextLower.includes(word)) {
          score += 0.3;
          // Bonus for word boundary matches
          const wordBoundaryRegex = new RegExp(`\\b${word}`, 'i');
          if (wordBoundaryRegex.test(searchTextLower)) {
            score += 0.2;
          }
        }
      }

      // Bonus for title matches
      if (item.title.toLowerCase().includes(query)) {
        score += 0.3;
      }

      // Bonus for alias matches
      if (item.aliases?.some(alias => alias.toLowerCase().includes(query))) {
        score += 0.2;
      }

      if (score > 0) {
        results.push({
          id: item.id,
          text: item.title,
          score: Math.min(score, 0.7), // Cap fuzzy match scores
          matchType: 'fuzzy',
          kind: item.kind,
          displayText: item.summary ? `${item.title} - ${item.summary.substring(0, 50)}...` : undefined,
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private getDefaultSuggestions(limit: number): TypeaheadResult[] {
    // Return popular/recent queries when no input
    const defaults = [
      "What projects have you worked on?",
      "Tell me about your experience",
      "What technologies do you know?",
      "How can I contact you?",
      "What's your latest work?",
      "Do you know React?",
    ];

    return defaults.slice(0, limit).map((text, idx) => ({
      id: `default_${idx}`,
      text,
      score: 1.0,
      matchType: 'exact' as const,
      kind: 'question',
    }));
  }
}

// Factory function to create typeahead instance
export async function createTypeaheadV2(): Promise<TypeaheadV2> {
  try {
    // Try to load v2 data first
    const data = await import('@/data/iris/derived/typeahead_v2.json');
    return new TypeaheadV2(data as TypeaheadData);
  } catch {
    // Fallback to empty data if v2 not built yet
    console.warn('Typeahead v2 data not found, using empty data');
    return new TypeaheadV2({
      items: [],
      searchIndex: [],
      metadata: {
        generated: new Date().toISOString(),
        itemCount: 0,
        questionCount: 0,
      },
    });
  }
}