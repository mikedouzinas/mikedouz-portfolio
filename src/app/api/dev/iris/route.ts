import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { listRepos, listBoardIssues } from '@/lib/dev/github';
import { getHiddenRepos } from '@/lib/dev/hidden';
import {
  CREATE_ISSUE_TOOL,
  UPDATE_ISSUE_TOOL,
  UPDATE_CONTEXT_TOOL,
  CERE_MODEL,
  buildCereSystem,
  parseActions,
  resolveActionRepos,
  reconcileReply,
} from '@/lib/dev/cere';
import { getCereConfig, mergedAliases } from '@/lib/dev/cereConfig';

// Claude tool-calling can outlast Vercel's default timeout; match the other
// Iris routes. Middleware already gates /api/dev/* behind the session cookie.
export const runtime = 'nodejs';
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const Body = z.object({
  message: z.string().min(1).max(4000),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() }))
    .max(20)
    .optional()
    .default([]),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  const { message, history } = parsed.data;

  try {
    const [allRepos, hidden, config] = await Promise.all([
      listRepos(),
      getHiddenRepos(),
      getCereConfig(),
    ]);
    const hiddenSet = new Set(hidden);
    const repos = allRepos.filter((r) => !hiddenSet.has(r.slug));
    const issues = await listBoardIssues(repos.map((r) => r.slug));

    const res = await anthropic.messages.create({
      model: CERE_MODEL,
      max_tokens: 1500,
      system: [
        {
          type: 'text',
          text: buildCereSystem(repos, issues, config),
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [CREATE_ISSUE_TOOL, UPDATE_ISSUE_TOOL, UPDATE_CONTEXT_TOOL],
      messages: [
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: 'user' as const, content: message },
      ],
    });

    const parsedOut = parseActions(res.content, issues, config.notes);
    const resolved = resolveActionRepos(parsedOut.actions, repos, mergedAliases(config));

    // A tool call was emitted but dropped if the model produced any create/update
    // tool_use block yet the final, resolved action list is empty. Drives the
    // honest "couldn't apply that" wording instead of a silent "no changes".
    const toolBlocks = res.content.filter(
      (b) =>
        b.type === 'tool_use' &&
        (b.name === 'create_issue' || b.name === 'update_issue' || b.name === 'update_cere_context'),
    ).length;
    const dropped = toolBlocks > 0 && resolved.actions.length === 0;

    // Phantom-completion guard (#77/#80): if the reply claims a change but nothing
    // actionable survived, replace the misleading prose so the UI never shows a
    // "done" without a proposal card.
    const guarded = reconcileReply(parsedOut.reply, resolved.actions.length, dropped);

    return NextResponse.json({
      reply: guarded.reply,
      actions: resolved.actions,
      warnings: [...parsedOut.warnings, ...resolved.warnings, ...guarded.warnings],
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
