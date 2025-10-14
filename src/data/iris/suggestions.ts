/**
 * Default Suggestions for Iris Command Palette
 * 
 * Provides the base set of suggestions shown when no query is entered.
 * These are reordered based on user signals and browsing patterns.
 * Each suggestion includes title, optional subtitle, icon, and action type.
 */

export interface IrisSuggestion {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;           // Lucide icon name
  action: {
    type: 'ask' | 'route' | 'open';  // ask=query Iris, route=navigate, open=external
    payload: string;      // Query text, route path, or URL
  };
  weight?: number;        // Base relevance weight for reordering
  category?: string;      // Grouping for organizational purposes
}

/**
 * Core default suggestions shown when Iris opens with no query
 * These represent the most commonly asked questions and useful actions
 */
export const baseSuggestions: IrisSuggestion[] = [
  // High-level overview questions
  {
    id: 'about-overview',
    title: 'Who is Mike?',
    subtitle: 'Get an introduction and background',
    icon: 'User',
    action: { type: 'ask', payload: 'Who is Mike?' },
    weight: 1.0,
    category: 'about'
  },
  {
    id: 'projects-overview',
    title: 'What projects have you built?',
    subtitle: 'Explore portfolio and key projects',
    icon: 'FolderOpen',
    action: { type: 'ask', payload: 'What projects have you built?' },
    weight: 1.0,
    category: 'projects'
  },
  {
    id: 'experience-overview',
    title: 'Tell me about your experience',
    subtitle: 'Professional background and career',
    icon: 'Briefcase',
    action: { type: 'ask', payload: 'Tell me about your work experience' },
    weight: 1.0,
    category: 'experience'
  },
  {
    id: 'contact-info',
    title: 'How can I contact you?',
    subtitle: 'Get contact information',
    icon: 'Mail',
    action: { type: 'ask', payload: 'How can I contact you?' },
    weight: 1.0,
    category: 'contact'
  },
  {
    id: 'values-philosophy',
    title: 'What are your values?',
    subtitle: 'Work philosophy and principles',
    icon: 'Heart',
    action: { type: 'ask', payload: 'What are your values?' },
    weight: 0.9,
    category: 'about'
  },
  
  // Navigation shortcuts
  {
    id: 'nav-projects',
    title: 'Open Projects page',
    subtitle: 'Browse all projects',
    icon: 'ExternalLink',
    action: { type: 'route', payload: '/projects' },
    weight: 0.8,
    category: 'navigation'
  },
  {
    id: 'nav-rack-rush',
    title: 'Play Rack Rush',
    subtitle: 'Try the word game',
    icon: 'Gamepad2',
    action: { type: 'route', payload: '/games/rack-rush' },
    weight: 0.8,
    category: 'navigation'
  },
  
  // Specific project inquiries
  {
    id: 'project-rack-rush',
    title: 'Tell me about Rack Rush',
    subtitle: 'Word game details and features',
    icon: 'Zap',
    action: { type: 'ask', payload: 'Tell me about Rack Rush' },
    weight: 0.7,
    category: 'projects'
  },
  {
    id: 'project-euro2024',
    title: 'Euro 2024 prediction model',
    subtitle: 'Machine learning for football',
    icon: 'TrendingUp',
    action: { type: 'ask', payload: 'Tell me about your Euro 2024 prediction model' },
    weight: 0.7,
    category: 'projects'
  },
  
  // Technical and skills
  {
    id: 'tech-stack',
    title: 'What technologies do you use?',
    subtitle: 'Technical skills and stack',
    icon: 'Code',
    action: { type: 'ask', payload: 'What technologies do you use?' },
    weight: 0.8,
    category: 'technical'
  },
  {
    id: 'react-experience',
    title: 'React experience',
    subtitle: 'Frontend development background',
    icon: 'Component',
    action: { type: 'ask', payload: 'Tell me about your React experience' },
    weight: 0.6,
    category: 'technical'
  },
  
  // Personal and current
  {
    id: 'current-work',
    title: "What's new?",
    subtitle: 'Recent updates and current work',
    icon: 'Clock',
    action: { type: 'ask', payload: "What's new?" },
    weight: 0.9,
    category: 'current'
  },
  {
    id: 'playground-overview',
    title: 'Show me your playground',
    subtitle: 'Experiments and side projects',
    icon: 'Rocket',
    action: { type: 'ask', payload: 'Show me your playground projects' },
    weight: 0.7,
    category: 'playground'
  },
  {
    id: 'fun-facts',
    title: 'Fun facts and interests',
    subtitle: 'Personal interests and hobbies',
    icon: 'Star',
    action: { type: 'ask', payload: 'Tell me some fun facts' },
    weight: 0.6,
    category: 'personal'
  },
  
  // Specific company questions  
  {
    id: 'parsons-experience',
    title: 'Tell me about Parsons',
    subtitle: 'Most recent work experience',
    icon: 'Building',
    action: { type: 'ask', payload: 'Tell me about your experience at Parsons' },
    weight: 0.6,
    category: 'experience'
  },
  {
    id: 'veson-experience',
    title: 'Veson Nautical experience',
    subtitle: 'Maritime software development',
    icon: 'Ship',
    action: { type: 'ask', payload: 'Tell me about your time at Veson Nautical' },
    weight: 0.5,
    category: 'experience'
  },
  
  // Languages and location
  {
    id: 'languages-spoken',
    title: 'What languages do you speak?',
    subtitle: 'Greek, English, and Spanish learning',
    icon: 'Globe',
    action: { type: 'ask', payload: 'What languages do you speak?' },
    weight: 0.5,
    category: 'personal'
  },
  
  // Future/availability
  {
    id: 'availability',
    title: 'Are you available for work?',
    subtitle: 'Current availability status',
    icon: 'Calendar',
    action: { type: 'ask', payload: 'Are you available for new opportunities?' },
    weight: 0.7,
    category: 'availability'
  },
  
  // Additional questions you can add here:
  {
    id: 'education-background',
    title: 'What is your educational background?',
    subtitle: 'Academic and learning journey',
    icon: 'GraduationCap',
    action: { type: 'ask', payload: 'What is your educational background?' },
    weight: 0.6,
    category: 'about'
  },
  {
    id: 'remote-work',
    title: 'Are you open to remote work?',
    subtitle: 'Work location preferences',
    icon: 'Home',
    action: { type: 'ask', payload: 'Are you open to remote work?' },
    weight: 0.6,
    category: 'availability'
  },
  {
    id: 'salary-expectations',
    title: 'What are your salary expectations?',
    subtitle: 'Compensation discussion',
    icon: 'DollarSign',
    action: { type: 'ask', payload: 'What are your salary expectations?' },
    weight: 0.5,
    category: 'contact'
  }
];

/**
 * Template suggestions for different contexts
 * These can be dynamically inserted based on user signals
 */
export const templateSuggestions: Record<string, IrisSuggestion[]> = {
  // When user has shown interest in projects
  projects_focused: [
    {
      id: 'template-project-tech',
      title: 'What technologies power your projects?',
      icon: 'Wrench',
      action: { type: 'ask', payload: 'What technologies power your projects?' },
      category: 'projects'
    },
    {
      id: 'template-project-challenges',
      title: 'Biggest challenges in your projects?',
      icon: 'Target',
      action: { type: 'ask', payload: 'What were the biggest challenges in your projects?' },
      category: 'projects'
    }
  ],
  
  // When user has shown interest in experience
  experience_focused: [
    {
      id: 'template-career-growth',
      title: 'How has your career evolved?',
      icon: 'TrendingUp',
      action: { type: 'ask', payload: 'How has your career evolved over time?' },
      category: 'experience'
    },
    {
      id: 'template-favorite-role',
      title: 'What was your favorite role?',
      icon: 'Heart',
      action: { type: 'ask', payload: 'What was your favorite role and why?' },
      category: 'experience'
    }
  ],
  
  // When user has shown interest in technical aspects
  technical_focused: [
    {
      id: 'template-architecture',
      title: 'How do you approach system design?',
      icon: 'Layers',
      action: { type: 'ask', payload: 'How do you approach system design?' },
      category: 'technical'
    },
    {
      id: 'template-learning',
      title: 'What are you learning now?',
      icon: 'BookOpen',
      action: { type: 'ask', payload: 'What technologies are you learning now?' },
      category: 'technical'
    }
  ]
};

/**
 * Get default suggestions reordered by user signals
 * Takes the base suggestions and reorders based on user interest patterns
 */
export function getDefaultSuggestions(
  signals?: { recentSections?: string[]; sectionInterests?: Record<string, number> },
  count: number = 5
): IrisSuggestion[] {
  let suggestions = [...baseSuggestions];
  
  if (signals) {
    // Boost suggestions based on recent sections of interest
    suggestions = suggestions.map(suggestion => ({
      ...suggestion,
      weight: calculateAdjustedWeight(suggestion, signals)
    }));
    
    // Add contextual template suggestions
    const templates = getContextualTemplates(signals);
    suggestions = [...suggestions, ...templates];
    
    // Sort by adjusted weight
    suggestions.sort((a, b) => (b.weight || 0) - (a.weight || 0));
  }
  
  return suggestions.slice(0, count);
}

/**
 * Calculate adjusted weight based on user signals
 */
function calculateAdjustedWeight(
  suggestion: IrisSuggestion, 
  signals: { recentSections?: string[]; sectionInterests?: Record<string, number> }
): number {
  let baseWeight = suggestion.weight || 0;
  
  if (!suggestion.category || !signals.sectionInterests) {
    return baseWeight;
  }
  
  // Map suggestion categories to signal sections
  const categoryToSection: Record<string, string> = {
    'about': 'about',
    'projects': 'projects', 
    'experience': 'experience',
    // 'playground': 'playground',
    'technical': 'projects', // Technical questions often relate to project work
    'contact': 'contact',
    'navigation': 'home',
    'personal': 'about',
    'current': 'about',
    'availability': 'contact'
  };
  
  const section = categoryToSection[suggestion.category];
  if (section && signals.sectionInterests[section]) {
    const interestBoost = signals.sectionInterests[section] * 0.1;
    baseWeight += interestBoost;
  }
  
  // Extra boost for recent sections
  if (signals.recentSections && section && signals.recentSections.includes(section)) {
    const recentIndex = signals.recentSections.indexOf(section);
    const recentBoost = (signals.recentSections.length - recentIndex) * 0.05;
    baseWeight += recentBoost;
  }
  
  return baseWeight;
}

/**
 * Get contextual template suggestions based on user interests
 */
function getContextualTemplates(
  signals: { recentSections?: string[]; sectionInterests?: Record<string, number> }
): IrisSuggestion[] {
  const templates: IrisSuggestion[] = [];
  
  if (!signals.sectionInterests) return templates;
  
  // Get top interested sections
  const topSections = Object.entries(signals.sectionInterests)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 2)
    .map(([section]) => section);
    
  topSections.forEach(section => {
    if (section === 'projects' && templateSuggestions.projects_focused) {
      templates.push(...templateSuggestions.projects_focused);
    }
    if (section === 'experience' && templateSuggestions.experience_focused) {
      templates.push(...templateSuggestions.experience_focused);
    }
  });
  
  return templates.slice(0, 2); // Limit contextual suggestions
}

/**
 * Find suggestions by query for search/filtering
 */
export function findSuggestionsByQuery(query: string): IrisSuggestion[] {
  const lowerQuery = query.toLowerCase();
  
  return baseSuggestions.filter(suggestion => 
    suggestion.title.toLowerCase().includes(lowerQuery) ||
    suggestion.subtitle?.toLowerCase().includes(lowerQuery) ||
    suggestion.category?.toLowerCase().includes(lowerQuery) ||
    suggestion.action.payload.toLowerCase().includes(lowerQuery)
  );
}
