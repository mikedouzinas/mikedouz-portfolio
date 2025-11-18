/**
 * Server-only Supabase admin client
 * Uses service role key to bypass Row-Level Security (RLS)
 * 
 * ⚠️  This client should NEVER be exposed to the browser
 * Only use in API routes, server components, and server actions
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';
import type { InboxMessage } from './types';

let adminClient: SupabaseClient | null = null;

/**
 * Get or create the Supabase admin client
 * Singleton pattern to avoid creating multiple clients
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;
  
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error('Supabase credentials not configured. Check environment variables.');
  }
  
  adminClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  
  return adminClient;
}

/**
 * Insert a new inbox message
 * Returns the created message ID
 */
export async function insertInboxMessage(data: {
  source: InboxMessage['source'];
  user_query?: string;
  iris_answer?: string;
  draft_message: string;
  contact_method: InboxMessage['contact_method'];
  contact_value?: string;
  user_agent?: string;
  ip_hash?: string;
}): Promise<string> {
  const supabase = getSupabaseAdmin();
  
  const { data: message, error } = await supabase
    .from('inbox_messages')
    .insert({
      source: data.source,
      user_query: data.user_query || null,
      iris_answer: data.iris_answer || null,
      draft_message: data.draft_message,
      contact_method: data.contact_method,
      contact_value: data.contact_value || null,
      user_agent: data.user_agent || null,
      ip_hash: data.ip_hash || null,
      status: 'new',
    })
    .select('id')
    .single();
  
  if (error) {
    console.error('[Supabase] Error inserting inbox message:', error);
    throw new Error(`Failed to insert inbox message: ${error.message}`);
  }
  
  return message.id;
}

/**
 * Get inbox messages (admin only)
 * Returns paginated list of messages
 */
export async function getInboxMessages(options?: {
  limit?: number;
  offset?: number;
  status?: InboxMessage['status'];
}): Promise<InboxMessage[]> {
  const supabase = getSupabaseAdmin();
  
  let query = supabase
    .from('inbox_messages')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (options?.status) {
    query = query.eq('status', options.status);
  }
  
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('[Supabase] Error fetching inbox messages:', error);
    throw new Error(`Failed to fetch inbox messages: ${error.message}`);
  }
  
  return data || [];
}

/**
 * Update inbox message status
 */
export async function updateInboxMessageStatus(
  messageId: string,
  status: InboxMessage['status']
): Promise<void> {
  const supabase = getSupabaseAdmin();
  
  const { error } = await supabase
    .from('inbox_messages')
    .update({ status })
    .eq('id', messageId);
  
  if (error) {
    console.error('[Supabase] Error updating message status:', error);
    throw new Error(`Failed to update message status: ${error.message}`);
  }
}
