/**
 * Quick Actions Generation System v2
 * Config-driven approach using actionConfig.ts and rankings
 */

import type { QuickAction } from '@/components/iris/QuickActions';
import type { KBItem } from './schema';
import type { QueryFilter } from '@/app/api/iris/answer/route';
import { getActionsForItem, getActionsForList, type ActionData } from './actionConfig';
import type { Rankings } from './rankings';

interface ActionContext {
  query: string;
  intent: string;
  filters?: QueryFilter;
  results: Array<{ score: number; doc: Partial<KBItem> }>;
  fullAnswer: string;
  allItems: KBItem[];
  rankings: Rankings;  // Rankings for sorting
  depth?: number;
  visitedNodes?: string[];  // Track visited nodes to avoid repeating suggestions
}

/**
 * Check if answer contains a contact directive
 */
function hasContactDirective(answer: string): boolean {
  return /<ui:contact\s+/.test(answer);
}

/**
 * Generate contact actions (shown when contact directive detected)
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
      type: 'contact_link',
      label: 'Email',
      link: 'mike@douzinas.com',
      linkType: 'email',
    },
  ];
}

/**
 * Convert actionConfig template + data to QuickAction
 */
function templateToAction(
  template: ReturnType<typeof getActionsForItem>[0],
  data: ActionData
): QuickAction | null {
  const label = typeof template.label === 'function'
    ? template.label({} as KBItem)  // Already computed in template.getData
    : template.label;

  switch (template.type) {
    case 'link':
      return {
        type: 'contact_link',
        label,
        link: data.link!,
        linkType: data.linkType!
      };

    case 'dropdown':
      // For now, convert dropdown to multiple specific actions
      // TODO: Implement actual dropdown UI component
      if (!data.options || data.options.length === 0) return null;

      // Take top 3 options
      const topOptions = data.options.slice(0, 3);
      return {
        type: 'specific',
        label: `${label}: ${topOptions[0].label}`,
        query: `tell me about ${topOptions[0].id}`,
        intent: 'specific_item',
        filters: { title_match: topOptions[0].id }
      };

    case 'query':
      return {
        type: 'specific',
        label,
        query: data.query!,
        intent: data.intent,
        filters: data.filters
      };

    case 'message_mike':
      return {
        type: 'message_mike',
        label
      };

    case 'custom_input':
      return {
        type: 'custom_input',
        label
      };

    default:
      return null;
  }
}

/**
 * Generate quick actions using config-driven approach
 * Preserves depth limiting and fallback logic from v1
 */
export function generateQuickActions(context: ActionContext): QuickAction[] {
  const actions: QuickAction[] = [];
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { fullAnswer, intent, results, rankings, depth = 0, visitedNodes: _visitedNodes = [] } = context;

  // Handle contact directive
  if (hasContactDirective(fullAnswer)) {
    return generateContactActions();
  }

  // Depth limiting
  const canAddSpecificActions = depth < 2;  // Specific item actions only until depth 2
  const canAddGenericFollowUp = depth < 4; // Generic follow-up until depth 4

  // Determine result type (single item, list, or mixed)
  const resultTypes = new Set(results.map(r => r.doc.kind));
  const isSingleItem = results.length === 1 && intent === 'specific_item';
  const isList = results.length > 1 || intent === 'filter_query';
  const isMixed = resultTypes.size > 1;

  // Track current node visit (TODO: implement path tracking to avoid duplicate suggestions)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _currentNode: string | null = isSingleItem && results[0].doc.id
    ? results[0].doc.id
    : (isList && resultTypes.size === 1 ? `${Array.from(resultTypes)[0]}_list` : null);

  // Generate item-specific actions (only if depth < 2)
  if (canAddSpecificActions && isSingleItem && results[0].doc.id) {
    const mainItem = results[0].doc as KBItem;
    const templates = getActionsForItem(mainItem);

    // Generate actions from templates
    for (const template of templates) {
      if (!template.getData) continue;

      const data = template.getData(mainItem, rankings);
      const action = templateToAction(template, data);

      if (action) {
        actions.push(action);
      }

      // Stop at 3 item-specific actions
      if (actions.length >= 3) break;
    }
  }

  // Generate list actions (only if depth < 2)
  if (canAddSpecificActions && isList) {
    const firstType = Array.from(resultTypes)[0];
    const listType: 'project' | 'experience' | 'class' | 'skill' | 'blog' | 'mixed' =
      isMixed ? 'mixed' : (firstType as 'project' | 'experience' | 'class' | 'skill' | 'blog');
    const items = results.map(r => r.doc as KBItem);
    const templates = getActionsForList(items, listType, rankings);

    for (const template of templates) {
      if (!template.getData) continue;

      const data = template.getData(items[0], rankings);
      const action = templateToAction(template, data);

      if (action) {
        actions.push(action);
      }

      // Stop at 2 list actions
      if (actions.filter(a => a.type !== 'custom_input').length >= 2) break;
    }
  }

  // Always add generic follow-up if allowed
  if (canAddGenericFollowUp) {
    actions.push({
      type: 'custom_input',
      label: 'Ask a follow up...',
    });
  }

  // Add "Message Mike" for personal queries or when appropriate
  const shouldShowMessage =
    intent === 'personal' ||
    /contact|message|reach out/i.test(fullAnswer) ||
    (depth >= 2 && actions.length < 3);  // Show at high depth as fallback

  if (shouldShowMessage && !actions.some(a => a.type === 'message_mike')) {
    actions.push({
      type: 'message_mike',
      label: 'Message Mike',
    });
  }

  // Fallback: Ensure at least one action
  if (actions.length === 0) {
    if (depth < 4) {
      actions.push({
        type: 'custom_input',
        label: 'Ask a follow up...',
      });
    } else {
      actions.push({
        type: 'message_mike',
        label: 'Message Mike',
      });
    }
  }

  // Limit to 5 actions, but preserve follow-up if present
  if (actions.length > 5) {
    const followUpAction = actions.find(a => a.type === 'custom_input');
    if (followUpAction && canAddGenericFollowUp) {
      const otherActions = actions.filter(a => a.type !== 'custom_input').slice(0, 4);
      return [...otherActions, followUpAction];
    }
  }

  return actions.slice(0, 5);
}
