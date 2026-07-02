/**
 * Guest share links (#6): a signed-out visitor opens /dev/guest/<token> and
 * gets a read-only visitor session scoped to ONE repo's board — no password.
 *
 * Tokens are 32 random bytes (base64url) handed out once; only their SHA-256
 * lands in Supabase (dev_share_tokens), so a leaked table can't mint access.
 * Node-only (node:crypto) — used by API routes, never the edge middleware.
 *
 * Expected table:
 *   create table dev_share_tokens (
 *     id uuid primary key default gen_random_uuid(),
 *     token_hash text not null unique,
 *     repo_slug text not null,
 *     created_at timestamptz not null default now(),
 *     expires_at timestamptz not null,
 *     revoked_at timestamptz
 *   );
 */
import { createHash, randomBytes } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const TABLE = 'dev_share_tokens';
const DEFAULT_TTL_DAYS = 14;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Mint a share token for one repo. Returns the raw token — shown exactly once. */
export async function createShareToken(
  repo: string,
  ttlDays = DEFAULT_TTL_DAYS,
): Promise<{ token: string; expiresAt: string }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await getSupabaseAdmin()
    .from(TABLE)
    .insert({ token_hash: hashToken(token), repo_slug: repo, expires_at: expiresAt });
  if (error) throw new Error(error.message);
  return { token, expiresAt };
}

/** The repo a live (unexpired, unrevoked) token grants, or null. */
export async function validateShareToken(token: string): Promise<string | null> {
  if (!token || token.length > 128) return null;
  try {
    const { data, error } = await getSupabaseAdmin()
      .from(TABLE)
      .select('repo_slug, expires_at, revoked_at')
      .eq('token_hash', hashToken(token))
      .maybeSingle();
    if (error || !data) return null;
    if (data.revoked_at) return null;
    if (Date.parse(data.expires_at as string) < Date.now()) return null;
    return data.repo_slug as string;
  } catch {
    return null;
  }
}
