/**
 * Formatting utilities for converting KB items to context strings
 */

import { type KBItem } from '@/lib/iris/schema';
import { resolveSkillIdsToNames } from './aliases';
import { extractPrimaryYear } from './temporal';

/**
 * Kind labels for grouping context by type
 */
const KIND_LABELS: Record<string, string> = {
  project: 'Projects',
  experience: 'Experience',
  class: 'Classes',
  blog: 'Writing',
  story: 'Stories',
  value: 'Values',
  interest: 'Interests',
  education: 'Education',
  bio: 'Bio',
  skill: 'Skills'
};

/**
 * Formats a single KB item into a clean, structured context string with proper markdown
 * This structured format helps the LLM extract relevant information accurately
 * Handles different KBItem types (Project, Experience, Class, Blog, Story) with varying schemas
 *
 * @param doc - The KB item to format
 * @param includeDetails - If false, only includes title/summary (for list queries)
 * @param detailLevel - 'minimal' = name + summary only, 'standard' = + skills, 'full' = everything
 * @param skillMap - Optional map of skill ID to skill name for resolving skill IDs
 * @returns Formatted markdown string
 */
export function formatSingleDoc(
  doc: Partial<KBItem>,
  includeDetails = true,
  detailLevel: 'minimal' | 'standard' | 'full' = 'full',
  skillMap?: Map<string, string>
): string {
  const parts: string[] = [];

  // Display name varies by type - include dates/years for context to help downstream synthesis.
  let displayName = '';
  let dateInfo = '';

  if ('dates' in doc && doc.dates) {
    // Prefer end date when present so recent work surfaces for evaluative prompts.
    const endDate = doc.dates.end || 'Present';
    dateInfo = ` *(${doc.dates.start} – ${endDate})*`;
  } else if ('term' in doc && doc.term) {
    dateInfo = ` *(${doc.term})*`;
  }

  if ('title' in doc && doc.title) {
    displayName = doc.title;
  } else if ('role' in doc && doc.role) {
    displayName = `${doc.role}${('company' in doc && doc.company) ? ` at ${doc.company}` : ''}`;
  } else if ('value' in doc && doc.value) {
    displayName = `Value: ${doc.value}`;
  } else if ('interest' in doc && doc.interest) {
    displayName = `Interest: ${doc.interest}`;
  } else if ('school' in doc && doc.school) {
    displayName = `Education: ${doc.school}`;
    if ('degree' in doc && doc.degree) {
      displayName += ` – ${doc.degree}`;
    }
  } else if ('name' in doc && doc.name) {
    displayName = doc.name;
  } else if ('headline' in doc && doc.headline) {
    displayName = `Bio`;
  } else {
    displayName = doc.id || 'Unknown';
  }

  parts.push(`### ${displayName}${dateInfo}`);

  if ('summary' in doc && doc.summary) {
    parts.push(`${doc.summary}`);
    parts.push('');
  } else if ('text' in doc && doc.text) {
    parts.push(`${doc.text}`);
    parts.push('');
  } else if ('why' in doc && doc.why) {
    parts.push(`${doc.why}`);
    parts.push('');
  } else if ('headline' in doc && doc.headline) {
    parts.push(`**Headline:** ${doc.headline}`);
    if ('bio' in doc && doc.bio) {
      parts.push(doc.bio);
    }
    if ('name' in doc && doc.name) {
      parts.push(`**Name:** ${doc.name}`);
    }
    if ('work_authorization' in doc && doc.work_authorization) {
      parts.push(`**Work Authorization:** ${doc.work_authorization}`);
    }
    if ('availability' in doc && doc.availability) {
      parts.push(`**Availability:** ${doc.availability}`);
    }
    if ('location' in doc && doc.location) {
      parts.push(`**Location:** ${doc.location}`);
    }
    if ('language_proficiency' in doc && Array.isArray(doc.language_proficiency) && doc.language_proficiency.length > 0) {
      parts.push(`**Languages:** ${doc.language_proficiency.join(', ')}`);
    }
    parts.push('');
  } else if ('school' in doc && doc.school) {
    if ('gpa' in doc && doc.gpa) {
      parts.push(`**GPA:** ${doc.gpa}`);
    }
    if ('expected_grad' in doc && doc.expected_grad) {
      parts.push(`**Expected Graduation:** ${doc.expected_grad}`);
    }
    parts.push('');
  } else if ('description' in doc && doc.description) {
    parts.push(`${doc.description}`);
    parts.push('');
  }

  if (detailLevel === 'minimal' || !includeDetails) {
    if ('skills' in doc && Array.isArray(doc.skills) && doc.skills.length > 0) {
      const skillNames = skillMap
        ? resolveSkillIdsToNames(doc.skills as string[], skillMap)
        : doc.skills as string[];
      parts.push(`**Skills:** ${skillNames.slice(0, 6).join(', ')}`);
    }
    if ('language_proficiency' in doc && Array.isArray(doc.language_proficiency) && doc.language_proficiency.length > 0) {
      parts.push(`**Languages:** ${doc.language_proficiency.join(', ')}`);
    }
    return parts.join('\n');
  }

  if ('skills' in doc && Array.isArray(doc.skills) && doc.skills.length > 0) {
    const skillNames = skillMap
      ? resolveSkillIdsToNames(doc.skills as string[], skillMap)
      : doc.skills as string[];
    parts.push(`**Skills:** ${skillNames.join(', ')}`);
  }

  if ('evidence' in doc && Array.isArray(doc.evidence) && doc.evidence.length > 0) {
    parts.push(`**Evidence:** ${doc.evidence.length} reference${doc.evidence.length === 1 ? '' : 's'}`);
  }

  if (detailLevel === 'full') {
    if ('specifics' in doc && Array.isArray(doc.specifics) && doc.specifics.length > 0) {
      parts.push('**Key Details:**');
      for (const s of doc.specifics.slice(0, 4)) parts.push(`- ${s}`);
    }

    if ('architecture' in doc && doc.architecture) {
      parts.push(`**Architecture:** ${doc.architecture}`);
    }

    if ('tech_stack' in doc && Array.isArray(doc.tech_stack) && doc.tech_stack.length > 0) {
      parts.push(`**Tech Stack:** ${doc.tech_stack.join(', ')}`);
    }
  }

  return parts.join('\n');
}

/**
 * Formats multiple KB items into a context string
 *
 * @param docs - Array of KB items to format
 * @param includeDetails - Whether to include full details
 * @param detailLevel - Level of detail to include
 * @param skillMap - Optional skill name map
 * @returns Formatted context string
 */
export function formatContext(
  docs: Array<Partial<KBItem>>,
  includeDetails: boolean = true,
  detailLevel: 'minimal' | 'standard' | 'full' = 'full',
  skillMap?: Map<string, string>
): string {
  return docs
    .map(doc => formatSingleDoc(doc, includeDetails, detailLevel, skillMap))
    .join('\n\n---\n\n');
}

/**
 * User research showed the LLM performs better when context is pre-clustered.
 * Grouping by kind keeps list requests tidy and satisfies the "direct list" requirement.
 *
 * @param docs - Array of KB items to format
 * @param detailLevel - Level of detail to include
 * @param skillMap - Optional skill name map
 * @returns Formatted context grouped by kind
 */
export function formatContextByKind(
  docs: Array<Partial<KBItem>>,
  detailLevel: 'minimal' | 'standard' = 'standard',
  skillMap?: Map<string, string>
): string {
  const grouped = docs.reduce<Record<string, Array<Partial<KBItem>>>>((acc, doc) => {
    const key = ('kind' in doc && doc.kind) ? doc.kind : 'misc';
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([kind, items]) => {
      const heading = KIND_LABELS[kind] || kind;
      const sorted = items.sort((a, b) => {
        const yearA = extractPrimaryYear(a) ?? 0;
        const yearB = extractPrimaryYear(b) ?? 0;
        return yearB - yearA;
      });

      const bulletList = sorted
        .map(item => formatSingleDoc(item, true, detailLevel, skillMap).replace(/^### /, '- '))
        .join('\n');

      return `## ${heading}\n${bulletList}`;
    })
    .join('\n\n');
}

/**
 * Builds a compact index so the LLM can reference documents deterministically.
 *
 * @param results - Array of retrieval results
 * @returns Formatted context index
 */
export function buildContextIndex(results: Array<{ score: number; doc: Partial<KBItem> }>): string {
  if (results.length === 0) {
    return '';
  }

  const lines = results.map((result, idx) => {
    const doc = result.doc;

    // Build human-readable label based on type
    let label = '';
    if ('title' in doc && doc.title) {
      label = doc.title;
    } else if ('name' in doc && doc.name) {
      label = doc.name;
    } else if ('role' in doc && doc.role) {
      // For experiences: show "role at company"
      label = doc.role;
      if ('company' in doc && doc.company) {
        label += ` at ${doc.company}`;
      }
    } else if ('value' in doc && doc.value) {
      label = `Value: ${doc.value}`;
    } else if ('interest' in doc && doc.interest) {
      label = `Interest: ${doc.interest}`;
    } else if ('school' in doc && doc.school) {
      label = doc.school;
      if ('degree' in doc && doc.degree) {
        label += ` - ${doc.degree}`;
      }
    } else {
      label = doc.id || `Item ${idx + 1}`;
    }

    const kind = 'kind' in doc && doc.kind ? doc.kind : 'item';
    const year = extractPrimaryYear(doc);
    const score = result.score.toFixed(2);

    return `${idx + 1}. [${kind}] ${label}${year ? ` (${year})` : ''} - score ${score}`;
  });

  return `# Context Index\n${lines.join('\n')}`;
}
