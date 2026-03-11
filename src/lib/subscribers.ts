/**
 * Subscriber data layer for "The Web" newsletter
 * Supports dual-channel: email and SMS subscriptions.
 * Uses admin client (service role key) to bypass RLS.
 * Only use in API routes and server actions.
 */

import { getSupabaseAdmin } from './supabaseAdmin';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Subscriber {
  id: string;
  email: string | null;
  phone: string | null;
  channel: 'email' | 'sms';
  status: 'pending' | 'confirmed' | 'unsubscribed';
  confirmation_token: string;
  confirmation_code: string | null;
  unsubscribe_token: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateConfirmationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

/**
 * Create or re-activate an email subscriber.
 * - New email: insert with status=pending
 * - Existing pending: return existing (resend confirmation)
 * - Existing confirmed: return as-is (already subscribed)
 * - Existing unsubscribed: reset to pending with new confirmation token
 */
export async function upsertEmailSubscriber(email: string): Promise<{
  subscriber: Subscriber;
  action: 'created' | 'already_pending' | 'already_confirmed' | 'resubscribed';
}> {
  const supabase = getSupabaseAdmin();
  const normalized = email.toLowerCase().trim();

  const { data: existing } = await supabase
    .from('blog_subscribers')
    .select('*')
    .eq('email', normalized)
    .eq('channel', 'email')
    .single();

  if (existing) {
    if (existing.status === 'confirmed') {
      return { subscriber: existing as Subscriber, action: 'already_confirmed' };
    }
    if (existing.status === 'pending') {
      return { subscriber: existing as Subscriber, action: 'already_pending' };
    }
    // Unsubscribed: reactivate
    const { data: updated, error } = await supabase
      .from('blog_subscribers')
      .update({
        status: 'pending',
        confirmation_token: crypto.randomUUID(),
        unsubscribed_at: null,
      })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to reactivate subscriber: ${error.message}`);
    return { subscriber: updated as Subscriber, action: 'resubscribed' };
  }

  // New subscriber
  const { data: created, error } = await supabase
    .from('blog_subscribers')
    .insert({ email: normalized, channel: 'email' })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create subscriber: ${error.message}`);
  return { subscriber: created as Subscriber, action: 'created' };
}

/**
 * Create or re-activate an SMS subscriber.
 * Phone must already be in E.164 format.
 */
export async function upsertSmsSubscriber(phone: string): Promise<{
  subscriber: Subscriber;
  action: 'created' | 'already_pending' | 'already_confirmed' | 'resubscribed';
}> {
  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from('blog_subscribers')
    .select('*')
    .eq('phone', phone)
    .eq('channel', 'sms')
    .single();

  if (existing) {
    if (existing.status === 'confirmed') {
      return { subscriber: existing as Subscriber, action: 'already_confirmed' };
    }
    if (existing.status === 'pending') {
      // Regenerate code for resend
      const code = generateConfirmationCode();
      const { data: updated, error } = await supabase
        .from('blog_subscribers')
        .update({ confirmation_code: code })
        .eq('id', existing.id)
        .select('*')
        .single();
      if (error) throw new Error(`Failed to update confirmation code: ${error.message}`);
      return { subscriber: updated as Subscriber, action: 'already_pending' };
    }
    // Unsubscribed: reactivate
    const code = generateConfirmationCode();
    const { data: updated, error } = await supabase
      .from('blog_subscribers')
      .update({
        status: 'pending',
        confirmation_code: code,
        confirmation_token: crypto.randomUUID(),
        unsubscribed_at: null,
      })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to reactivate subscriber: ${error.message}`);
    return { subscriber: updated as Subscriber, action: 'resubscribed' };
  }

  // New subscriber
  const code = generateConfirmationCode();
  const { data: created, error } = await supabase
    .from('blog_subscribers')
    .insert({ phone, channel: 'sms', confirmation_code: code })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create subscriber: ${error.message}`);
  return { subscriber: created as Subscriber, action: 'created' };
}

/**
 * Confirm an email subscriber by their confirmation token.
 * Returns null if token not found or already used.
 */
export async function confirmSubscriber(token: string): Promise<Subscriber | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('blog_subscribers')
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    })
    .eq('confirmation_token', token)
    .eq('status', 'pending')
    .select('*')
    .single();

  if (error) return null;
  return data as Subscriber;
}

/**
 * Confirm an SMS subscriber by phone + 6-digit code.
 * Returns null if code doesn't match.
 */
export async function confirmSmsSubscriber(phone: string, code: string): Promise<Subscriber | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('blog_subscribers')
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      confirmation_code: null,
    })
    .eq('phone', phone)
    .eq('channel', 'sms')
    .eq('confirmation_code', code)
    .eq('status', 'pending')
    .select('*')
    .single();

  if (error) return null;
  return data as Subscriber;
}

/**
 * Unsubscribe by unsubscribe token.
 * Returns null if token not found.
 */
export async function unsubscribeByToken(token: string): Promise<Subscriber | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('blog_subscribers')
    .update({
      status: 'unsubscribed',
      unsubscribed_at: new Date().toISOString(),
    })
    .eq('unsubscribe_token', token)
    .in('status', ['pending', 'confirmed'])
    .select('*')
    .single();

  if (error) return null;
  return data as Subscriber;
}

/**
 * Get all confirmed subscribers. Used when sending notifications.
 */
export async function getConfirmedSubscribers(): Promise<
  Pick<Subscriber, 'email' | 'phone' | 'channel' | 'unsubscribe_token'>[]
> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('blog_subscribers')
    .select('email, phone, channel, unsubscribe_token')
    .eq('status', 'confirmed');

  if (error) throw new Error(`Failed to fetch confirmed subscribers: ${error.message}`);
  return data || [];
}
