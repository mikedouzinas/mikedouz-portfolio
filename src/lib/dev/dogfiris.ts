/**
 * dogfiris — THE HARLEQUIN's conversational filer.
 *
 * This module is the *planner*: it turns a plain-language message into proposed
 * ticket mutations via Claude tool-calling. It deliberately does NOT execute
 * anything — the client previews the actions and, on confirm, runs them through
 * the existing `/api/dev/issues` endpoints (which own the security boundary).
 */
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { DevIssue, DevRepo, Priority, Size, Status } from './github';

export const DOGFIRIS_MODEL = 'claude-sonnet-4-6';

const PRIORITY = z.enum(['p1', 'p2', 'p3', 'p4', 'p5']);
const STATUS = z.enum(['todo', 'in progress']);
const SIZE = z.enum(['S', 'M', 'L']);

export const CREATE_ISSUE_TOOL: Anthropic.Tool = {
  name: 'create_issue',
  description:
    'Propose filing a new ticket on the board. Call once per ticket — call it multiple times to file several from one message. Always choose a size.',
  input_schema: {
    type: 'object' as const,
    required: ['repo', 'title', 'size'],
    properties: {
      repo: { type: 'string', description: 'Exact repo slug (owner/name) from the board context.' },
      title: { type: 'string' },
      body: { type: 'string', description: 'Optional description / context.' },
      priority: { type: 'string', enum: ['p1', 'p2', 'p3', 'p4', 'p5'], description: 'Default p3.' },
      status: { type: 'string', enum: ['todo', 'in progress'], description: 'Default todo.' },
      size: {
        type: 'string',
        enum: ['S', 'M', 'L'],
        description: 'Effort estimate. S = quick (<~1h), M = a feature / half-day, L = large or conversation-heavy.',
      },
      subtasks: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional checklist steps; they become a `- [ ]` task list in the body.',
      },
    },
  },
};

export const UPDATE_ISSUE_TOOL: Anthropic.Tool = {
  name: 'update_issue',
  description:
    'Propose changing an existing ticket (identified by repo + number from the board context). Set state to "closed" to mark it Done.',
  input_schema: {
    type: 'object' as const,
    required: ['repo', 'number'],
    properties: {
      repo: { type: 'string', description: 'Exact repo slug (owner/name).' },
      number: { type: 'integer', description: 'The issue number.' },
      priority: { type: 'string', enum: ['p1', 'p2', 'p3', 'p4', 'p5'] },
      status: { type: 'string', enum: ['todo', 'in progress'] },
      size: { type: 'string', enum: ['S', 'M', 'L'] },
      state: { type: 'string', enum: ['open', 'closed'] },
    },
  },
};

const CreateInput = z.object({
  repo: z.string(),
  title: z.string().min(1),
  body: z.string().optional().default(''),
  priority: PRIORITY.optional().default('p3'),
  status: STATUS.optional().default('todo'),
  size: SIZE,
  subtasks: z.array(z.string()).optional().default([]),
});

const UpdateInput = z.object({
  repo: z.string(),
  number: z.number().int().positive(),
  priority: PRIORITY.optional(),
  status: STATUS.optional(),
  size: SIZE.optional(),
  state: z.enum(['open', 'closed']).optional(),
});

/** Normalized, client-facing proposed mutations. */
export type DogfirisAction =
  | {
      kind: 'create';
      repo: string;
      title: string;
      body: string;
      priority: Priority;
      status: Status;
      size: Size;
      subtasks: string[];
    }
  | {
      kind: 'update';
      repo: string;
      number: number;
      priority?: Priority;
      status?: Status;
      size?: Size;
      state?: 'open' | 'closed';
    };

/** System prompt: who dogfiris is + the live board context to ground its calls. */
export function buildDogfirisSystem(repos: DevRepo[], issues: DevIssue[]): string {
  const repoLines = repos.map((r) => `- ${r.slug} (${r.name})`).join('\n');
  const open = issues.filter((i) => i.state === 'open');
  const issueLines = open
    .map(
      (i) =>
        `- #${i.number} [${i.repo}] (${i.priority ?? 'p3'}/${i.status ?? 'todo'}/${i.size ?? 'M'}) ${i.title}`,
    )
    .join('\n');

  return `You are dogfiris, the filing assistant for THE HARLEQUIN — Mike's private dev board, built on GitHub Issues.

Mike talks to you in plain language and you propose ticket changes. You don't chat for its own sake: when he describes work, call create_issue to propose it (call it multiple times to file several tickets at once). When he asks to change, re-prioritize, resize, or close something, call update_issue. Always include one short plain-language sentence summarizing what you're proposing.

If the message is a genuine question or needs clarification (not a filing request), just reply in text without calling tools.

Sizing — every new ticket needs one: S = quick (<~1h), M = a feature / half-day, L = large or conversation-heavy / multi-day. Infer it from the work described.
Subtasks: if the work has clear steps, pass them as subtasks; they render as a checklist in the body.

Repos you can file to (use the EXACT slug):
${repoLines || '(none)'}

Open tickets right now (reference by repo + number to modify or close):
${issueLines || '(none)'}

When Mike doesn't name a repo, default to ${repos[0]?.slug ?? '(none)'} (his portfolio).`;
}

/** Parse Claude's response blocks into a reply + validated proposed actions. */
export function parseActions(content: Anthropic.ContentBlock[]): {
  reply: string;
  actions: DogfirisAction[];
  warnings: string[];
} {
  let reply = '';
  const actions: DogfirisAction[] = [];
  const warnings: string[] = [];

  for (const block of content) {
    if (block.type === 'text') {
      reply += block.text;
    } else if (block.type === 'tool_use' && block.name === 'create_issue') {
      const parsed = CreateInput.safeParse(block.input);
      if (!parsed.success) {
        warnings.push('Skipped a malformed new ticket.');
        continue;
      }
      const { subtasks, body, ...rest } = parsed.data;
      const checklist = subtasks.map((s) => `- [ ] ${s}`).join('\n');
      const fullBody = checklist ? (body.trim() ? `${body.trimEnd()}\n\n${checklist}` : checklist) : body;
      actions.push({ kind: 'create', ...rest, body: fullBody, subtasks });
    } else if (block.type === 'tool_use' && block.name === 'update_issue') {
      const parsed = UpdateInput.safeParse(block.input);
      if (!parsed.success) {
        warnings.push(`Skipped a malformed change.`);
        continue;
      }
      actions.push({ kind: 'update', ...parsed.data });
    }
  }

  return { reply: reply.trim(), actions, warnings };
}

/**
 * Resolve each action's `repo` to a real owned slug (Claude sometimes uses the
 * short name). Drops actions whose repo can't be matched, with a warning.
 */
export function resolveActionRepos(
  actions: DogfirisAction[],
  repos: DevRepo[],
): { actions: DogfirisAction[]; warnings: string[] } {
  const slugs = new Set(repos.map((r) => r.slug));
  const byName = new Map(repos.map((r) => [r.name.toLowerCase(), r.slug]));
  const warnings: string[] = [];
  const out: DogfirisAction[] = [];

  for (const a of actions) {
    let repo = a.repo;
    if (!slugs.has(repo)) {
      const resolved = byName.get(repo.toLowerCase());
      if (!resolved) {
        warnings.push(`Couldn't match repo "${a.repo}" — skipped that one.`);
        continue;
      }
      repo = resolved;
    }
    out.push({ ...a, repo });
  }
  return { actions: out, warnings };
}
