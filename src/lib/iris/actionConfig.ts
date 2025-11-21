/**
 * Action configuration system for quick actions
 * Defines what actions each KB item type should have
 */

import type { KBItem, ProjectT, ExperienceT, ClassT, BlogT, SkillT, InterestT, EducationT } from './schema';
import type { Rankings } from './rankings';

/**
 * Get human-readable display name for any KB item
 * This is the universal solution to prevent raw IDs (like "education_0") from appearing in quick actions
 * 
 * Priority order for display names:
 * 1. title (projects, classes, blogs)
 * 2. short_name (blogs - concise display)
 * 3. name (skills, profile)
 * 4. role + company (experiences)
 * 5. school (education)
 * 6. interest (interests)
 * 7. value (values)
 * 8. Formatted ID as fallback (for skills only - formats "nlp" -> "NLP")
 * 
 * @param item - The KB item to get display name for
 * @returns Human-readable display name
 */
function getDisplayName(item: KBItem): string {
  // For title-based items (projects, classes, blogs, stories)
  if ('title' in item && item.title) {
    // For blogs, prefer short_name over full title for concise display
    const blog = item as BlogT;
    if ('short_name' in item && blog.short_name) {
      return blog.short_name;
    }
    return item.title;
  }
  
  // Professional comment: For bio items (profile), use friendly label instead of legal name
  // "Michael (Mike) Konstantinos Veson" → "Mike's Profile"
  if (item.kind === 'bio') {
    return "Mike's Profile";
  }
  
  // For skills with name field
  if ('name' in item && item.name && item.kind === 'skill') {
    return item.name;
  }
  
  // For experiences: "Company (Role Type)" with alias support
  if ('role' in item && item.role) {
    if ('company' in item && item.company) {
      const exp = item as ExperienceT;
      return getShortExperienceLabel(exp.company, exp.role, exp.aliases);
    }
    return item.role;
  }
  
  // For education items
  if ('school' in item && item.school) {
    const edu = item as EducationT;
    // Professional comment: For quick action buttons, just use school name (not full degree)
    // "Rice University" fits better than "Rice University - B.S. Computer Science"
    return edu.school;
  }
  
  // For interests (not used in individual quick actions - interests are aggregated)
  if ('interest' in item && item.interest) {
    return item.interest;
  }
  
  // For values (not used in individual quick actions - values are aggregated)
  if ('value' in item && item.value) {
    return item.value;
  }
  
  // Fallback: For skills, format the ID nicely; for others, use raw ID
  if (item.kind === 'skill') {
    return formatSkillId(item.id);
  }
  
  return item.id;
}

/**
 * Format skill ID to readable display name
 * Transforms raw IDs like "nlp" -> "NLP", "machine_learning" -> "Machine Learning"
 * Used ONLY for skills to provide shorter, cleaner labels in quick actions
 * 
 * Rules:
 * - Known acronyms: uppercase all letters (nlp -> NLP, aws -> AWS)
 * - Special cases: use custom mappings (csharp -> C#, dotnet -> .NET)
 * - Underscore-separated: title case each word (machine_learning -> Machine Learning)
 * - Simple words: capitalize first letter (python -> Python)
 * 
 * @param skillId - The skill ID to format
 * @returns Formatted display name
 */
function formatSkillId(skillId: string): string {
  // Known acronyms - uppercase all letters
  const acronyms = new Set([
    'nlp', 'rag', 'aws', 'api', 'ci_cd', 'ai', 'ml', 'cv', 'ui', 'ux',
    'html', 'css', 'sql', 'nosql', 'rest', 'grpc', 'json', 'xml', 'http',
    'tcp', 'udp', 'ssh', 'tls', 'ssl', 'gpu', 'cpu'
  ]);
  
  // Special cases - custom formatting
  const specialCases: Record<string, string> = {
    'csharp': 'C#',
    'c_lang': 'C',
    'r_lang': 'R',
    'dotnet': '.NET',
    'nextjs': 'Next.js',
    'opencv': 'OpenCV',
    'pytorch': 'PyTorch',
    'scikit_learn': 'Scikit-Learn',
    'openai_api': 'OpenAI API',
    'google_document_ai': 'Google Document AI',
    'tailwind_css': 'Tailwind CSS',
    'framer_motion': 'Framer Motion',
    'power_bi': 'Power BI',
    'sentence_transformers': 'Sentence Transformers',
    'ai_ethics_policy': 'AI Ethics & Policy'
  };
  
  // Check special cases first
  if (specialCases[skillId]) {
    return specialCases[skillId];
  }
  
  // Check if it's a known acronym
  if (acronyms.has(skillId)) {
    return skillId.toUpperCase();
  }
  
  // Check if it ends with _api, _integration, etc.
  if (skillId.includes('_')) {
    const parts = skillId.split('_');
    
    // Check if last part is an acronym (e.g., "openai_api")
    if (acronyms.has(parts[parts.length - 1])) {
      return parts.map((part, idx) => {
        if (idx === parts.length - 1 && acronyms.has(part)) {
          return part.toUpperCase();
        }
        return part.charAt(0).toUpperCase() + part.slice(1);
      }).join(' ');
    }
    
    // Otherwise, title case each word
    return parts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  }
  
  // Simple word - capitalize first letter
  return skillId.charAt(0).toUpperCase() + skillId.slice(1);
}

/**
 * Generate short display label for experiences
 * Converts "Software Engineering Intern (IMOS – Laytime Automation)" to role type abbreviation
 * Used in quick action labels to keep them concise
 */
function getShortRoleType(role: string): string {
  // Software Engineer variants
  if (/software.*engineer/i.test(role)) return 'SWE';
  // Data Science variants
  if (/data.*scien/i.test(role)) return 'Data Science';
  // Mobile/iOS dev variants
  if (/(ios|mobile).*dev/i.test(role)) return 'iOS Dev';
  // Frontend/Backend variants
  if (/frontend/i.test(role)) return 'Frontend';
  if (/backend/i.test(role)) return 'Backend';
  // General dev/engineering
  if (/developer/i.test(role)) return 'Dev';
  if (/engineer/i.test(role)) return 'Engineer';
  // Product/Design
  if (/product/i.test(role)) return 'Product';
  if (/design/i.test(role)) return 'Design';

  // Fallback: First 2-3 words of role
  const words = role.split(/[\s\-()]+/).filter(w => w.length > 2);
  return words.slice(0, 2).join(' ');
}

/**
 * Generate short label for experience: "Company (Role Type)"
 * Example: "Veson Nautical (SWE Intern)" or "Veson (SWE)"
 * 
 * Professional comment: Prefers aliases over company name abbreviation for better readability.
 * For example, "Liu Idea Lab for Innovation..." has alias "Lilie", which is more recognizable
 * than the abbreviated "Liu".
 */
function getShortExperienceLabel(company: string, role: string, aliases?: string[]): string {
  const roleType = getShortRoleType(role);

  // Professional comment: If there's a short alias (≤15 chars), prefer it over abbreviation
  // This handles cases like "Lilie" (alias) vs "Liu" (first word of long company name)
  let shortCompany = company;
  if (aliases && aliases.length > 0) {
    const shortAlias = aliases.find(alias => alias.length <= 15 && alias.length > 0);
    if (shortAlias) {
      shortCompany = shortAlias;
    } else if (company.length > 20) {
      // No short alias found, fall back to abbreviation
      shortCompany = company.split(/[\s\-]/)[0]; // Take first word
    }
  } else if (company.length > 20) {
    // No aliases at all, use abbreviation for long names
    shortCompany = company.split(/[\s\-]/)[0]; // Take first word
  }

  return `${shortCompany} (${roleType})`;
}

// Action types we can generate
export type ActionType =
  | 'link'              // External link (GitHub, demo, article, company site)
  | 'dropdown'          // Searchable dropdown (skills, evidence)
  | 'query'             // Pre-filled Iris query
  | 'message_mike'      // Open MessageComposer
  | 'custom_input';     // Generic follow-up input

// Action template for generating actions
export interface ActionTemplate {
  type: ActionType;
  label: string | ((item: KBItem) => string);
  priority: number;  // Higher = more important (1-10 scale)

  // Conditions for showing this action
  condition?: (item: KBItem) => boolean;

  // Data extraction functions
  // Professional note: allItems parameter added to enable ID-to-title lookups
  // This prevents raw IDs like "education_0" from appearing in action labels
  getData?: (item: KBItem, rankings: Rankings, allItems: KBItem[]) => ActionData;
}

export interface ActionData {
  link?: string;
  linkType?: 'github' | 'linkedin' | 'email' | 'external' | 'demo' | 'company';
  query?: string;
  intent?: string;
  filters?: Record<string, unknown>;
  options?: Array<{ id: string; label: string; importance?: number }>;
}

/**
 * Action configuration for each KB item type
 * Defines what actions are available for each type
 */
export const ACTION_CONFIG: Record<string, ActionTemplate[]> = {
  // ========================================
  // PROJECT ACTIONS
  // ========================================
  project: [
    {
      type: 'link',
      label: 'GitHub',
      priority: 9,
      condition: (item) => 'links' in item && 'github' in (item.links || {}),
      getData: (item) => ({
        link: (item as ProjectT).links?.github,
        linkType: 'github'
      })
    },
    {
      type: 'link',
      label: 'Live Demo',
      priority: 9,
      condition: (item) => 'links' in item && 'demo' in (item.links || {}),
      getData: (item) => ({
        link: (item as ProjectT).links?.demo,
        linkType: 'demo'
      })
    },
    {
      type: 'query',
      label: 'Fetch recent updates',
      priority: 7,
      condition: (item) => 'links' in item && 'github' in (item.links || {}),
      getData: (item) => {
        const project = item as ProjectT;
        // Extract repo name from GitHub URL (https://github.com/user/repo)
        const githubUrl = project.links?.github || '';
        const repoMatch = githubUrl.match(/github\.com\/([^/]+\/[^/]+)/);
        const repo = repoMatch ? repoMatch[1].replace('.git', '') : '';

        return {
          query: `show recent GitHub activity for ${project.title}`,
          intent: 'github_activity',
          filters: { repo }
        };
      }
    },
    {
      type: 'dropdown',
      label: 'Skills',
      priority: 8,
      condition: (item) => 'skills' in item && (item.skills as string[]).length > 0,
      getData: (item, rankings, allItems) => {
        const project = item as ProjectT;
        // Professional note: Look up skill items to get proper display names
        const skillOptions = project.skills
          .map(skillId => {
            // Find the actual skill item to get its display name
            const skillItem = allItems.find(kbItem => kbItem.id === skillId && kbItem.kind === 'skill');
            const ranking = rankings.skills.find(s => s.id === skillId);
            return {
              id: skillId,
              // Use getDisplayName if skill item found, otherwise format the ID
              label: skillItem ? getDisplayName(skillItem) : formatSkillId(skillId),
              importance: ranking?.importance || 50
            };
          })
          .sort((a, b) => b.importance - a.importance);

        return {
          options: skillOptions
        };
      }
    },
    {
      type: 'query',
      label: 'Related projects',
      priority: 7,
      condition: (item) => 'skills' in item && (item.skills as string[]).length > 0,
      getData: (item) => {
        const project = item as ProjectT;
        const topSkills = project.skills.slice(0, 2);
        return {
          query: `projects using ${topSkills.join(' and ')}`,
          intent: 'filter_query',
          filters: { type: ['project'], skills: topSkills }
        };
      }
    },
    {
      type: 'message_mike',
      label: 'Message Mike',
      priority: 5,
      getData: () => ({})
    }
  ],

  // ========================================
  // EXPERIENCE ACTIONS
  // ========================================
  experience: [
    {
      type: 'link',
      label: 'Company Website',
      priority: 8,
      condition: (item) => 'links' in item && 'company' in (item.links || {}),
      getData: (item) => ({
        link: (item as ExperienceT).links?.company,
        linkType: 'company'
      })
    },
    {
      type: 'link',
      label: 'LinkedIn',
      priority: 7,
      getData: () => ({
        link: 'https://linkedin.com/in/mikedouzinas',
        linkType: 'linkedin'
      })
    },
    {
      type: 'dropdown',
      label: 'Skills',
      priority: 8,
      condition: (item) => 'skills' in item && (item.skills as string[]).length > 0,
      getData: (item, rankings, allItems) => {
        const exp = item as ExperienceT;
        // Professional note: Look up skill items to get proper display names
        const skillOptions = exp.skills
          .map(skillId => {
            // Find the actual skill item to get its display name
            const skillItem = allItems.find(kbItem => kbItem.id === skillId && kbItem.kind === 'skill');
            const ranking = rankings.skills.find(s => s.id === skillId);
            return {
              id: skillId,
              // Use getDisplayName if skill item found, otherwise format the ID
              label: skillItem ? getDisplayName(skillItem) : formatSkillId(skillId),
              importance: ranking?.importance || 50
            };
          })
          .sort((a, b) => b.importance - a.importance);

        return {
          options: skillOptions
        };
      }
    },
    {
      type: 'query',
      label: (item) => `Other work at ${(item as ExperienceT).company}`,
      priority: 7,
      condition: (item) => 'company' in item,
      getData: (item) => {
        const exp = item as ExperienceT;
        return {
          query: `work at ${exp.company}`,
          intent: 'filter_query',
          filters: { type: ['experience'], company: [exp.company] }
        };
      }
    },
    {
      type: 'query',
      label: 'Similar technical work',
      priority: 6,
      condition: (item) => 'skills' in item && (item.skills as string[]).length > 0,
      getData: (item) => {
        const exp = item as ExperienceT;
        const topSkills = exp.skills.slice(0, 2);
        return {
          query: `work using ${topSkills.join(' and ')}`,
          intent: 'filter_query',
          filters: { type: ['experience', 'project'], skills: topSkills }
        };
      }
    },
    {
      type: 'message_mike',
      label: 'Message Mike',
      priority: 5,
      getData: () => ({})
    }
  ],

  // ========================================
  // CLASS ACTIONS
  // ========================================
  class: [
    {
      type: 'dropdown',
      label: 'Skills',
      priority: 8,
      condition: (item) => 'skills' in item && (item.skills as string[]).length > 0,
      getData: (item, rankings, allItems) => {
        const cls = item as ClassT;
        // Professional note: Look up skill items to get proper display names
        const skillOptions = cls.skills
          .map(skillId => {
            // Find the actual skill item to get its display name
            const skillItem = allItems.find(kbItem => kbItem.id === skillId && kbItem.kind === 'skill');
            const ranking = rankings.skills.find(s => s.id === skillId);
            return {
              id: skillId,
              // Use getDisplayName if skill item found, otherwise format the ID
              label: skillItem ? getDisplayName(skillItem) : formatSkillId(skillId),
              importance: ranking?.importance || 50
            };
          })
          .sort((a, b) => b.importance - a.importance);

        return {
          options: skillOptions
        };
      }
    },
    {
      type: 'query',
      label: 'Work using these skills',
      priority: 7,
      condition: (item) => 'skills' in item && (item.skills as string[]).length > 0,
      getData: (item) => {
        const cls = item as ClassT;
        const topSkills = cls.skills.slice(0, 3);
        return {
          query: `work using ${topSkills.join(', ')}`,
          intent: 'filter_query',
          filters: { type: ['project', 'experience'], skills: topSkills }
        };
      }
    },
    {
      type: 'query',
      label: 'Related classes',
      priority: 6,
      condition: (item) => 'skills' in item && (item.skills as string[]).length > 0,
      getData: (item) => {
        const cls = item as ClassT;
        const topSkills = cls.skills.slice(0, 2);
        return {
          query: `classes covering ${topSkills.join(' and ')}`,
          intent: 'filter_query',
          filters: { type: ['class'], skills: topSkills }
        };
      }
    },
    {
      type: 'message_mike',
      label: 'Message Mike',
      priority: 5,
      getData: () => ({})
    }
  ],

  // ========================================
  // BLOG ACTIONS
  // ========================================
  blog: [
    {
      type: 'link',
      label: 'Read Article',
      priority: 10,
      condition: (item) => 'url' in item,
      getData: (item) => ({
        link: (item as BlogT).url,
        linkType: 'external'
      })
    },
    {
      type: 'query',
      label: 'Related work',
      priority: 7,
      condition: (item) => {
        const blog = item as BlogT;
        return (blog.related_experiences?.length || 0) > 0 ||
               (blog.related_projects?.length || 0) > 0;
      },
      getData: (item) => {
        const blog = item as BlogT;
        const related = [
          ...(blog.related_experiences || []),
          ...(blog.related_projects || [])
        ];
        return {
          query: `tell me about ${related[0]}`,
          intent: 'specific_item',
          filters: { title_match: related[0] }
        };
      }
    },
    {
      type: 'message_mike',
      label: 'Message Mike',
      priority: 6,
      getData: () => ({})
    }
  ],

  // ========================================
  // SKILL ACTIONS
  // ========================================
  skill: [
    {
      type: 'dropdown',
      label: 'See evidence',
      priority: 9,
      condition: (item) => 'evidence' in item && (item as SkillT).evidence.length > 0,
      getData: (item, rankings, allItems) => {
        const skill = item as SkillT;
        // Professional note: Look up actual KB items by ID to get human-readable names
        // This prevents raw IDs like "education_0" from appearing in quick actions
        const evidenceOptions = skill.evidence
          .map(e => {
            // Find the actual KB item to get its display name
            const evidenceItem = allItems.find(kbItem => kbItem.id === e.id);
            if (!evidenceItem) {
              console.warn(`[actionConfig] Evidence item not found: ${e.id}`);
              return null;
            }
            
            // Get human-readable display name for the evidence item
            const displayName = getDisplayName(evidenceItem);
            
            const ranking = rankings.all.find(r => r.id === e.id);
            return {
              id: e.id,
              label: displayName, // Use display name instead of raw ID
              importance: ranking?.importance || 50
            };
          })
          .filter((opt): opt is NonNullable<typeof opt> => opt !== null) // Remove any null entries
          .sort((a, b) => b.importance - a.importance);

        return {
          options: evidenceOptions
        };
      }
    },
    {
      type: 'query',
      label: 'Top skills often used with this',
      priority: 7,
      getData: (item) => {
        const skill = item as SkillT;
        const skillName = getDisplayName(skill);
        // Professional comment: Make query contextual to the specific skill
        // This ensures the query meaning matches the action label ("skills often used with THIS")
        // Example: "What skills does Mike often use with NLP?" instead of generic "what other skills?"
        return {
          query: `What skills does Mike often use with ${skillName}?`,
          intent: 'filter_query',
          filters: { type: ['skill'] }
        };
      }
    },
    {
      type: 'message_mike',
      label: 'Message Mike',
      priority: 5,
      getData: () => ({})
    }
  ],

  // ========================================
  // PERSONAL ITEM ACTIONS (story, value, interest)
  // ========================================
  story: [
    {
      type: 'query',
      label: 'Related stories',
      priority: 7,
      getData: () => ({
        query: 'tell me more about Mike\'s background',
        intent: 'personal'
      })
    },
    {
      type: 'message_mike',
      label: 'Message Mike',
      priority: 6,
      getData: () => ({})
    }
  ],

  value: [
    {
      type: 'query',
      label: 'Related stories',
      priority: 7,
      getData: () => ({
        query: 'tell me more about Mike\'s values',
        intent: 'personal'
      })
    },
    {
      type: 'message_mike',
      label: 'Message Mike',
      priority: 6,
      getData: () => ({})
    }
  ],

  interest: [
    {
      type: 'query',
      label: 'Related work',
      priority: 7,
      getData: (item) => {
        const interest = item as InterestT;
        return {
          query: `projects related to ${interest.interest}`,
          intent: 'filter_query',
          filters: { type: ['project'] }
        };
      }
    },
    {
      type: 'message_mike',
      label: 'Message Mike',
      priority: 6,
      getData: () => ({})
    }
  ],

  // ========================================
  // EDUCATION & BIO ACTIONS
  // ========================================
  education: [
    {
      type: 'query',
      label: 'Classes at this school',
      priority: 8,
      getData: (item) => {
        const edu = item as EducationT;
        return {
          query: `classes at ${edu.school}`,
          intent: 'filter_query',
          filters: { type: ['class'] }
        };
      }
    },
    {
      type: 'message_mike',
      label: 'Message Mike',
      priority: 5,
      getData: () => ({})
    }
  ],

  bio: [
    {
      type: 'message_mike',
      label: 'Message Mike',
      priority: 10,
      getData: () => ({})
    }
  ]
};

/**
 * Get actions for a specific KB item
 * Returns sorted array of action templates based on priority
 */
export function getActionsForItem(item: KBItem): ActionTemplate[] {
  const config = ACTION_CONFIG[item.kind] || [];

  // Filter by conditions
  const applicable = config.filter(template => {
    if (!template.condition) return true;
    return template.condition(item);
  });

  // Sort by priority (descending)
  return applicable.sort((a, b) => b.priority - a.priority);
}

/**
 * Get actions for a list of items (list view)
 * Returns aggregate actions like "See all projects", "Filter by skill"
 */
export function getActionsForList(
  items: KBItem[],
  listType: 'project' | 'experience' | 'class' | 'skill' | 'blog' | 'mixed',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _rankings: Rankings
): ActionTemplate[] {
  // For list views, we want different actions
  if (listType === 'project') {
    const actions: ActionTemplate[] = [];

    // Add drill-down for top project
    if (items.length > 0) {
      const topProject = items[0];
      const displayName = ('title' in topProject && topProject.title) ? topProject.title : topProject.id;

      actions.push({
        type: 'query',
        label: `See ${displayName}`,
        priority: 10,
        getData: () => ({
          // Professional comment: Use display name in query so Iris understands the reference
          // Raw IDs like "proj_portfolio" confuse the LLM when context shows "Portfolio & Iris"
          query: `tell me about ${displayName}`,
          intent: 'specific_item',
          filters: { title_match: topProject.id }
        })
      });
    }

    actions.push({
      type: 'link',
      label: 'GitHub Profile',
      priority: 8,
      getData: () => ({
        link: 'https://github.com/mikedouzinas',
        linkType: 'github'
      })
    });

    actions.push(    {
      type: 'dropdown',
      label: 'Filter by skill',
      priority: 9,
      getData: (item, rankings, allItems) => {
        // Get all unique skills from projects
        const allSkills = new Set<string>();
        items.forEach(item => {
          if ('skills' in item) {
            (item.skills as string[]).forEach(s => allSkills.add(s));
          }
        });

        // Professional note: Look up skill names from allItems for consistent labeling
        const skillOptions = Array.from(allSkills)
          .map(skillId => {
            // Find the actual skill item to get its display name
            const skillItem = allItems.find(kbItem => kbItem.id === skillId && kbItem.kind === 'skill');
            const ranking = rankings.skills.find(s => s.id === skillId);
            return {
              id: skillId,
              // Use getDisplayName if skill item found, otherwise format the ID
              label: skillItem ? getDisplayName(skillItem) : formatSkillId(skillId),
              importance: ranking?.importance || 50
            };
          })
          .sort((a, b) => b.importance - a.importance);

        return {
          options: skillOptions
        };
      }
    });

    return actions;
  }

  if (listType === 'experience') {
    const actions: ActionTemplate[] = [];

    // Add drill-down for top experience
    if (items.length > 0) {
      const topExp = items[0];
      let displayName = '';
      if ('role' in topExp && topExp.role && 'company' in topExp && topExp.company) {
        // Use short label for experiences: "Company (Role Type)" with alias support
        const exp = topExp as ExperienceT;
        displayName = getShortExperienceLabel(exp.company, exp.role, exp.aliases);
      } else if ('role' in topExp && topExp.role) {
        displayName = topExp.role;
      } else {
        displayName = topExp.id;
      }

      actions.push({
        type: 'query',
        label: `See ${displayName}`,
        priority: 10,
        getData: () => ({
          // Professional comment: Use display name in query for clarity with Iris
          // Experience IDs like "exp_veson_2024" aren't meaningful to the LLM
          query: `tell me about ${displayName}`,
          intent: 'specific_item',
          filters: { title_match: topExp.id }
        })
      });
    }

    actions.push({
      type: 'link',
      label: 'LinkedIn',
      priority: 8,
      getData: () => ({
        link: 'https://linkedin.com/in/mikedouzinas',
        linkType: 'linkedin'
      })
    });

    return actions;
  }

  if (listType === 'skill') {
    return [
      {
        type: 'dropdown',
        label: 'Skills',
        priority: 9,
        getData: (item, rankings, allItems) => {
          // Professional note: Use getDisplayName for consistent skill labeling
          const skillOptions = items
            .filter(i => i.kind === 'skill')
            .map(skill => {
              const ranking = rankings.skills.find(s => s.id === skill.id);
              return {
                id: skill.id,
                label: getDisplayName(skill), // Use getDisplayName instead of formatSkillId
                importance: ranking?.importance || 50
              };
            })
            .sort((a, b) => b.importance - a.importance);

          return {
            options: skillOptions
          };
        }
      }
    ];
  }

  // Mixed results - show drill-down actions for top items + social links
  if (listType === 'mixed') {
    const actions: ActionTemplate[] = [];

    // Professional comment: Check for aggregatable profile attributes
    const hasValues = items.some(item => item.kind === 'value');
    const hasInterests = items.some(item => item.kind === 'interest');
    
    // Add drill-down actions for top 2 items, excluding values and interests
    // Values and interests get aggregated into group actions for cleaner UX
    const topItems = items.filter(item => 
      item.kind !== 'value' && item.kind !== 'interest'
    ).slice(0, 2);
    for (const item of topItems) {
      // Build display name based on type
      // Professional note: We check for type-specific display fields before falling back to ID
      // Values and interests are filtered out above and handled as aggregated actions
      let displayName = '';
      if ('title' in item && item.title) {
        // For blogs, prefer short_name over full title for concise display in quick actions
        const blog = item as BlogT;
        if ('short_name' in item && blog.short_name) {
          displayName = blog.short_name;
        } else {
          displayName = item.title;
        }
      } else if (item.kind === 'bio') {
        // Professional comment: Bio items show full legal name in 'name' field
        // Use friendly label "Mike's Profile" instead for quick actions
        displayName = "Mike's Profile";
      } else if ('name' in item && item.name) {
        displayName = item.name;
      } else if ('role' in item && item.role) {
        // For experiences, use short label: "Company (Role Type)" with alias support
        if ('company' in item && item.company) {
          const exp = item as ExperienceT;
          displayName = getShortExperienceLabel(exp.company, exp.role, exp.aliases);
        } else {
          displayName = item.role;
        }
      } else {
        // Fallback to ID if no display field is available
        displayName = item.id;
      }

      actions.push({
        type: 'query',
        label: `See ${displayName}`,
        priority: 9,
        getData: () => ({
          // Professional comment: Use display name in query to match what Iris sees in context
          // This prevents confusion when query says "proj_portfolio" but context shows "Portfolio & Iris"
          query: `tell me about ${displayName}`,
          intent: 'specific_item',
          filters: { title_match: item.id }
        })
      });
    }

    // Add aggregated actions for profile attributes
    if (hasValues) {
      actions.push({
        type: 'query',
        label: "See Mike's values",
        priority: 8,
        getData: () => ({
          query: "what are Mike's core values?",
          intent: 'filter_query',
          filters: { type: ['value'], show_all: true }
        })
      });
    }

    if (hasInterests) {
      actions.push({
        type: 'query',
        label: "See Mike's interests",
        priority: 8,
        getData: () => ({
          query: "what are Mike's interests?",
          intent: 'filter_query',
          filters: { type: ['interest'], show_all: true }
        })
      });
    }

    // Add social links
    actions.push({
      type: 'link',
      label: 'GitHub',
      priority: 7,
      getData: () => ({
        link: 'https://github.com/mikedouzinas',
        linkType: 'github'
      })
    });
    actions.push({
      type: 'link',
      label: 'LinkedIn',
      priority: 7,
      getData: () => ({
        link: 'https://linkedin.com/in/mikedouzinas',
        linkType: 'linkedin'
      })
    });

    return actions;
  }

  return [];
}
