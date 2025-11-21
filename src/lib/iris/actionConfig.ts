/**
 * Action configuration system for quick actions
 * Defines what actions each KB item type should have
 */

import type { KBItem, ProjectT, ExperienceT, ClassT, BlogT, SkillT, InterestT, EducationT } from './schema';
import type { Rankings } from './rankings';

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
 */
function getShortExperienceLabel(company: string, role: string): string {
  const roleType = getShortRoleType(role);

  // If company name is long, use abbreviated version
  const shortCompany = company.length > 20
    ? company.split(/[\s\-]/)[0] // Take first word
    : company;

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
  getData?: (item: KBItem, rankings: Rankings) => ActionData;
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
      label: 'Learn about skill',
      priority: 8,
      condition: (item) => 'skills' in item && (item.skills as string[]).length > 0,
      getData: (item, rankings) => {
        const project = item as ProjectT;
        const skillOptions = project.skills
          .map(skillId => {
            const ranking = rankings.skills.find(s => s.id === skillId);
            return {
              id: skillId,
              label: skillId,  // Will be resolved to display name in UI
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
      label: 'Learn about skill',
      priority: 8,
      condition: (item) => 'skills' in item && (item.skills as string[]).length > 0,
      getData: (item, rankings) => {
        const exp = item as ExperienceT;
        const skillOptions = exp.skills
          .map(skillId => {
            const ranking = rankings.skills.find(s => s.id === skillId);
            return {
              id: skillId,
              label: skillId,
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
      label: 'Learn about skill',
      priority: 8,
      condition: (item) => 'skills' in item && (item.skills as string[]).length > 0,
      getData: (item, rankings) => {
        const cls = item as ClassT;
        const skillOptions = cls.skills
          .map(skillId => {
            const ranking = rankings.skills.find(s => s.id === skillId);
            return {
              id: skillId,
              label: skillId,
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
      getData: (item, rankings) => {
        const skill = item as SkillT;
        const evidenceOptions = skill.evidence.map(e => {
          const ranking = rankings.all.find(r => r.id === e.id);
          return {
            id: e.id,
            label: `${e.type}: ${e.id}`,
            importance: ranking?.importance || 50
          };
        }).sort((a, b) => b.importance - a.importance);

        return {
          options: evidenceOptions
        };
      }
    },
    {
      type: 'query',
      label: 'Top skills often used with this',
      priority: 7,
      getData: () => {
        return {
          query: `what other skills does Mike use?`,
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
        label: `Learn more about ${displayName}`,
        priority: 10,
        getData: () => ({
          query: `tell me about ${topProject.id}`,
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

    actions.push({
      type: 'dropdown',
      label: 'Filter by skill',
      priority: 9,
      getData: (item, rankings) => {
        // Get all unique skills from projects
        const allSkills = new Set<string>();
        items.forEach(item => {
          if ('skills' in item) {
            (item.skills as string[]).forEach(s => allSkills.add(s));
          }
        });

        const skillOptions = Array.from(allSkills)
          .map(skillId => {
            const ranking = rankings.skills.find(s => s.id === skillId);
            return {
              id: skillId,
              label: skillId,
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
        // Use short label for experiences: "Company (Role Type)"
        displayName = getShortExperienceLabel(topExp.company, topExp.role);
      } else if ('role' in topExp && topExp.role) {
        displayName = topExp.role;
      } else {
        displayName = topExp.id;
      }

      actions.push({
        type: 'query',
        label: `Learn more about ${displayName}`,
        priority: 10,
        getData: () => ({
          query: `tell me about ${topExp.id}`,
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
        label: 'Learn about skill',
        priority: 9,
        getData: (item, rankings) => {
          const skillOptions = items
            .filter(i => i.kind === 'skill')
            .map(skill => {
              const ranking = rankings.skills.find(s => s.id === skill.id);
              return {
                id: skill.id,
                label: skill.id,
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

    // Add drill-down actions for top 2 items
    const topItems = items.slice(0, 2);
    for (const item of topItems) {
      // Build display name based on type
      let displayName = '';
      if ('title' in item && item.title) {
        displayName = item.title;
      } else if ('name' in item && item.name) {
        displayName = item.name;
      } else if ('role' in item && item.role) {
        // For experiences, use short label: "Company (Role Type)"
        if ('company' in item && item.company) {
          displayName = getShortExperienceLabel(item.company, item.role);
        } else {
          displayName = item.role;
        }
      } else {
        displayName = item.id;
      }

      actions.push({
        type: 'query',
        label: `Learn more about ${displayName}`,
        priority: 9,
        getData: () => ({
          query: `tell me about ${item.id}`,
          intent: 'specific_item',
          filters: { title_match: item.id }
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
