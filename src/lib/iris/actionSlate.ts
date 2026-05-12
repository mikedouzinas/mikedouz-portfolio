/**
 * Quick Action Slate — precomputed candidate actions Iris picks from.
 *
 * Built once per request from the KB + contact info. Iris sees a compact view
 * via the system prompt and selects 0-N ids via the `select_quick_actions`
 * tool. Server resolves picked ids back to QuickAction objects, so Iris
 * cannot invent URLs or reference unknown items.
 */

import type { QuickAction } from '@/components/iris/QuickActions';
import type { KBItem, ProjectT, ExperienceT, BlogT } from './schema';
import type { Rankings } from './rankings';

export type SlateItem =
  | {
      id: string;
      type: 'link';
      label: string;
      preview: string; // shown to Iris in the slate JSON
      // payload
      link: string;
      linkType: NonNullable<QuickAction['linkType']>;
    }
  | {
      id: string;
      type: 'drill_down';
      label: string;
      preview: string;
      // payload
      targetId: string;
      targetTitle: string;
    };

function shortItemName(item: KBItem): string {
  if ('short_name' in item && typeof (item as { short_name?: string }).short_name === 'string') {
    const s = (item as { short_name: string }).short_name;
    if (s) return s;
  }
  if ('title' in item && typeof (item as { title?: string }).title === 'string') {
    return (item as { title: string }).title;
  }
  if ('role' in item && 'company' in item) {
    const e = item as ExperienceT;
    return `${e.role} @ ${e.company}`;
  }
  return item.id;
}

function quoteIfNeeded(label: string): string {
  // Wrap titles in single quotes for "Read 'X'" labels
  if (label.length > 28) return label.slice(0, 26) + '…';
  return label;
}

export function buildActionSlate(
  items: KBItem[],
  contact: Record<string, unknown>,
  rankings: Rankings
): SlateItem[] {
  const slate: SlateItem[] = [];
  const seenLinks = new Set<string>();

  type LinkType = NonNullable<QuickAction['linkType']>;
  function pushLink(args: { id: string; label: string; link: string; linkType: LinkType; preview?: string }) {
    const norm = args.link.trim().toLowerCase().replace(/\/+$/, '');
    if (seenLinks.has(norm)) return;
    seenLinks.add(norm);
    slate.push({
      id: args.id,
      type: 'link',
      label: args.label,
      link: args.link,
      linkType: args.linkType,
      preview: args.preview ?? args.link,
    });
  }

  // ── Standard contact + site links ──
  if (typeof contact.linkedin === 'string' && contact.linkedin) {
    pushLink({
      id: 'link_linkedin_mike',
      label: 'Mike on LinkedIn',
      link: contact.linkedin,
      linkType: 'linkedin',
    });
  }
  if (typeof contact.github === 'string' && contact.github) {
    pushLink({
      id: 'link_github_mike',
      label: 'Mike on GitHub',
      link: contact.github,
      linkType: 'github',
    });
  }
  if (typeof contact.email === 'string' && contact.email) {
    pushLink({
      id: 'link_email_mike',
      label: 'Email Mike',
      link: `mailto:${contact.email}`,
      linkType: 'email',
      preview: contact.email,
    });
  }
  if (typeof contact.booking === 'string' && contact.booking) {
    pushLink({
      id: 'link_booking',
      label: 'Book time',
      link: contact.booking,
      linkType: 'external',
    });
  }

  // ── Blog index (always present even if KB blog_0 missing) ──
  pushLink({
    id: 'link_blog_index',
    label: 'Read the blog',
    link: '/the-web',
    linkType: 'blog',
    preview: 'blog index (the web)',
  });

  // ── Per-item links from KB ──
  for (const item of items) {
    const shortName = shortItemName(item);

    // Blog posts
    if (item.kind === 'blog') {
      const b = item as BlogT;
      if (!b.url) continue;
      // Blog index already added above
      if (b.url === '/the-web') continue;
      const isInternal = b.url.startsWith('/');
      pushLink({
        id: `link_${item.id}`,
        label: `Read '${quoteIfNeeded(shortName)}'`,
        link: b.url,
        linkType: isInternal ? 'blog' : 'external',
        preview: `blog post: ${shortName}`,
      });
      continue;
    }

    // Project links: github, demo, company
    if (item.kind === 'project') {
      const p = item as ProjectT;
      const links = (p.links || {}) as Record<string, string>;
      if (links.github) {
        pushLink({
          id: `link_${item.id}_github`,
          label: `${quoteIfNeeded(shortName)} on GitHub`,
          link: links.github,
          linkType: 'github',
          preview: `${shortName} repo`,
        });
      }
      if (links.demo) {
        pushLink({
          id: `link_${item.id}_demo`,
          label: `${quoteIfNeeded(shortName)} demo`,
          link: links.demo,
          linkType: 'demo',
          preview: `${shortName} live demo`,
        });
      }
      if (links.company) {
        pushLink({
          id: `link_${item.id}_company`,
          label: `Visit ${quoteIfNeeded(shortName)}`,
          link: links.company,
          linkType: 'company',
          preview: `${shortName} website`,
        });
      }
      if (links.url && !links.github && !links.demo && !links.company) {
        pushLink({
          id: `link_${item.id}_url`,
          label: `Visit ${quoteIfNeeded(shortName)}`,
          link: links.url,
          linkType: 'external',
          preview: shortName,
        });
      }
      continue;
    }

    // Experience links: linkedin, company
    if (item.kind === 'experience') {
      const e = item as ExperienceT;
      const links = (e.links || {}) as Record<string, string>;
      const display = quoteIfNeeded(e.company);
      if (links.linkedin) {
        pushLink({
          id: `link_${item.id}_linkedin`,
          label: `${display} on LinkedIn`,
          link: links.linkedin,
          linkType: 'linkedin',
          preview: `${e.company} company LinkedIn`,
        });
      }
      if (links.company) {
        pushLink({
          id: `link_${item.id}_company`,
          label: `Visit ${display}`,
          link: links.company,
          linkType: 'company',
          preview: `${e.company} website`,
        });
      }
      continue;
    }
  }

  // ── Drill-downs: top-ranked items the user can dig into ──
  const importance = new Map(rankings.all.map(r => [r.id, r.importance]));
  const drillCandidates = items
    .filter(it => ['project', 'experience', 'class', 'blog'].includes(it.kind))
    .map(it => ({ item: it, score: importance.get(it.id) ?? 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
  for (const { item } of drillCandidates) {
    const name = shortItemName(item);
    slate.push({
      id: `drill_${item.id}`,
      type: 'drill_down',
      label: `More on ${quoteIfNeeded(name)}`,
      targetId: item.id,
      targetTitle: name,
      preview: `${item.kind}: ${name}`,
    });
  }

  return slate;
}

/**
 * Format the slate for inclusion in the system prompt.
 * Compact JSON-lines, capped for token budget.
 */
export function formatSlateForPrompt(slate: SlateItem[]): string {
  const lines = slate.map(s => {
    if (s.type === 'link') {
      return JSON.stringify({ id: s.id, type: 'link', label: s.label, preview: s.preview });
    }
    return JSON.stringify({ id: s.id, type: 'drill_down', label: s.label, preview: s.preview });
  });
  return lines.join('\n');
}

/**
 * Safety net: scan the assistant's text for URL/path mentions of any slate link.
 * Returns slate ids that should be force-added even if Iris didn't pick them.
 * This catches cases where Iris violates the "no URLs in text" rule.
 */
export function inferSlateIdsFromText(
  text: string,
  slate: SlateItem[],
  alreadyPicked: Set<string>,
  matchedItemIds: string[] = []
): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const inferred: string[] = [];

  // Strict URL/path matches (full host or path)
  for (const item of slate) {
    if (item.type !== 'link') continue;
    if (alreadyPicked.has(item.id)) continue;
    const link = item.link;
    if (!link) continue;
    // Match site-relative paths exactly
    if (link.startsWith('/')) {
      // Look for the exact path token surrounded by word boundaries
      const re = new RegExp(`(^|[\\s\\(\\[\`'"<])${link.replace(/[/.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[\\s\\)\\]\`'"<,.;!?])`, 'i');
      if (re.test(text)) inferred.push(item.id);
      continue;
    }
    // Match http(s) URLs by their host+path (ignore trailing slash, case-insensitive)
    const norm = link.replace(/^mailto:/, '').replace(/^https?:\/\//, '').toLowerCase().replace(/\/+$/, '');
    if (norm.length >= 6 && lower.includes(norm)) {
      inferred.push(item.id);
    }
  }

  // If the text natural-language references the blog and the response is "about" the blog,
  // surface the blog index even when Iris didn't paste the path.
  if (!alreadyPicked.has('link_blog_index') && !inferred.includes('link_blog_index')) {
    const hasBlogIndexInSlate = slate.some(s => s.id === 'link_blog_index');
    if (hasBlogIndexInSlate) {
      const blogPhrase = /(the\s+web\s+(blog|is\s+(mike|his|the)))|(\bhis\s+blog\b)|(\bthe\s+blog\b)|(\bhis\s+writing\b)|(\bhis\s+posts?\b)/i;
      const blogIdMatched = matchedItemIds.some(id => id.startsWith('blog_'));
      if (blogPhrase.test(text) && blogIdMatched) {
        inferred.push('link_blog_index');
      }
    }
  }

  return inferred;
}

/**
 * Resolve picked ids back into QuickAction[].
 * Applies caps + dedup.
 */
export function resolveSlateSelections(
  pickedIds: string[],
  slate: SlateItem[],
  opts: { maxTotal?: number; maxPerLinkType?: number } = {}
): QuickAction[] {
  const maxTotal = opts.maxTotal ?? 4;
  const maxPerLinkType = opts.maxPerLinkType ?? 2;
  const byId = new Map(slate.map(s => [s.id, s]));
  const seenIds = new Set<string>();
  const linkTypeCount: Record<string, number> = {};
  const result: QuickAction[] = [];

  for (const rawId of pickedIds) {
    if (result.length >= maxTotal) break;
    const id = String(rawId).trim();
    if (seenIds.has(id)) continue;
    const item = byId.get(id);
    if (!item) continue;
    seenIds.add(id);

    if (item.type === 'link') {
      const count = linkTypeCount[item.linkType] || 0;
      if (count >= maxPerLinkType) continue;
      linkTypeCount[item.linkType] = count + 1;
      result.push({
        type: 'contact_link',
        label: item.label,
        link: item.link,
        linkType: item.linkType,
      });
    } else if (item.type === 'drill_down') {
      result.push({
        type: 'specific',
        label: item.label,
        query: `We were just discussing ${item.targetTitle}. Now tell me more about ${item.targetTitle} — describe what it is, what Mike did with it, the technical details, and the impact or results.`,
        intent: 'specific_item',
        filters: { title_match: item.targetId },
      });
    }
  }
  return result;
}
