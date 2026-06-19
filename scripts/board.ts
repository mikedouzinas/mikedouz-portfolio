/**
 * board.ts — THE HARLEQUIN board CLI for Claude Code agents.
 *
 * The board IS GitHub Issues (label conventions: priority p1–p5, `status: todo`/
 * `status: in progress`, `size: S|M|L`, subtasks as a `- [ ]` checklist in the
 * body; Done = a closed issue). This wraps the SAME server library the website
 * and Cere use (src/lib/dev/github.ts + subtasks.ts), so anything filed here is
 * indistinguishable from a ticket filed in the UI.
 *
 * Usage (via `npm run board -- <cmd>` or `npx tsx scripts/board.ts <cmd>`):
 *   list   [--repo <slug>] [--state open|closed|all] [--json]
 *   file   --repo <slug> --title "..." [--priority p3] [--status todo]
 *          [--size M] [--body "..."] [--subtask "..."]...   (repeat --subtask)
 *   update --repo <slug> --number N [--title] [--body] [--priority]
 *          [--status] [--size] [--add-subtask "..."]...
 *   done   --repo <slug> --number N --yes      (closes + checks the whole list)
 *
 * POLICY: file / update / triage freely. CLOSING a ticket (`done`) is gated —
 * it refuses without --yes, and agents must get Mike's explicit OK first.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import {
  listRepos,
  listIssues,
  listBoardIssues,
  createIssue,
  updateIssue,
  isOwnedRepo,
  upsertReviewBlock,
  previewUrlForBranch,
  type DevIssue,
  type Priority,
  type Status,
  type Size,
} from '../src/lib/dev/github';
import {
  addSubtask,
  checkAllSubtasks,
  composeBody,
  subtaskProgress,
} from '../src/lib/dev/subtasks';

type Flags = Record<string, string | boolean | string[]>;

/** Parse `--key value`, repeated keys collect into arrays, bare `--flag` = true. */
function parseArgs(argv: string[]): { cmd: string; flags: Flags } {
  const [cmd = 'help', ...rest] = argv;
  const flags: Flags = {};
  for (let i = 0; i < rest.length; i++) {
    const tok = rest[i];
    if (!tok.startsWith('--')) continue;
    const key = tok.slice(2);
    const next = rest[i + 1];
    if (next === undefined || next.startsWith('--')) {
      flags[key] = true;
    } else {
      const prev = flags[key];
      if (Array.isArray(prev)) prev.push(next);
      else if (typeof prev === 'string') flags[key] = [prev, next];
      else flags[key] = next;
      i++;
    }
  }
  return { cmd, flags };
}

function str(flags: Flags, key: string): string | undefined {
  const v = flags[key];
  return typeof v === 'string' ? v : undefined;
}
function arr(flags: Flags, key: string): string[] {
  const v = flags[key];
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') return [v];
  return [];
}

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

async function requireRepo(flags: Flags): Promise<string> {
  const repo = str(flags, 'repo');
  if (!repo) fail('--repo <owner/name> is required.');
  if (!(await isOwnedRepo(repo!))) fail(`Repo "${repo}" is not an owned repo — refusing.`);
  return repo!;
}

function fmtIssue(i: DevIssue): string {
  const p = subtaskProgress(i.body);
  const tasks = p.total ? `  [${p.done}/${p.total}]` : '';
  const state = i.state === 'closed' ? 'DONE' : (i.status ?? 'todo');
  return `#${i.number}  (${i.priority ?? 'p3'}/${state}/${i.size ?? 'M'})  ${i.title}${tasks}`;
}

async function cmdList(flags: Flags): Promise<void> {
  const state = (str(flags, 'state') ?? 'open') as 'open' | 'closed' | 'all';
  let repos: string[];
  if (str(flags, 'repo')) {
    repos = [await requireRepo(flags)];
  } else {
    repos = (await listRepos()).map((r) => r.slug);
  }
  const issues =
    state === 'open' ? await listBoardIssues(repos) : await listIssues(repos, state);

  if (flags.json) {
    console.log(JSON.stringify(issues, null, 2));
    return;
  }

  const byRepo = new Map<string, DevIssue[]>();
  for (const i of issues) {
    const list = byRepo.get(i.repo) ?? [];
    list.push(i);
    byRepo.set(i.repo, list);
  }
  for (const [repo, list] of byRepo) {
    console.log(`\n${repo}  (${list.length})`);
    for (const i of list) console.log(`  ${fmtIssue(i)}`);
  }
  console.log(`\n${issues.length} issue(s).`);
}

async function cmdFile(flags: Flags): Promise<void> {
  const repo = await requireRepo(flags);
  const title = str(flags, 'title');
  if (!title) fail('--title is required.');
  const priority = (str(flags, 'priority') ?? 'p3') as Priority;
  const status = (str(flags, 'status') ?? 'todo') as Status;
  const size = (str(flags, 'size') ?? 'M') as Size;
  const subtasks = arr(flags, 'subtask').map((text) => ({ text, done: false }));
  const body = composeBody(str(flags, 'body') ?? '', subtasks);

  const issue = await createIssue(repo, title!, body, priority, status, size);
  console.log(`✓ filed #${issue.number} (${priority}/${status}/${size}) — ${issue.url}`);
}

async function cmdUpdate(flags: Flags): Promise<void> {
  const repo = await requireRepo(flags);
  const number = Number(str(flags, 'number'));
  if (!Number.isInteger(number) || number <= 0) fail('--number <N> is required.');

  const patch: {
    title?: string;
    body?: string;
    priority?: Priority;
    status?: Status;
    size?: Size;
  } = {};
  if (str(flags, 'title')) patch.title = str(flags, 'title');
  if (str(flags, 'priority')) patch.priority = str(flags, 'priority') as Priority;
  if (str(flags, 'status')) patch.status = str(flags, 'status') as Status;
  if (str(flags, 'size')) patch.size = str(flags, 'size') as Size;

  const adds = arr(flags, 'add-subtask');
  if (str(flags, 'body') !== undefined || adds.length) {
    // Start from the current body so --add-subtask is additive, not destructive.
    const [current] = (await listIssues([repo], 'all')).filter((i) => i.number === number);
    if (!current) fail(`#${number} not found in ${repo}.`);
    let body = str(flags, 'body') ?? current.body;
    for (const t of adds) body = addSubtask(body, t);
    patch.body = body;
  }

  if (Object.keys(patch).length === 0) fail('Nothing to update — pass at least one field.');
  await updateIssue(repo, number, patch);
  console.log(`✓ updated #${number} (${Object.keys(patch).join(', ')}).`);
}

async function cmdDone(flags: Flags): Promise<void> {
  const repo = await requireRepo(flags);
  const number = Number(str(flags, 'number'));
  if (!Number.isInteger(number) || number <= 0) fail('--number <N> is required.');
  if (!flags.yes) {
    fail(
      `Closing a ticket is gated. Get Mike's explicit OK, then re-run with --yes.\n` +
        `  npx tsx scripts/board.ts done --repo ${repo} --number ${number} --yes`,
    );
  }
  const [current] = (await listIssues([repo], 'all')).filter((i) => i.number === number);
  if (!current) fail(`#${number} not found in ${repo}.`);
  await updateIssue(repo, number, { state: 'closed', body: checkAllSubtasks(current.body) });
  console.log(`✓ #${number} marked Done (checklist completed).`);
}

async function cmdHandoff(flags: Flags): Promise<void> {
  const repo = await requireRepo(flags);
  const number = Number(str(flags, 'number'));
  if (!Number.isInteger(number) || number <= 0) fail('--number <N> is required.');
  const test = str(flags, 'test');
  if (!test) fail('--test "<what to test>" is required.');

  let preview = str(flags, 'preview');
  if (!preview && flags['auto']) {
    const branch = str(flags, 'branch');
    if (!branch) fail('--auto needs --branch <name> (or pass --preview <url>).');
    preview = previewUrlForBranch(branch!);
  }
  if (!preview) fail('Provide --preview <url> or --auto --branch <name>.');

  const [issue] = await listIssues([repo], 'all').then((all) => all.filter((i) => i.number === number));
  if (!issue) fail(`#${number} not found in ${repo}.`);
  const body = upsertReviewBlock(issue.body, { preview: preview!, test });
  await updateIssue(repo, number, { status: 'awaiting review', body });
  console.log(`✓ handoff #${number} → awaiting review\n  Preview: ${preview!}`);
}

const HELP = `THE HARLEQUIN board CLI

  npm run board -- list   [--repo <slug>] [--state open|closed|all] [--json]
  npm run board -- file   --repo <slug> --title "..." [--priority p3] [--status todo] [--size M] [--body "..."] [--subtask "..."]...
  npm run board -- update --repo <slug> --number N [--title] [--body] [--priority] [--status] [--size] [--add-subtask "..."]...
  npm run board -- done    --repo <slug> --number N --yes
  npm run board -- handoff --repo <slug> --number N (--preview <url> | --auto --branch <name>) --test "<what to test>"

Conventions: priority p1–p5 · status todo|"in progress" · size S|M|L · subtasks "- [ ]" in the body · Done = closed.
Policy: file/update freely; closing (done) needs Mike's OK + --yes.`;

async function main(): Promise<void> {
  if (!process.env.GITHUB_TOKEN) fail('GITHUB_TOKEN is not set (check .env.local).');
  const { cmd, flags } = parseArgs(process.argv.slice(2));
  switch (cmd) {
    case 'list':
      return cmdList(flags);
    case 'file':
      return cmdFile(flags);
    case 'update':
      return cmdUpdate(flags);
    case 'done':
      return cmdDone(flags);
    case 'handoff':
      return cmdHandoff(flags);
    default:
      console.log(HELP);
  }
}

main().catch((e) => fail((e as Error).message));
