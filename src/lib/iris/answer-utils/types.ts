import type { ContactReason, ContactOpenBehavior } from '@/lib/types';

/**
 * Simplified intent types after introducing structured filtering
 *
 * Note: We removed redundant intents (list_projects, how_built, experience, classes, skills_for)
 * These are now handled by filter_query with appropriate filters, reducing code complexity
 */
export type Intent =
  | 'contact'        // Fast-path for contact information (no LLM needed)
  | 'filter_query'   // Structured filtering (e.g., "Python projects", "2025 work", "ML classes")
  | 'specific_item'  // Query about a specific item (e.g., "tell me about HiLiTe")
  | 'personal'       // Personal/family questions (stories, values, interests, education, bio/headline)
  | 'general';       // Catch-all semantic search for everything else

/**
 * Structured filter for precise KB queries
 * Enables queries like "all Python projects" or "experiences from 2024"
 */
export interface QueryFilter {
  type?: Array<'project' | 'experience' | 'class' | 'blog' | 'story' | 'value' | 'interest' | 'education' | 'bio' | 'skill'>;
  // Field-based filters
  skills?: string[];          // For any item with skills field
  company?: string[];         // For experiences
  year?: number[];            // Filter by year (works across all types)
  tags?: string[];            // General tags
  title_match?: string;       // For specific item queries (e.g., "APCS A", "HiLiTe")
  // Operations
  operation?: 'contains' | 'exact' | 'any';
  show_all?: boolean;         // Return all matches, not just top 5
}

/**
 * Enhanced intent detection result with optional filters
 */
export interface IntentResult {
  intent: Intent;
  filters?: QueryFilter;
  about_mike?: boolean;
}

/**
 * Captures temporal cues (explicit years or phrases like "this year")
 * so we can tailor retrieval and context ordering without re-classifying.
 */
export interface TemporalHints {
  years: number[];
  relative?: 'recent' | 'current' | 'upcoming' | 'past';
}

/**
 * Alias entry for matching entity names
 */
export type AliasEntry = { id: string; type: string; name: string; aliases: string[] };

/**
 * Auto-contact plan for queries that require direct communication
 */
export type AutoContactPlan = {
  reason: ContactReason;
  draft: string;
  preface: string;
  open?: ContactOpenBehavior;
};
