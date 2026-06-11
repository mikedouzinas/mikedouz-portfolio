/**
 * Persisted set of repos hidden from the dev-console board.
 * Stored in Supabase (dev_hidden_repos), accessed via the service-role client.
 */
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const TABLE = 'dev_hidden_repos';

export async function getHiddenRepos(): Promise<string[]> {
  const { data, error } = await getSupabaseAdmin().from(TABLE).select('repo_slug');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.repo_slug as string);
}

export async function hideRepo(slug: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from(TABLE).upsert({ repo_slug: slug });
  if (error) throw new Error(error.message);
}

export async function unhideRepo(slug: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from(TABLE).delete().eq('repo_slug', slug);
  if (error) throw new Error(error.message);
}
