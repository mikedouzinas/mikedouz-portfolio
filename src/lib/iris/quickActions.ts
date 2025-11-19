import type { QuickAction } from '@/components/iris/QuickActions';
import type { KBItem } from './schema';
import type { QueryFilter } from '@/app/api/iris/answer/route';

interface ActionContext {
  query: string;
  intent: string;
  filters?: QueryFilter;
  results: Array<{ score: number; doc: Partial<KBItem> }>;
  fullAnswer: string;
  allItems: KBItem[];
  depth?: number; // Track conversation depth for limiting follow-ups
}

interface AvailableContext {
  hasProjects: boolean;
  hasBlogs: boolean;
  hasExperience: boolean;
  hasClasses: boolean;
  hasPersonal: boolean;

  // What's been shown
  shownTypes: Set<string>;
  shownItemsCount: number;

  // Depth tracking
  isDeepDive: boolean;  // True if query is about a specific item
  canGoDeeper: boolean; // True if there are related items to explore

  // Available next steps
  relatedProjects: KBItem[];
  relatedExperience: KBItem[];
  usesSkills: string[];
}

/**
 * Analyze what context is available and what's been shown
 * This helps determine which quick actions make sense
 */
function analyzeAvailableContext(context: ActionContext): AvailableContext {
  const { allItems, results, intent, filters } = context;

  // Check what types exist in the knowledge base
  const hasProjects = allItems.some(item => item.kind === 'project');
  const hasBlogs = allItems.some(item => item.kind === 'blog');
  const hasExperience = allItems.some(item => item.kind === 'experience');
  const hasClasses = allItems.some(item => item.kind === 'class');
  const hasPersonal = allItems.some(item =>
    item.kind === 'story' || item.kind === 'value' || item.kind === 'interest'
  );

  // Track what's been shown
  const shownTypes = new Set(results.map(r => r.doc.kind || 'unknown'));
  const shownItemsCount = results.length;

  // Determine if this is a deep dive
  const isDeepDive = intent === 'specific_item' ||
                     (filters?.title_match !== undefined);

  // Check if we can go deeper
  const canGoDeeper = isDeepDive && results.length > 0;

  // Find related items if this is a deep dive
  const relatedProjects: KBItem[] = [];
  const relatedExperience: KBItem[] = [];
  const usesSkills: string[] = [];

  if (isDeepDive && results.length > 0) {
    const mainItem = results[0].doc;

    // Extract skills from the main item
    if ('skills' in mainItem && Array.isArray(mainItem.skills)) {
      usesSkills.push(...mainItem.skills.slice(0, 3)); // Top 3 skills
    }

    // Find related projects (same skills or related company)
    relatedProjects.push(...allItems.filter(item => {
      if (item.kind !== 'project') return false;
      if (results.some(r => r.doc.id === item.id)) return false; // Already shown

      // Check for skill overlap
      if ('skills' in item && 'skills' in mainItem) {
        const itemSkills = item.skills as string[];
        const mainSkills = mainItem.skills as string[];
        const overlap = itemSkills.filter(s => mainSkills.includes(s));
        return overlap.length > 0;
      }

      return false;
    }).slice(0, 5));

    // Find related experience (same company)
    if ('company' in mainItem) {
      relatedExperience.push(...allItems.filter(item => {
        if (item.kind !== 'experience') return false;
        if (results.some(r => r.doc.id === item.id)) return false;
        return 'company' in item && item.company === mainItem.company;
      }).slice(0, 3));
    }
  }

  return {
    hasProjects,
    hasBlogs,
    hasExperience,
    hasClasses,
    hasPersonal,
    shownTypes,
    shownItemsCount,
    isDeepDive,
    canGoDeeper,
    relatedProjects,
    relatedExperience,
    usesSkills,
  };
}

/**
 * Extract suggested follow-ups from Iris's answer
 * Looks for questions or suggestions in the response
 */
function extractSuggestions(answer: string): string[] {
  const suggestions: string[] = [];

  // Look for questions Iris asks (with question mark)
  const questionMatches = answer.match(/(?:Want|Would you like|Interested in|Curious about)[^?]+\?/gi);
  if (questionMatches) {
    suggestions.push(...questionMatches.map(q => q.trim()));
  }

  // Look for "I can show you" patterns
  const canShowMatches = answer.match(/I can (?:show|share|tell you about|walk you through)[^.!]+/gi);
  if (canShowMatches) {
    suggestions.push(...canShowMatches.map(s => s.trim()));
  }

  // Look for "just let me know" or "want more details" patterns (without question mark)
  // These are common ways Iris suggests follow-ups
  const letMeKnowMatches = answer.match(/(?:just let me know|want more details|if you want|if you'd like|feel free to ask)[^.!]+/gi);
  if (letMeKnowMatches) {
    suggestions.push(...letMeKnowMatches.map(s => s.trim()));
  }

  return suggestions;
}

/**
 * Check if answer has a contact directive
 * If so, generate contact quick actions
 */
function hasContactDirective(answer: string): boolean {
  return /<ui:contact\b/.test(answer);
}

/**
 * Generate contact quick actions when contact directive is present
 * Returns 4 standard contact actions: LinkedIn, GitHub, Message Mike, Email
 */
function generateContactActions(): QuickAction[] {
  return [
    {
      type: 'contact_link',
      label: 'LinkedIn',
      link: 'https://linkedin.com/in/mikedouzinas',
      linkType: 'linkedin',
    },
    {
      type: 'contact_link',
      label: 'GitHub',
      link: 'https://github.com/mikedouzinas',
      linkType: 'github',
    },
    {
      type: 'message_mike',
      label: 'Message Mike',
    },
    {
      type: 'contact_link',
      label: 'Email',
      link: 'mike@douzinas.com',
      linkType: 'email',
    },
  ];
}

/**
 * Generate smart quick actions based on context
 * Maximum 5 actions to avoid clutter
 * Enforces depth limit: no specific follow-up actions after 2 follow-ups (depth >= 2)
 * Generic "Ask a follow up..." action is available up to depth 4 to allow continued conversation
 */
export function generateQuickActions(context: ActionContext): QuickAction[] {
  const actions: QuickAction[] = [];
  const { fullAnswer, intent, depth = 0 } = context;

  // If there's a contact directive, show contact quick actions
  if (hasContactDirective(fullAnswer)) {
    return generateContactActions();
  }

  // Hard limit: no follow-up/filter actions after depth 4
  // Still allow contact links and message_mike actions
  // However, always allow the generic "Ask a follow up..." action up to depth 4
  const canAddFollowUps = depth < 4;
  const canAddGenericFollowUp = depth < 6; // Always allow generic follow-up up to depth 4

  const available = analyzeAvailableContext(context);
  const suggestions = extractSuggestions(fullAnswer);

  // Parse Iris's suggestions and convert to actions
  // Only add follow-up actions if under depth limit
  if (canAddFollowUps) {
    for (const suggestion of suggestions.slice(0, 2)) { // Max 2 from suggestions
      // "Want me to share key moments?"
      if (/key moments/i.test(suggestion)) {
        actions.push({
          type: 'specific',
          label: 'Key moments',
          intent: 'personal',
          filters: { type: ['story', 'value'] },
        });
      }

      // "Want to see projects?"
      else if (/projects?/i.test(suggestion) && available.hasProjects) {
        actions.push({
          type: 'specific',
          label: 'See projects',
          query: 'show me projects',
          intent: 'filter_query',
          filters: { type: ['project'], show_all: true },
        });
      }

      // "Read blogs/writing?"
      else if (/(blogs?|writing)/i.test(suggestion) && available.hasBlogs) {
        actions.push({
          type: 'specific',
          label: 'Read blogs',
          query: 'show me blogs',
          intent: 'filter_query',
          filters: { type: ['blog'], show_all: true },
        });
      }

      // "See work experience?"
      else if (/experience|work/i.test(suggestion) && available.hasExperience) {
        actions.push({
          type: 'specific',
          label: 'See experience',
          query: 'show me work experience',
          intent: 'filter_query',
          filters: { type: ['experience'], show_all: true },
        });
      }
    }

    // Add related items if this is a deep dive
    if (available.canGoDeeper && available.relatedProjects.length > 0) {
      actions.push({
        type: 'specific',
        label: 'Related projects',
        query: `projects using ${available.usesSkills.slice(0, 2).join(' and ')}`,
        intent: 'filter_query',
        filters: {
          type: ['project'],
          skills: available.usesSkills.slice(0, 2),
        },
      });
    }
  }

  // Always add generic follow-up action when depth < 4
  // This should always be available to allow continued conversation
  // Add it here (outside the canAddFollowUps block) to ensure it's always included
  // even if no other follow-up actions were added
  if (canAddGenericFollowUp) {
    // Check if it's already added (shouldn't be, but safety check)
    const hasFollowUp = actions.some(a => a.type === 'custom_input');
    if (!hasFollowUp) {
      actions.push({
        type: 'custom_input',
        label: 'Ask a follow up...',
      });
    }
  }

  // Add contact links if this was about work/projects
  if (intent === 'filter_query' || intent === 'specific_item') {
    const shownProjects = available.shownTypes.has('project');
    const shownExperience = available.shownTypes.has('experience');

    if (shownProjects) {
      actions.push({
        type: 'contact_link',
        label: 'GitHub',
        link: 'https://github.com/mikedouzinas',
        linkType: 'github',
      });
    }

    if (shownExperience) {
      actions.push({
        type: 'contact_link',
        label: 'LinkedIn',
        link: 'https://linkedin.com/in/mikedouzinas',
        linkType: 'linkedin',
      });
    }
  }

  // Add "Message Mike" if it makes sense
  // - If we've gone deep and exhausted related content
  // - If this was a personal query
  // - If suggestions mentioned contacting
  const shouldShowMessage =
    (available.isDeepDive && available.relatedProjects.length === 0) ||
    intent === 'personal' ||
    /contact|message|reach out/i.test(fullAnswer);

  if (shouldShowMessage && actions.length < 5) {
    actions.push({
      type: 'message_mike',
      label: 'Message Mike',
    });
  }

  // Limit to 5 actions max, but always preserve the generic follow-up if depth < 4
  // This ensures users can always continue the conversation
  if (actions.length > 5 && canAddGenericFollowUp) {
    const followUpAction = actions.find(a => a.type === 'custom_input');
    if (followUpAction) {
      // Remove follow-up temporarily, trim to 4, then add it back
      const otherActions = actions.filter(a => a.type !== 'custom_input').slice(0, 4);
      return [...otherActions, followUpAction];
    }
  }
  
  // CRITICAL: Always ensure at least one quick action is returned
  // This guarantees users can always continue the conversation or take action
  // Professional comment: Even at high depth levels, we should provide at least one way
  // for users to continue engaging (follow-up or message)
  if (actions.length === 0) {
    // Fallback: Add generic follow-up if we haven't hit the absolute limit
    // Or add "Message Mike" as a last resort
    if (depth < 4) {
      // Allow follow-up even at higher depths as absolute fallback
      actions.push({
        type: 'custom_input',
        label: 'Ask a follow up...',
      });
    } else {
      // Absolute last resort: message option
      actions.push({
        type: 'message_mike',
        label: 'Message Mike',
      });
    }
  }
  
  return actions.slice(0, 5);
}
