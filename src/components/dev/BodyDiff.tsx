'use client';

/**
 * BodyDiff — a compact, readable line-level before/after diff for a ticket's
 * description/checklist. Used in Cere's proposed-actions preview so description
 * and subtask edits are transparent before they're applied.
 *
 * Line-based LCS: unchanged lines render dimmed, removed lines red with `-`,
 * added lines green with `+`. Checklist lines (`- [ ]`) read naturally since the
 * whole line is shown.
 */

type DiffRow = { type: 'same' | 'add' | 'del'; text: string };

/** Longest-common-subsequence line diff. Small bodies, so O(n·m) is fine. */
function diffLines(before: string, after: string): DiffRow[] {
  const a = before.replace(/\r\n/g, '\n').split('\n');
  const b = after.replace(/\r\n/g, '\n').split('\n');
  const n = a.length;
  const m = b.length;

  // LCS length table.
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ type: 'same', text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      rows.push({ type: 'del', text: a[i] });
      i++;
    } else {
      rows.push({ type: 'add', text: b[j] });
      j++;
    }
  }
  while (i < n) rows.push({ type: 'del', text: a[i++] });
  while (j < m) rows.push({ type: 'add', text: b[j++] });
  return rows;
}

const ROW_STYLE: Record<DiffRow['type'], string> = {
  same: 'text-white/35',
  add: 'bg-emerald-500/10 text-emerald-200/90',
  del: 'bg-red-500/10 text-red-300/80 line-through decoration-red-400/40',
};

const SIGIL: Record<DiffRow['type'], string> = { same: ' ', add: '+', del: '-' };

export function BodyDiff({ before, after }: { before: string; after: string }) {
  const rows = diffLines(before ?? '', after ?? '');
  const added = rows.filter((r) => r.type === 'add').length;
  const removed = rows.filter((r) => r.type === 'del').length;

  return (
    <div className="mt-2 rounded-md border border-white/10 bg-black/30 p-2">
      <div className="mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-white/40">
        <span>Description</span>
        {added > 0 && <span className="text-emerald-300/80">+{added}</span>}
        {removed > 0 && <span className="text-red-300/70">−{removed}</span>}
      </div>
      <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-snug">
        {rows.map((r, idx) => (
          <div key={idx} className={`flex gap-1.5 rounded px-1 ${ROW_STYLE[r.type]}`}>
            <span className="select-none opacity-50">{SIGIL[r.type]}</span>
            <span className="min-w-0 flex-1">{r.text || ' '}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}
