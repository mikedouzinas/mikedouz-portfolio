/**
 * Builds the "Copy for Claude Code" clipboard prompt for a ticket. With a
 * `focusSubtask`, it scopes the agent to that one checklist item while still
 * handing over the whole ticket (body + full checklist) for context.
 */
import type { DevIssue } from './github';

export function buildClaudePrompt(issue: DevIssue, focusSubtask?: string): string {
  const repoName = issue.repo.split('/')[1] ?? issue.repo;
  const lines: string[] = [
    `Work on this task in the ${repoName} repo.`,
    '',
    `Repo: ${issue.repo}`,
    `GitHub: https://github.com/${issue.repo}`,
    `Issue: #${issue.number} — ${issue.url}`,
    `Clone: gh repo clone ${issue.repo}   (or: git clone https://github.com/${issue.repo}.git)`,
    `Likely local path: ~/Downloads/Dev/${repoName}`,
    `Priority: ${issue.priority ?? 'p3'} · Status: ${issue.status ?? 'todo'} · Size: ${issue.size ?? 'M'}`,
    '',
    issue.title,
  ];
  // The body already carries the `- [ ]` checklist, so no need to re-list it.
  if (issue.body.trim()) {
    lines.push('', issue.body.trim());
  }
  if (focusSubtask) {
    lines.push(
      '',
      `Focus on this subtask in particular: "${focusSubtask}". The checklist above is the full set of subtasks, shown for context — only work this one unless another is genuinely required to finish it.`,
    );
  } else {
    lines.push('', `When complete, close issue #${issue.number}.`);
  }
  return lines.join('\n');
}
