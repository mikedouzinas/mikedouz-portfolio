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
