/**
 * User Signals Tracking System
 * 
 * Captures user interaction signals (hover, click, dwell) to improve
 * suggestion relevance. Stored in localStorage for persistence across sessions.
 * Used to reorder suggestions based on user interests and navigation patterns.
 */

export type SignalType = 'hover' | 'click' | 'dwell' | 'route';
export type SectionType = 'about' | 'experience' | 'playground' | 'projects' | 'contact' | 'home';

interface UserSignal {
  type: SignalType;
  section: SectionType;
  timestamp: number;
  metadata?: {
    duration?: number; // for dwell signals (ms)
    route?: string;    // for route signals
  };
}

export interface SignalSummary {
  lastHoveredSection?: SectionType;
  lastRoute?: string;
  dwellTimes: Record<SectionType, number>;
  sectionInterests: Record<SectionType, number>; // weighted score
  recentSections: SectionType[];
}

const STORAGE_KEY = 'mv_signals';
const MAX_SIGNALS = 100; // Keep storage size reasonable
const DWELL_THRESHOLD_MS = 2000; // Minimum dwell time to be meaningful
const INTEREST_DECAY_DAYS = 7; // How long signals stay relevant

/**
 * Mark a hover event on a section
 * Used when user hovers over navigation items or content sections
 */
export function markHover(section: SectionType): void {
  const signal: UserSignal = {
    type: 'hover',
    section,
    timestamp: Date.now()
  };
  
  addSignal(signal);
  updateSummary();
}

/**
 * Mark a click event on a section
 * Used when user clicks on navigation or interacts with content
 */
export function markClick(section: SectionType): void {
  const signal: UserSignal = {
    type: 'click', 
    section,
    timestamp: Date.now()
  };
  
  addSignal(signal);
  updateSummary();
}

/**
 * Mark a dwell event (extended time spent on a section)
 * Used when user spends significant time reading/interacting with content
 */
export function markDwell(section: SectionType, duration: number): void {
  // Only record meaningful dwell times
  if (duration < DWELL_THRESHOLD_MS) {
    return;
  }
  
  const signal: UserSignal = {
    type: 'dwell',
    section,
    timestamp: Date.now(),
    metadata: { duration }
  };
  
  addSignal(signal);
  updateSummary();
}

/**
 * Mark a route navigation
 * Used when user navigates to different pages
 */
export function markRoute(route: string): void {
  const section = routeToSection(route);
  
  const signal: UserSignal = {
    type: 'route',
    section,
    timestamp: Date.now(),
    metadata: { route }
  };
  
  addSignal(signal);
  updateSummary();
}

/**
 * Get current signal summary for suggestion reordering
 * Returns computed interest scores and recent activity
 */
export function getSignalSummary(): SignalSummary {
  if (typeof window === 'undefined') {
    // SSR fallback
    return {
      dwellTimes: {} as Record<SectionType, number>,
      sectionInterests: {} as Record<SectionType, number>,
      recentSections: []
    };
  }
  
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY}_summary`);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('Failed to load signal summary:', error);
  }
  
  // Generate fresh summary from signals
  updateSummary();
  return getSignalSummary();
}

/**
 * Add a new signal to the store
 * Maintains storage size limits and cleans old data
 */
function addSignal(signal: UserSignal): void {
  if (typeof window === 'undefined') return;
  
  try {
    const signals = getStoredSignals();
    signals.push(signal);
    
    // Keep only recent signals
    const cutoff = Date.now() - (INTEREST_DECAY_DAYS * 24 * 60 * 60 * 1000);
    const recentSignals = signals
      .filter(s => s.timestamp > cutoff)
      .slice(-MAX_SIGNALS);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recentSignals));
  } catch (error) {
    console.warn('Failed to store signal:', error);
  }
}

/**
 * Update the computed summary based on current signals
 * This aggregates raw signals into actionable insights
 */
function updateSummary(): void {
  if (typeof window === 'undefined') return;
  
  const signals = getStoredSignals();
  const summary: SignalSummary = {
    dwellTimes: {} as Record<SectionType, number>,
    sectionInterests: {} as Record<SectionType, number>,
    recentSections: []
  };
  
  // Initialize section scores
  const sections: SectionType[] = ['about', 'experience', 'playground', 'projects', 'contact', 'home'];
  sections.forEach(section => {
    summary.dwellTimes[section] = 0;
    summary.sectionInterests[section] = 0;
  });
  
  // Process signals with time-based decay
  const now = Date.now();
  signals.forEach(signal => {
    const ageMs = now - signal.timestamp;
    const ageDays = ageMs / (24 * 60 * 60 * 1000);
    const decayFactor = Math.max(0, 1 - (ageDays / INTEREST_DECAY_DAYS));
    
    let weight = 0;
    switch (signal.type) {
      case 'hover':
        weight = 1 * decayFactor;
        break;
      case 'click': 
        weight = 3 * decayFactor;
        break;
      case 'dwell':
        weight = (5 + (signal.metadata?.duration || 0) / 1000) * decayFactor;
        summary.dwellTimes[signal.section] += signal.metadata?.duration || 0;
        break;
      case 'route':
        weight = 2 * decayFactor;
        summary.lastRoute = signal.metadata?.route;
        break;
    }
    
    summary.sectionInterests[signal.section] += weight;
    summary.lastHoveredSection = signal.section;
  });
  
  // Build recent sections list (most active first)
  const sortedSections = Object.entries(summary.sectionInterests)
    .sort(([,a], [,b]) => b - a)
    .map(([section]) => section as SectionType)
    .filter(section => summary.sectionInterests[section] > 0);
    
  summary.recentSections = sortedSections.slice(0, 5);
  
  try {
    localStorage.setItem(`${STORAGE_KEY}_summary`, JSON.stringify(summary));
  } catch (error) {
    console.warn('Failed to store signal summary:', error);
  }
}

/**
 * Get stored signals from localStorage
 */
function getStoredSignals(): UserSignal[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.warn('Failed to load signals:', error);
    return [];
  }
}

/**
 * Map route paths to section types for signal categorization
 */
function routeToSection(route: string): SectionType {
  if (route === '/') return 'home';
  if (route.startsWith('/projects')) return 'projects';
  if (route.startsWith('/games') || route.startsWith('/playground')) return 'playground';
  if (route.startsWith('/experience') || route.includes('work')) return 'experience';
  if (route.startsWith('/about')) return 'about';
  if (route.includes('contact')) return 'contact';
  
  // Default fallback
  return 'home';
}

/**
 * Clear all stored signals (for privacy/debugging)
 */
export function clearSignals(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(`${STORAGE_KEY}_summary`);
  } catch (error) {
    console.warn('Failed to clear signals:', error);
  }
}

/**
 * Get signal data for debugging/analytics
 * Returns sanitized version safe for external use
 */
export function getSignalAnalytics(): {
  totalSignals: number;
  sectionBreakdown: Record<SectionType, number>;
  avgDwellTime: number;
} {
  const signals = getStoredSignals();
  const summary = getSignalSummary();
  
  const sectionCounts = {} as Record<SectionType, number>;
  const sections: SectionType[] = ['about', 'experience', 'playground', 'projects', 'contact', 'home'];
  
  sections.forEach(section => {
    sectionCounts[section] = signals.filter(s => s.section === section).length;
  });
  
  const totalDwellTime = Object.values(summary.dwellTimes).reduce((a, b) => a + b, 0);
  const dwellSignals = signals.filter(s => s.type === 'dwell').length;
  
  return {
    totalSignals: signals.length,
    sectionBreakdown: sectionCounts,
    avgDwellTime: dwellSignals > 0 ? totalDwellTime / dwellSignals : 0
  };
}
