/**
 * Fuse.js Typeahead System
 * 
 * Provides fast local search across a phrase bank built from intents,
 * knowledge base entities, and utility patterns. Optimized for <16ms response
 * time to maintain smooth typing experience.
 */

import Fuse, { type IFuseOptions } from 'fuse.js';
import type { SignalSummary } from './signals';
import type { AllowedIntent } from './intents';

// Type definitions for knowledge base data
interface Experience {
  company: string;
  role: string;
  dates: string;
  location: string;
  stack: string[];
  impact: string[];
}

interface Project {
  name: string;
  description: string;
  route: string;
  stack: string[];
}

interface PlaygroundProject {
  name: string;
  description: string;
  route: string;
  status: string;
}

interface Route {
  path: string;
  title: string;
  description: string;
}

interface Profile {
  tagline: string;
  current_work: string;
  location: string;
  languages: {
    native: string[];
    fluent: string[];
    learning: string[];
  };
  interests: string[];
  availability_status: string;
}

interface Value {
  name: string;
  description: string;
}

interface ContactMethod {
  type: string;
  value: string;
  preferred?: boolean;
  description: string;
}

interface Interest {
  name: string;
  description: string;
}

interface KBData {
  profile?: Profile;
  experience?: { experiences: Experience[] };
  projects?: { projects: Project[] };
  playground?: { playground_projects: PlaygroundProject[] };
  values?: { core_values: Value[] };
  contact?: { contact_methods: ContactMethod[]; response_time: string; availability: string };
  site_map?: { routes: Route[] };
  fun?: { interests: Interest[]; hobbies: string[] };
}

// Import knowledge base data (these will be loaded lazily)
let kbCache: KBData | null = null;

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
  // Intent-based natural phrasings for Iris
  const intentPhrasings: Array<{ phrase: string; intent: AllowedIntent }> = [
    // 🧭 About & Identity
    { phrase: "Who is Mike?", intent: "about_me" },
    { phrase: "Tell me about yourself", intent: "about_me" },
    { phrase: "What's your background?", intent: "about_me" },
    { phrase: "How did you get into computer science?", intent: "about_me" },
    { phrase: "Why tech?", intent: "about_me" },

    // 💭 Vision, Philosophy & Motivation
    { phrase: "What motivates you?", intent: "values" },
    { phrase: "Your philosophy on work", intent: "values" },
    { phrase: "What drives your projects?", intent: "values" },
    { phrase: "What do you value most in teamwork?", intent: "values" },
    { phrase: "Your approach to learning", intent: "values" },

    // 🧑‍💻 Experience Overview
    { phrase: "Where have you worked?", intent: "experience" },
    { phrase: "Summarize your work experience", intent: "experience" },
    { phrase: "What kind of roles have you had?", intent: "experience" },
    { phrase: "Walk me through your internships", intent: "experience" },
    { phrase: "Tell me about your most impactful role", intent: "experience_highlight" },

    // 🏢 Company-specific Experience
    { phrase: "Your work at Parsons", intent: "experience_company" },
    { phrase: "What did you do at Veson Nautical?", intent: "experience_company" },
    { phrase: "Explain your role at VesselsValue", intent: "experience_company" },
    { phrase: "What was your impact at Lilie?", intent: "experience_company" },

    // 🚀 Projects & Products
    { phrase: "Show me your projects", intent: "projects_overview" },
    { phrase: "What have you built?", intent: "projects_overview" },
    { phrase: "Which project are you most proud of?", intent: "projects_highlight" },
    { phrase: "Tell me about Knight Life", intent: "project_specific" },
    { phrase: "What is HiLiTe?", intent: "project_specific" },
    { phrase: "How did you build Momentum?", intent: "project_specific" },
    { phrase: "Explain your Euro 2024 model", intent: "project_specific" },
    { phrase: "What's your personal portfolio tech stack?", intent: "project_specific" },

    // 🧠 Technical Skills & Tools
    { phrase: "What languages do you code in?", intent: "skills_stack" },
    { phrase: "Tech stack overview", intent: "skills_stack" },
    { phrase: "Favorite frameworks", intent: "skills_stack" },
    { phrase: "Machine learning experience", intent: "skills_stack" },
    { phrase: "iOS or web development?", intent: "skills_stack" },
    { phrase: "Do you use Python a lot?", intent: "skills_stack" },

    // 🎓 Education & Academics
    { phrase: "Where do you study?", intent: "education" },
    { phrase: "What classes have you taken?", intent: "education" },
    { phrase: "Study abroad plans?", intent: "education" },
    { phrase: "What did you learn from your Vision & Language course?", intent: "education_detail" },

    // 🤝 Collaboration, Contact & Availability
    { phrase: "How can I contact you?", intent: "contact" },
    { phrase: "What's your email?", intent: "contact" },
    { phrase: "LinkedIn profile", intent: "contact" },
    { phrase: "Are you open to internships?", intent: "availability_link" },
    { phrase: "Can I collaborate with you?", intent: "availability_link" },
    { phrase: "Schedule a meeting", intent: "availability_link" },

    // ⚙️ Portfolio Navigation & Guidance
    { phrase: "Take me to your projects", intent: "navigate_projects" },
    { phrase: "Go to your resume", intent: "navigate_resume" },
    { phrase: "Show your writing or blog", intent: "navigate_blog" },
    { phrase: "Open the contact page", intent: "navigate_contact" },

    // 📊 Analytics & Insights (future AI analysis ideas)
    { phrase: "Most visited project?", intent: "analytics_overview" },
    { phrase: "What do visitors usually ask?", intent: "analytics_overview" },
    { phrase: "Trending topics on your site?", intent: "analytics_overview" },

    // 🎨 Personality & Fun
    { phrase: "Fun facts", intent: "fun_facts" },
    { phrase: "Are you a Barcelona fan?", intent: "fun_facts" },
    { phrase: "Favorite hobby outside coding", intent: "fun_facts" },
    { phrase: "What's Iris?", intent: "fun_facts" },
    { phrase: "Why did you build Iris?", intent: "fun_facts" },
    { phrase: "What are you learning right now?", intent: "now_updates" },
    { phrase: "What's new with your projects?", intent: "now_updates" },
    { phrase: "Current focus areas", intent: "now_updates" }
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
    kb.experience?.experiences?.forEach((exp: Experience, index: number) => {
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
    kb.projects?.projects?.forEach((project: Project, index: number) => {
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
    kb.playground?.playground_projects?.forEach((project: PlaygroundProject, index: number) => {
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
    kb.site_map?.routes?.forEach((route: Route, index: number) => {
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
      experience: experience.default as KBData['experience'],
      projects: projects.default as KBData['projects'],
      playground: playground.default as KBData['playground'],
      values: values.default,
      contact: contact.default,
      site_map: siteMap.default as KBData['site_map'],
      fun: fun.default
    };

    return kbCache;
  } catch (error) {
    console.warn('Failed to load knowledge base:', error);
    return {} as KBData;
  }
}

/**
 * Create Fuse.js instance with optimized settings
 */
function createFuseIndex(items: SearchableItem[]): Fuse<SearchableItem> {
  const options: IFuseOptions<SearchableItem> = {
    keys: [
      { name: 'title', weight: 0.7 },
      { name: 'alt', weight: 0.3 }
    ],

    threshold: 0.3,        // Stricter threshold (0.0 = perfect, 1.0 = match anything)
    distance: 50,          // Tighter character distance for better relevance
    minMatchCharLength: 2, // Minimum characters to start matching
    includeScore: true,
    includeMatches: true,  // Enable for better ranking
    shouldSort: true,
    ignoreLocation: false, // Prefer matches at start of string (like Google)
    location: 0,           // Start searching from beginning
    findAllMatches: false, // Stop at first good match for performance
    useExtendedSearch: false,
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
    console.warn('[Typeahead] Not initialized, returning empty results');
    return [];
  }

  if (!query.trim()) {
    // Return signal-based suggestions when no query
    return getSignalBasedSuggestions(signals, maxResults);
  }

  try {
    const results = fuseInstance.search(query, { limit: maxResults * 3 });

    console.log(`[Typeahead] Query: "${query}" - Found ${results.length} raw matches`);

    // Filter by quality score threshold (Google-like relevance)
    // Score of 0.0 = perfect match, 1.0 = worst match
    const QUALITY_THRESHOLD = 0.4; // Only show results with score < 0.4

    const qualityResults = results.filter(result => {
      const score = result.score || 0;
      const isGoodMatch = score < QUALITY_THRESHOLD;
      console.log(`  - "${result.item.title}" score: ${score.toFixed(3)} ${isGoodMatch ? '✓' : '✗'}`);
      return isGoodMatch;
    });

    console.log(`[Typeahead] After quality filter: ${qualityResults.length} suggestions`);

    // Apply signal-based reordering
    let items = qualityResults.map(result => result.item);

    if (signals) {
      items = reorderBySignals(items, signals);
    }

    // Extract titles and limit results
    const suggestions = items
      .slice(0, maxResults)
      .map(item => item.title);

    const elapsedMs = performance.now() - startTime;
    console.log(`[Typeahead] Completed in ${elapsedMs.toFixed(1)}ms - Returning ${suggestions.length} suggestions`);

    return suggestions;
  } catch (error) {
    console.error('[Typeahead] Error:', error);
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
  console.log('LLM suggestions for query:', query, 'with context:', context);
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
