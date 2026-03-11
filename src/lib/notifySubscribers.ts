/**
 * Send new-post notification to all confirmed subscribers.
 * Email via Resend batch sending, SMS via Twilio.
 */

import { Resend } from 'resend';
import twilio from 'twilio';
import { env } from './env';
import { getConfirmedSubscribers } from './subscribers';
import { newPostEmail } from './emailTemplates';
import { generatePreview } from './blog';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://mikeveson.com';

let resendClient: Resend | null = null;
function getResend(): Resend {
  if (!resendClient) resendClient = new Resend(env.resendApiKey);
  return resendClient;
}

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

function buildSmsBody(post: { title: string; slug: string }): string {
  return `new on the web: "${post.title}"\n${BASE_URL}/the-web/${post.slug}\n\nreply STOP to unsubscribe`;
}

export async function notifySubscribers(post: {
  title: string;
  subtitle: string | null;
  slug: string;
  body: string;
  reading_time: number;
  tags: string[];
}): Promise<{ sent: number; errors: number }> {
  const subscribers = await getConfirmedSubscribers();

  if (subscribers.length === 0) {
    console.log('[Notify] No confirmed subscribers, skipping');
    return { sent: 0, errors: 0 };
  }

  const preview = generatePreview(post.body);
  const resend = getResend();
  const twilioClient = getTwilioClient();
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

  let sent = 0;
  let errors = 0;

  // Split by channel
  const emailSubs = subscribers.filter(s => s.channel === 'email' && s.email);
  const smsSubs = subscribers.filter(s => s.channel === 'sms' && s.phone);

  // Send emails in batches of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < emailSubs.length; i += BATCH_SIZE) {
    const batch = emailSubs.slice(i, i + BATCH_SIZE);

    const emails = batch.map((sub) => {
      const template = newPostEmail(
        { ...post, preview },
        sub.unsubscribe_token
      );
      return {
        from: 'The Web <theweb@iris.mikeveson.com>',
        to: sub.email!,
        subject: template.subject,
        html: template.html,
      };
    });

    try {
      await resend.batch.send(emails);
      sent += batch.length;
    } catch (err) {
      console.error(`[Notify] Email batch error (batch starting at ${i}):`, err);
      errors += batch.length;
    }
  }

  // Send SMS messages
  if (twilioClient && twilioFrom && smsSubs.length > 0) {
    const smsBody = buildSmsBody(post);

    const results = await Promise.allSettled(
      smsSubs.map(sub =>
        twilioClient.messages.create({
          body: smsBody,
          from: twilioFrom,
          to: sub.phone!,
        })
      )
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        sent++;
      } else {
        console.error('[Notify] SMS send error:', result.reason);
        errors++;
      }
    }
  } else if (smsSubs.length > 0) {
    console.warn('[Notify] Twilio not configured, skipping SMS notifications');
    errors += smsSubs.length;
  }

  console.log(`[Notify] Sent ${sent} notifications (${emailSubs.length} email, ${smsSubs.length} sms), ${errors} errors`);
  return { sent, errors };
}
