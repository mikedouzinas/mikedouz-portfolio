/**
 * Fuse.js Typeahead System
 * 
 * Provides fast local search across a phrase bank built from intents,
 * knowledge base entities, and utility patterns. Optimized for <16ms response
 * time to maintain smooth typing experience.
 */

import Fuse from 'fuse.js';
import type { SignalSummary } from './signals';
import type { AllowedIntent } from './intents';

// Import knowledge base data (these will be loaded lazily)
let kbCache: any = null;

export interface SearchableItem {
  id: string;
  title: string;
  alt?: string;     // Alternative phrasings
  entity?: string;  // Entity type (company, project, etc.)
  intent: AllowedIntent;
  route?: string;   // Associated route if applicable
  weight?: number;  // Boost factor for ranking
}

/**
 * Build comprehensive phrase bank from multiple sources
 * This creates the searchable index for typeahead suggestions
 */
async function buildPhraseBank(): Promise<SearchableItem[]> {
  const items: SearchableItem[] = [];
  
  // Intent-based natural phrasings
  const intentPhrasings: Array<{ phrase: string; intent: AllowedIntent }> = [
    // About & Personal
    { phrase: "Who is Mike?", intent: "about_me" },
    { phrase: "Tell me about yourself", intent: "about_me" },
    { phrase: "What's your background?", intent: "about_me" },
    { phrase: "Your story", intent: "about_me" },
    
    // Values & Philosophy  
    { phrase: "What are your values?", intent: "values" },
    { phrase: "Your principles", intent: "values" },
    { phrase: "Work philosophy", intent: "values" },
    { phrase: "What drives you?", intent: "values" },
    
    // Contact
    { phrase: "How to contact you", intent: "contact" },
    { phrase: "Get in touch", intent: "contact" },
    { phrase: "Your email", intent: "contact" },
    { phrase: "LinkedIn profile", intent: "contact" },
    
    // Experience
    { phrase: "Work experience", intent: "experience" },
    { phrase: "Career history", intent: "experience" },
    { phrase: "Previous jobs", intent: "experience" },
    { phrase: "Professional background", intent: "experience" },
    { phrase: "Where did you work?", intent: "experience_company" },
    { phrase: "Tell me about Parsons", intent: "experience_company" },
    { phrase: "Veson Nautical experience", intent: "experience_company" },
    { phrase: "What was your role at Lilie?", intent: "experience_role" },
    
    // Projects
    { phrase: "What have you built?", intent: "projects_overview" },
    { phrase: "Show me your projects", intent: "projects_overview" },
    { phrase: "Portfolio showcase", intent: "projects_overview" },
    { phrase: "Tell me about Rack Rush", intent: "project_specific" },
    { phrase: "Euro 2024 prediction model", intent: "project_specific" },
    { phrase: "Elysium project", intent: "project_specific" },
    { phrase: "Barcelona rating system", intent: "project_specific" },
    
    // Playground
    { phrase: "Playground projects", intent: "playground_overview" },
    { phrase: "What are you working on?", intent: "playground_overview" },
    { phrase: "Side projects", intent: "playground_overview" },
    { phrase: "Decision Maker tool", intent: "playground_specific" },
    { phrase: "Ranked by Mike", intent: "playground_specific" },
    
    // Skills & Tech
    { phrase: "Technical skills", intent: "skills_stack" },
    { phrase: "Programming languages", intent: "skills_stack" },
    { phrase: "Tech stack", intent: "skills_stack" },
    { phrase: "What technologies do you use?", intent: "skills_stack" },
    { phrase: "React experience", intent: "skills_stack" },
    { phrase: "TypeScript projects", intent: "skills_stack" },
    
    // Languages & Education
    { phrase: "What languages do you speak?", intent: "languages" },
    { phrase: "Greek fluency", intent: "languages" },
    { phrase: "Learning Spanish", intent: "languages" },
    { phrase: "Education background", intent: "education" },
    
    // Current & Fun
    { phrase: "What's new?", intent: "now_updates" },
    { phrase: "Recent updates", intent: "now_updates" },
    { phrase: "Currently working on", intent: "now_updates" },
    { phrase: "Fun facts", intent: "fun_facts" },
    { phrase: "Personal interests", intent: "fun_facts" },
    { phrase: "Barcelona fan", intent: "fun_facts" },
    { phrase: "Scrabble enthusiasm", intent: "fun_facts" },
    
    // Availability & Interview
    { phrase: "Are you available?", intent: "availability_link" },
    { phrase: "Schedule a meeting", intent: "availability_link" },
    { phrase: "Interview preparation", intent: "interview_prep_links" },
    { phrase: "Interview resources", intent: "interview_prep_links" }
  ];
  
  // Add intent phrasings
  intentPhrasings.forEach((item, index) => {
    items.push({
      id: `intent-${index}`,
      title: item.phrase,
      intent: item.intent,
      weight: 1
    });
  });
  
  // Load and extract entities from knowledge base
  try {
    const kb = await loadKnowledgeBase();
    
    // Company names
    kb.experience?.experiences?.forEach((exp: any, index: number) => {
      items.push({
        id: `company-${index}`,
        title: `Tell me about ${exp.company}`,
        alt: `${exp.company} experience`,
        entity: 'company',
        intent: 'experience_company',
        weight: 1.2
      });
    });
    
    // Project names
    kb.projects?.projects?.forEach((project: any, index: number) => {
      items.push({
        id: `project-${index}`,
        title: `Show me ${project.name}`,
        alt: project.description,
        entity: 'project', 
        intent: 'project_specific',
        route: project.route,
        weight: 1.3
      });
    });
    
    // Playground projects
    kb.playground?.playground_projects?.forEach((project: any, index: number) => {
      items.push({
        id: `playground-${index}`,
        title: `What is ${project.name}?`,
        alt: project.description,
        entity: 'playground',
        intent: 'playground_specific',
        route: project.route,
        weight: 1.1
      });
    });
    
    // Routes from site map
    kb.site_map?.routes?.forEach((route: any, index: number) => {
      items.push({
        id: `route-${index}`,
        title: `Open ${route.title}`,
        alt: route.description,
        entity: 'route',
        intent: 'projects_overview', // Default intent for navigation
        route: route.path,
        weight: 0.9
      });
    });
    
    // Tech stack terms
    const techTerms = [
      'React', 'TypeScript', 'JavaScript', 'Next.js', 'Node.js', 'Python',
      'PostgreSQL', 'CSS', 'Tailwind', 'Git', 'REST APIs', 'C#', '.NET'
    ];
    
    techTerms.forEach((tech, index) => {
      items.push({
        id: `tech-${index}`,
        title: `${tech} experience`,
        alt: `Tell me about ${tech}`,
        entity: 'technology',
        intent: 'skills_stack',
        weight: 0.8
      });
    });
    
  } catch (error) {
    console.warn('Failed to load knowledge base for phrase bank:', error);
  }
  
  // Utility patterns
  const utilityPatterns = [
    { phrase: "Summarize experience in 30 seconds", intent: "experience" as AllowedIntent },
    { phrase: "Quick overview of projects", intent: "projects_overview" as AllowedIntent },
    { phrase: "How to get started with you", intent: "contact" as AllowedIntent },
    { phrase: "What makes you unique", intent: "values" as AllowedIntent },
    { phrase: "Open projects page", intent: "projects_overview" as AllowedIntent, route: "/projects" },
    { phrase: "Go to Rack Rush", intent: "project_specific" as AllowedIntent, route: "/games/rack-rush" },
  ];
  
  utilityPatterns.forEach((pattern, index) => {
    items.push({
      id: `utility-${index}`,
      title: pattern.phrase,
      intent: pattern.intent,
      route: pattern.route,
      weight: 0.7
    });
  });
  
  return items;
}

/**
 * Lazy load knowledge base files
 */
async function loadKnowledgeBase() {
  if (kbCache) return kbCache;
  
  try {
    // Load all KB files in parallel
    const [profile, experience, projects, playground, values, contact, siteMap, fun] = await Promise.all([
      import('@/data/iris/kb/profile.json'),
      import('@/data/iris/kb/experience.json'), 
      import('@/data/iris/kb/projects.json'),
      import('@/data/iris/kb/playground.json'),
      import('@/data/iris/kb/values.json'),
      import('@/data/iris/kb/contact.json'),
      import('@/data/iris/kb/site_map.json'),
      import('@/data/iris/kb/fun.json')
    ]);
    
    kbCache = {
      profile: profile.default,
      experience: experience.default,
      projects: projects.default,
      playground: playground.default,
      values: values.default,
      contact: contact.default,
      site_map: siteMap.default,
      fun: fun.default
    };
    
    return kbCache;
  } catch (error) {
    console.warn('Failed to load knowledge base:', error);
    return {};
  }
}

/**
 * Create Fuse.js instance with optimized settings
 */
function createFuseIndex(items: SearchableItem[]): Fuse<SearchableItem> {
  const options: Fuse.IFuseOptions<SearchableItem> = {
    keys: [
      { name: 'title', weight: 0.7 },
      { name: 'alt', weight: 0.3 }
    ],
    threshold: 0.4,        // Balance between fuzzy matching and relevance
    distance: 100,         // Allow some character distance for typos  
    minMatchCharLength: 2, // Minimum characters to start matching
    includeScore: true,
    includeMatches: false, // Skip highlights for performance
    shouldSort: true,
    ignoreLocation: true,  // Match anywhere in string
  };
  
  return new Fuse(items, options);
}

// Singleton Fuse instance
let fuseInstance: Fuse<SearchableItem> | null = null;
let phraseBank: SearchableItem[] = [];

/**
 * Initialize the search index (call this once on app load)
 */
export async function initializeTypeahead(): Promise<void> {
  try {
    phraseBank = await buildPhraseBank();
    fuseInstance = createFuseIndex(phraseBank);
  } catch (error) {
    console.error('Failed to initialize typeahead:', error);
  }
}

/**
 * Get local suggestions using Fuse.js (client-side, fast)
 * Must complete in <16ms for smooth typing experience
 */
export function getSuggestionsLocal(
  query: string, 
  signals?: SignalSummary,
  maxResults: number = 4
): string[] {
  const startTime = performance.now();
  
  // Initialize if needed
  if (!fuseInstance || phraseBank.length === 0) {
    console.warn('Typeahead not initialized, returning empty results');
    return [];
  }
  
  if (!query.trim()) {
    // Return signal-based suggestions when no query
    return getSignalBasedSuggestions(signals, maxResults);
  }
  
  try {
    const results = fuseInstance.search(query, { limit: maxResults * 2 });
    
    // Apply signal-based reordering
    let items = results.map(result => result.item);
    
    if (signals) {
      items = reorderBySignals(items, signals);
    }
    
    // Extract titles and limit results
    const suggestions = items
      .slice(0, maxResults)
      .map(item => item.title);
    
    const elapsedMs = performance.now() - startTime;
    if (elapsedMs > 16) {
      console.warn(`Typeahead took ${elapsedMs.toFixed(1)}ms (target: <16ms)`);
    }
    
    return suggestions;
  } catch (error) {
    console.error('Local suggestion error:', error);
    return [];
  }
}

/**
 * Get suggestions based on user signals when no query provided
 */
function getSignalBasedSuggestions(signals?: SignalSummary, maxResults: number = 4): string[] {
  if (!signals || !phraseBank.length) {
    // Return default suggestions
    return [
      "What projects have you built?",
      "Tell me about your experience",
      "How can I contact you?",
      "What are your values?"
    ].slice(0, maxResults);
  }
  
  // Find items related to user's interest signals
  const relevantItems: SearchableItem[] = [];
  
  signals.recentSections?.forEach(section => {
    const sectionItems = phraseBank.filter(item => {
      switch (section) {
        case 'projects': 
          return item.intent.includes('project') || item.entity === 'project';
        case 'experience':
          return item.intent.includes('experience') || item.entity === 'company';
        case 'playground':
          return item.intent.includes('playground') || item.entity === 'playground';
        case 'about':
          return item.intent === 'about_me' || item.intent === 'values';
        case 'contact':
          return item.intent === 'contact';
        default:
          return false;
      }
    });
    
    relevantItems.push(...sectionItems.slice(0, 2));
  });
  
  // Fill remaining slots with high-weight general items
  const generalItems = phraseBank
    .filter(item => (item.weight || 0) >= 1.2)
    .slice(0, maxResults);
    
  const combined = [...relevantItems, ...generalItems];
  const unique = Array.from(new Set(combined.map(item => item.title)));
  
  return unique.slice(0, maxResults);
}

/**
 * Reorder search results based on user signals
 */
function reorderBySignals(items: SearchableItem[], signals: SignalSummary): SearchableItem[] {
  return items.sort((a, b) => {
    let scoreA = a.weight || 0;
    let scoreB = b.weight || 0;
    
    // Boost items related to recent user interests
    signals.recentSections?.forEach((section, index) => {
      const boost = (signals.recentSections!.length - index) * 0.1;
      
      if (isItemRelatedToSection(a, section)) {
        scoreA += boost;
      }
      if (isItemRelatedToSection(b, section)) {
        scoreB += boost;
      }
    });
    
    return scoreB - scoreA;
  });
}

/**
 * Check if an item is related to a signal section
 */
function isItemRelatedToSection(item: SearchableItem, section: string): boolean {
  switch (section) {
    case 'projects':
      return item.intent.includes('project') || item.entity === 'project';
    case 'experience': 
      return item.intent.includes('experience') || item.entity === 'company';
    case 'playground':
      return item.intent.includes('playground') || item.entity === 'playground';
    case 'about':
      return item.intent === 'about_me' || item.intent === 'values' || item.intent === 'fun_facts';
    case 'contact':
      return item.intent === 'contact' || item.intent === 'availability_link';
    default:
      return false;
  }
}

/**
 * Server-side LLM-enhanced suggestions (optional refinement)
 * This is called from the API route with context for LLM refinement
 */
export async function getSuggestionsLLM(
  query: string, 
  context: { intents: string[]; phraseBank: string[] }
): Promise<string[]> {
  // This will be implemented in the API route
  // Returns refined suggestions using GPT-4o-mini
  return [];
}

/**
 * Get the full phrase bank for server-side processing
 */
export async function getPhraseBank(): Promise<SearchableItem[]> {
  if (phraseBank.length === 0) {
    await initializeTypeahead();
  }
  return phraseBank;
}