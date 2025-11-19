import { z } from 'zod';

/**
 * Zod schema for inbox payload validation
 * Ensures type safety across client and server
 */
export const InboxPayload = z.object({
  source: z.enum(['iris-explicit', 'iris-suggested', 'auto-insufficient']),
  userQuery: z.string().optional(),
  irisAnswer: z.string().max(20000).optional(),
  message: z.string().min(3).max(500),
  contact: z.discriminatedUnion('method', [
    z.object({ method: z.literal('email'), value: z.string().email() }),
    z.object({ method: z.literal('phone'), value: z.string().min(7).max(20) }),
    z.object({ method: z.literal('anon') }),
  ]),
  nonce: z.string().min(8),
  honeypot: z.string().optional(),
});

/**
 * TypeScript type inferred from Zod schema
 */
export type InboxPayload = z.infer<typeof InboxPayload>;

/**
 * Inbox message record structure
 * Matches Supabase table schema
 */
export interface InboxMessage {
  id: string;
  created_at: string;
  source: 'iris-explicit' | 'iris-suggested' | 'auto-insufficient';
  user_query?: string;
  iris_answer?: string;
  draft_message: string;
  contact_method: 'email' | 'phone' | 'anon';
  contact_value?: string;
  user_agent?: string;
  ip_hash?: string;
  status: 'new' | 'read' | 'replied';
}

/**
 * UI directive types for Iris streaming
 */
export type ContactReason = 'insufficient_context' | 'more_detail' | 'user_request';
export type ContactOpenBehavior = 'auto' | 'cta';

export interface ContactDirective {
  type: 'contact';
  reason: ContactReason;
  draft?: string;
  open?: ContactOpenBehavior;
}
