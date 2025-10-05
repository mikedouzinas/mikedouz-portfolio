/**
 * Intent Classification System
 * 
 * Classifies user queries into allowed intents and provides guardrails
 * against out-of-scope questions. This ensures Iris stays focused on
 * portfolio-related content and maintains appropriate boundaries.
 */

// Allowed intent categories for Iris responses
export type AllowedIntent = 
  | 'about_me'
  | 'values' 
  | 'contact'
  | 'experience'
  | 'experience_company'
  | 'experience_role'
  | 'experience_timeframe'
  | 'projects_overview'
  | 'project_specific'
  | 'playground_overview'
  | 'playground_specific'
  | 'skills_stack'
  | 'education'
  | 'languages'
  | 'now_updates'
  | 'fun_facts'
  | 'availability_link'
  | 'interview_prep_links';

/**
 * Intent patterns for classification
 * Each pattern contains keywords and phrases that indicate a specific intent
 */
const intentPatterns: Record<AllowedIntent, string[]> = {
  about_me: [
    'who are you', 'about yourself', 'tell me about', 'background', 'bio', 'introduction',
    'who is mike', 'personal', 'story', 'yourself'
  ],
  values: [
    'values', 'principles', 'philosophy', 'beliefs', 'approach', 'methodology',
    'what drives', 'motivation', 'core values', 'work style'
  ],
  contact: [
    'contact', 'email', 'reach out', 'get in touch', 'linkedin', 'connect',
    'how to contact', 'reach you', 'message', 'communication'
  ],
  experience: [
    'experience', 'work', 'job', 'career', 'professional', 'employment', 
    'resume', 'cv', 'work history', 'background'
  ],
  experience_company: [
    'parsons', 'lilie', 'veson', 'vesselsvalue', 'companies', 'employers',
    'where did you work', 'company', 'organization'
  ],
  experience_role: [
    'role', 'position', 'title', 'responsibilities', 'duties', 'what did you do',
    'software engineer', 'developer', 'frontend', 'fullstack'
  ],
  experience_timeframe: [
    'when', 'dates', 'timeline', 'duration', 'how long', 'years',
    '2021', '2022', '2023', '2024', 'recent', 'latest'
  ],
  projects_overview: [
    'projects', 'work', 'portfolio', 'built', 'created', 'developed',
    'what have you built', 'showcase', 'examples'
  ],
  project_specific: [
    'rack rush', 'euro 2024', 'elysium', 'barca', 'barcelona', 'system rating',
    'word game', 'scrabble', 'prediction', 'model', 'football'
  ],
  playground_overview: [
    'playground', 'experiments', 'side projects', 'fun projects', 'trying',
    'exploring', 'working on', 'current projects'
  ],
  playground_specific: [
    'decision maker', 'ranked by mike', 'quotes', 'rankings', 'v2',
    'rack rush v2', 'decision tool'
  ],
  skills_stack: [
    'skills', 'technologies', 'stack', 'programming', 'languages', 'tools',
    'react', 'typescript', 'javascript', 'python', 'node', 'next.js',
    'technical skills', 'what do you use'
  ],
  education: [
    'education', 'school', 'university', 'degree', 'study', 'studied',
    'learning', 'academic', 'college'
  ],
  languages: [
    'languages', 'speak', 'greek', 'english', 'spanish', 'multilingual',
    'learning spanish', 'native language', 'fluent'
  ],
  now_updates: [
    'now', 'currently', 'what are you doing', 'recent', 'latest', 'today',
    'working on', 'current', 'updates', 'recent changes'
  ],
  fun_facts: [
    'fun', 'interesting', 'hobbies', 'interests', 'personal interests',
    'outside work', 'for fun', 'spare time', 'barcelona', 'scrabble'
  ],
  availability_link: [
    'availability', 'available', 'hire', 'opportunities', 'schedule',
    'meeting', 'calendar', 'booking', 'appointment'
  ],
  interview_prep_links: [
    'interview', 'preparation', 'interview prep', 'resources', 'tips',
    'interview help', 'prep resources', 'interview materials'
  ]
};

/**
 * Classify a user query into the most likely intent
 * Uses keyword matching with scoring to determine best fit
 */
export function classifyIntent(query: string): { 
  intent: AllowedIntent | 'out_of_scope'; 
  confidence: number;
  suggestions?: string[];
} {
  if (!query.trim()) {
    return { intent: 'out_of_scope', confidence: 0 };
  }

  const normalizedQuery = query.toLowerCase().trim();
  const scores: Array<{ intent: AllowedIntent; score: number }> = [];

  // Score each intent based on keyword matches
  Object.entries(intentPatterns).forEach(([intent, patterns]) => {
    let score = 0;
    patterns.forEach(pattern => {
      if (normalizedQuery.includes(pattern)) {
        // Weight longer matches higher
        score += pattern.length;
      }
    });
    
    if (score > 0) {
      scores.push({ intent: intent as AllowedIntent, score });
    }
  });

  // Find best match
  if (scores.length === 0) {
    return {
      intent: 'out_of_scope',
      confidence: 0,
      suggestions: getValidSuggestions()
    };
  }

  scores.sort((a, b) => b.score - a.score);
  const bestMatch = scores[0];
  
  // Calculate confidence as percentage of query length matched
  const confidence = Math.min(bestMatch.score / normalizedQuery.length, 1);
  
  // Require minimum confidence threshold
  if (confidence < 0.2) {
    return {
      intent: 'out_of_scope', 
      confidence,
      suggestions: getValidSuggestions()
    };
  }

  return {
    intent: bestMatch.intent,
    confidence
  };
}

/**
 * Get valid example questions when user is out of scope
 */
function getValidSuggestions(): string[] {
  return [
    "What projects have you built?",
    "Tell me about your work experience",
    "How can I contact you?"
  ];
}

/**
 * Check if a query is within allowed scope
 */
export function isAllowedIntent(query: string): boolean {
  const classification = classifyIntent(query);
  return classification.intent !== 'out_of_scope';
}

/**
 * Generate a guardrail response for out-of-scope queries
 */
export function generateGuardrailResponse(query: string): string {
  const classification = classifyIntent(query);
  
  if (classification.intent !== 'out_of_scope') {
    return ''; // Not needed
  }

  return "I can help answer questions about Mike's projects, experience, values, contact information, or current work. " +
         "Here are some things you could ask instead:\n\n" +
         classification.suggestions?.map(s => `• ${s}`).join('\n') || '';
}

/**
 * Rewrite out-of-scope queries to be in-scope when possible
 * This helps redirect users to valid topics
 */
export function rewriteToValidQuery(query: string): string | null {
  const normalizedQuery = query.toLowerCase();
  
  // Common rewrites for financial/personal questions
  if (normalizedQuery.includes('salary') || normalizedQuery.includes('money') || normalizedQuery.includes('pay')) {
    return "How can I contact you about opportunities?";
  }
  
  if (normalizedQuery.includes('address') || normalizedQuery.includes('phone') || normalizedQuery.includes('location')) {
    return "What's the best way to contact you?";
  }
  
  if (normalizedQuery.includes('personal') && normalizedQuery.includes('life')) {
    return "Tell me about your interests and hobbies";
  }
  
  // If we can't rewrite, return null
  return null;
}

/**
 * Get all valid intent categories for reference
 */
export function getAllowedIntents(): AllowedIntent[] {
  return Object.keys(intentPatterns) as AllowedIntent[];
}