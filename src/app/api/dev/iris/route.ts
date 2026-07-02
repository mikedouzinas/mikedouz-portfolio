import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { listRepos, listBoardIssues } from '@/lib/dev/github';
import { getHiddenRepos } from '@/lib/dev/hidden';
import {
  CREATE_ISSUE_TOOL,
  UPDATE_ISSUE_TOOL,
  UPDATE_CONTEXT_TOOL,
  SCAN_REPO_TODOS_TOOL,
  CERE_MODEL,
  buildCereSystem,
  parseActions,
  resolveActionRepos,
  reconcileReply,
} from '@/lib/dev/cere';
import { getCereConfig, mergedAliases } from '@/lib/dev/cereConfig';
import { scanRepoTodos } from '@/lib/dev/github';

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

    const aliases = mergedAliases(config);
    const slugSet = new Set(repos.map((r) => r.slug));
    const nameMap = new Map(repos.map((r) => [r.name.toLowerCase(), r.slug]));
    const resolveSlug = (raw: string): string | null => {
      if (slugSet.has(raw)) return raw;
      const hit = nameMap.get(raw.toLowerCase()) ?? aliases[raw.toLowerCase()];
      return hit && slugSet.has(hit) ? hit : null;
    };

    const request = (messages: Anthropic.MessageParam[]) =>
      anthropic.messages.create({
        model: CERE_MODEL,
        max_tokens: 2500,
        system: [
          {
            type: 'text',
            text: buildCereSystem(repos, issues, config),
            cache_control: { type: 'ephemeral' },
          },
        ],
        tools: [CREATE_ISSUE_TOOL, UPDATE_ISSUE_TOOL, UPDATE_CONTEXT_TOOL, SCAN_REPO_TODOS_TOOL],
        messages,
      });

    const convo: Anthropic.MessageParam[] = [
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user' as const, content: message },
    ];
    let res = await request(convo);

    // Scan loop (#15): scan_repo_todos is the one tool the server executes
    // directly — run it, feed the results back, and let Cere turn them into
    // proposals. Proposal tool calls emitted alongside a scan are kept (and
    // acknowledged so the model doesn't re-emit them). Bounded to 2 rounds.
    const allContent: Anthropic.ContentBlock[] = [];
    for (let round = 0; round < 2; round++) {
      const toolUses = res.content.filter((b) => b.type === 'tool_use');
      if (!toolUses.some((b) => b.name === 'scan_repo_todos')) break;
      allContent.push(...res.content);
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const call of toolUses) {
        if (call.name === 'scan_repo_todos') {
          const raw = (call.input as { repo?: string })?.repo ?? '';
          const slug = resolveSlug(raw);
          const payload = slug
            ? { repo: slug, todos: await scanRepoTodos(slug) }
            : { error: `Unknown repo "${raw}" — it's not on the board.` };
          results.push({ type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(payload) });
        } else {
          results.push({
            type: 'tool_result',
            tool_use_id: call.id,
            content: 'Recorded as a proposal for Mike to confirm — do not re-emit it.',
          });
        }
      }
      convo.push({ role: 'assistant', content: res.content });
      convo.push({ role: 'user', content: results });
      res = await request(convo);
    }
    allContent.push(...res.content);

    const parsedOut = parseActions(allContent, issues, config.notes);
    const resolved = resolveActionRepos(parsedOut.actions, repos, aliases);

    // The reply is the FINAL turn's prose (intermediate "let me scan…" text
    // would just be noise); fall back to the combined text if it's empty.
    const finalText = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    const reply = finalText || parsedOut.reply;

    // A tool call was emitted but dropped if the model produced any create/update
    // tool_use block yet the final, resolved action list is empty. Drives the
    // honest "couldn't apply that" wording instead of a silent "no changes".
    const toolBlocks = allContent.filter(
      (b) =>
        b.type === 'tool_use' &&
        (b.name === 'create_issue' || b.name === 'update_issue' || b.name === 'update_cere_context'),
    ).length;
    const dropped = toolBlocks > 0 && resolved.actions.length === 0;

    // Phantom-completion guard (#77/#80): if the reply claims a change but nothing
    // actionable survived, replace the misleading prose so the UI never shows a
    // "done" without a proposal card.
    const guarded = reconcileReply(reply, resolved.actions.length, dropped);

    return NextResponse.json({
      reply: guarded.reply,
      actions: resolved.actions,
      warnings: [...parsedOut.warnings, ...resolved.warnings, ...guarded.warnings],
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
