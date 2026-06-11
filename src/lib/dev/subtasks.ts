/**
 * Subtasks live as a GitHub markdown task list inside the issue body
 * (`- [ ]` / `- [x]`). Parsing/editing here keeps the board and Cere on the
 * same representation, so AI- and hand-edited checklists stay interchangeable.
 */
export interface Subtask {
  text: string;
  done: boolean;
  /** 0-based position among checklist lines, in document order. */
  index: number;
}

const LINE_RE = /^(\s*)[-*]\s+\[([ xX])\]\s+(.*)$/;

export function parseSubtasks(body: string): Subtask[] {
  const out: Subtask[] = [];
  let index = 0;
  for (const line of body.split('\n')) {
    const m = line.match(LINE_RE);
    if (m) out.push({ text: m[3].trim(), done: m[2] !== ' ', index: index++ });
  }
  return out;
}

export function subtaskProgress(body: string): { done: number; total: number } {
  const subs = parseSubtasks(body);
  return { done: subs.filter((s) => s.done).length, total: subs.length };
}

/**
 * The body with its checklist lines removed — prose only. Subtasks render in a
 * dedicated checklist UI, so the description block must not repeat them. Collapses
 * the blank lines left behind so the prose reads cleanly.
 */
export function stripSubtasks(body: string): string {
  return body
    .split('\n')
    .filter((line) => !LINE_RE.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** A subtask draft while editing — text + checked state, no document position. */
export interface DraftSubtask {
  text: string;
  done: boolean;
}

/**
 * Reassemble a body from edited prose + checklist drafts. Prose sits above the
 * checklist (matching addSubtask). Empty subtasks are dropped. This is the
 * inverse of stripSubtasks + parseSubtasks used by the card's edit mode.
 */
export function composeBody(prose: string, subs: DraftSubtask[]): string {
  const checklist = subs
    .filter((s) => s.text.trim())
    .map((s) => `- [${s.done ? 'x' : ' '}] ${s.text.trim()}`);
  const clean = prose.trim();
  if (!checklist.length) return clean;
  return clean ? `${clean}\n\n${checklist.join('\n')}` : checklist.join('\n');
}

/** Mark every checklist item complete — used when a ticket is marked Done. */
export function checkAllSubtasks(body: string): string {
  return body
    .split('\n')
    .map((line) => {
      const m = line.match(LINE_RE);
      return m ? `${m[1]}- [x] ${m[3]}` : line;
    })
    .join('\n');
}

/** Toggle the nth checklist item (by document order) and return the new body. */
export function toggleSubtask(body: string, index: number, done: boolean): string {
  let i = 0;
  return body
    .split('\n')
    .map((line) => {
      const m = line.match(LINE_RE);
      if (!m) return line;
      if (i++ !== index) return line;
      return `${m[1]}- [${done ? 'x' : ' '}] ${m[3]}`;
    })
    .join('\n');
}

/** Append a new unchecked subtask, grouped with any existing checklist. */
export function addSubtask(body: string, text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return body;
  const line = `- [ ] ${trimmed}`;
  const lines = body.split('\n');
  let lastIdx = -1;
  for (let i = 0; i < lines.length; i++) if (LINE_RE.test(lines[i])) lastIdx = i;
  if (lastIdx === -1) {
    // No checklist yet — start one, keeping a blank line after any prose.
    return body.trim() ? `${body.trimEnd()}\n\n${line}` : line;
  }
  lines.splice(lastIdx + 1, 0, line);
  return lines.join('\n');
}
