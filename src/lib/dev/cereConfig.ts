/**
 * Cere's self-maintained context (#73): standing notes she can rewrite through
 * her own propose-then-confirm flow, plus repo aliases mapping the informal
 * names Mike uses ("mikeveson.com", "The Harlequin", "The Web") to exact repo
 * slugs. Stored in Supabase (dev_cere_config), accessed via the service-role
 * client — same pattern as dev_hidden_repos.
 *
 * Expected table (single row keyed 'default'):
 *   create table dev_cere_config (
 *     id text primary key,
 *     notes text not null default '',
 *     aliases jsonb not null default '{}'::jsonb,
 *     updated_at timestamptz not null default now()
 *   );
 */
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const TABLE = 'dev_cere_config';
const ROW_ID = 'default';

export interface CereConfig {
  /** Cere-maintained prompt addendum: conventions, filing preferences, reminders. */
  notes: string;
  /** Informal name (lowercased) → exact repo slug. Merged over the built-ins. */
  aliases: Record<string, string>;
}

export const EMPTY_CERE_CONFIG: CereConfig = { notes: '', aliases: {} };

/**
 * Built-in aliases — always active, independent of the persisted config.
 * Everything Mike calls the portfolio site resolves to its repo; extend the
 * persisted config (via Cere herself) for new colloquial names.
 */
export const BUILTIN_REPO_ALIASES: Record<string, string> = {
  'mikeveson.com': 'mikedouzinas/mikedouz-portfolio',
  'the harlequin': 'mikedouzinas/mikedouz-portfolio',
  harlequin: 'mikedouzinas/mikedouz-portfolio',
  'the web': 'mikedouzinas/mikedouz-portfolio',
  'the portfolio': 'mikedouzinas/mikedouz-portfolio',
  portfolio: 'mikedouzinas/mikedouz-portfolio',
  'the board': 'mikedouzinas/mikedouz-portfolio',
  'the site': 'mikedouzinas/mikedouz-portfolio',
  apollo: 'mikedouzinas/apollo',
};

/**
 * Read the persisted config. Fails open to the empty config (missing row,
 * missing table, or Supabase outage) — Cere still works with the built-ins.
 */
export async function getCereConfig(): Promise<CereConfig> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from(TABLE)
      .select('notes, aliases')
      .eq('id', ROW_ID)
      .maybeSingle();
    if (error || !data) return EMPTY_CERE_CONFIG;
    const aliases: Record<string, string> = {};
    if (data.aliases && typeof data.aliases === 'object' && !Array.isArray(data.aliases)) {
      for (const [k, v] of Object.entries(data.aliases as Record<string, unknown>)) {
        if (typeof v === 'string') aliases[k.toLowerCase()] = v;
      }
    }
    return { notes: typeof data.notes === 'string' ? data.notes : '', aliases };
  } catch {
    return EMPTY_CERE_CONFIG;
  }
}

/** Merge a patch into the persisted config and return the result. */
export async function updateCereConfig(patch: {
  notes?: string;
  addAliases?: Record<string, string>;
}): Promise<CereConfig> {
  const current = await getCereConfig();
  const next: CereConfig = {
    notes: patch.notes !== undefined ? patch.notes : current.notes,
    aliases: { ...current.aliases },
  };
  for (const [alias, slug] of Object.entries(patch.addAliases ?? {})) {
    next.aliases[alias.toLowerCase()] = slug;
  }
  const { error } = await getSupabaseAdmin()
    .from(TABLE)
    .upsert({ id: ROW_ID, notes: next.notes, aliases: next.aliases, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  return next;
}

/** Built-ins merged with the persisted aliases (persisted wins on collision). */
export function mergedAliases(config: CereConfig): Record<string, string> {
  return { ...BUILTIN_REPO_ALIASES, ...config.aliases };
}
