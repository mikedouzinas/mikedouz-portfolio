/**
 * Virtual (non-code) projects + items for THE HARLEQUIN.
 * Stored in Supabase (dev_projects, dev_items), accessed via the service-role
 * client (RLS deny-by-default — only this key can read/write). The vault is a
 * SEPARATE access point that talks to the same tables directly.
 */
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export type DevItemStatus = 'todo' | 'in_progress' | 'done';
export type DevItemSize = 'S' | 'M' | 'L';

export interface DevProject {
  id: string;
  name: string;
  kind: 'virtual' | 'code';
  vaultPath: string | null;
  irisVisible: boolean;
  createdAt: string;
}

export interface DevItem {
  id: string;
  projectId: string;
  title: string;
  body: string;
  status: DevItemStatus;
  size: DevItemSize | null;
  vaultRef: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface DevProjectWithItems extends DevProject {
  items: DevItem[];
}

export const createProjectSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, 'id must be a kebab-case slug'),
  name: z.string().min(1),
  vaultPath: z.string().min(1).optional(),
  irisVisible: z.boolean().optional(),
});

export const addItemSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  body: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  size: z.enum(['S', 'M', 'L']).optional(),
  vaultRef: z.string().optional(),
});

export const updateItemStatusSchema = z.object({
  status: z.enum(['todo', 'in_progress', 'done']),
});

interface ProjectRow {
  id: string;
  name: string;
  kind: 'virtual' | 'code';
  vault_path: string | null;
  iris_visible: boolean;
  created_at: string;
}
interface ItemRow {
  id: string;
  project_id: string;
  title: string;
  body: string;
  status: DevItemStatus;
  size: DevItemSize | null;
  vault_ref: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

function toProject(r: ProjectRow): DevProject {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    vaultPath: r.vault_path,
    irisVisible: r.iris_visible,
    createdAt: r.created_at,
  };
}
function toItem(r: ItemRow): DevItem {
  return {
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    body: r.body,
    status: r.status,
    size: r.size,
    vaultRef: r.vault_ref,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    closedAt: r.closed_at,
  };
}

export async function listProjectsWithItems(): Promise<DevProjectWithItems[]> {
  const db = getSupabaseAdmin();
  const { data: projects, error: pErr } = await db
    .from('dev_projects')
    .select('*')
    .order('created_at', { ascending: true });
  if (pErr) throw new Error(pErr.message);

  const { data: items, error: iErr } = await db
    .from('dev_items')
    .select('*')
    .order('created_at', { ascending: true });
  if (iErr) throw new Error(iErr.message);

  const byProject = new Map<string, DevItem[]>();
  for (const row of (items ?? []) as ItemRow[]) {
    const it = toItem(row);
    const arr = byProject.get(it.projectId) ?? [];
    arr.push(it);
    byProject.set(it.projectId, arr);
  }
  return ((projects ?? []) as ProjectRow[]).map((p) => ({
    ...toProject(p),
    items: byProject.get(p.id) ?? [],
  }));
}

export async function createProject(
  input: z.infer<typeof createProjectSchema>,
): Promise<DevProject> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('dev_projects')
    .insert({
      id: input.id,
      name: input.name,
      kind: 'virtual',
      vault_path: input.vaultPath ?? null,
      iris_visible: input.irisVisible ?? false,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return toProject(data as ProjectRow);
}

export async function addItem(
  input: z.infer<typeof addItemSchema>,
): Promise<DevItem> {
  const db = getSupabaseAdmin();
  const status = input.status ?? 'todo';
  const { data, error } = await db
    .from('dev_items')
    .insert({
      project_id: input.projectId,
      title: input.title,
      body: input.body ?? '',
      status,
      size: input.size ?? null,
      vault_ref: input.vaultRef ?? null,
      closed_at: status === 'done' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return toItem(data as ItemRow);
}

export async function getItemsForProject(projectId: string): Promise<DevItem[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('dev_items')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ItemRow[]).map(toItem);
}

export async function updateItemStatus(
  id: string,
  status: DevItemStatus,
): Promise<DevItem> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('dev_items')
    .update({
      status,
      updated_at: new Date().toISOString(),
      closed_at: status === 'done' ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return toItem(data as ItemRow);
}

export async function deleteProject(id: string): Promise<void> {
  const db = getSupabaseAdmin();
  // dev_items cascade-delete via FK.
  const { error } = await db.from('dev_projects').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
