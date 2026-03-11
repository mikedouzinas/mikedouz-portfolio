import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Resend } from 'resend';
import twilio from 'twilio';
import { env } from '@/lib/env';
import { upsertEmailSubscriber, upsertSmsSubscriber } from '@/lib/subscribers';
import { confirmationEmail } from '@/lib/emailTemplates';
import { validateAndFormatPhone } from '@/lib/phone';

export const runtime = 'nodejs';

const SubscribeSchema = z.object({
  contact: z.string().min(1).max(320),
});

const ConfirmSmsSchema = z.object({
  phone: z.string().min(1),
  code: z.string().length(6),
});

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

/**
 * Detect whether input is email or phone.
 * Returns { type: 'email', value } or { type: 'phone', value } (E.164) or null.
 */
async function detectChannel(input: string): Promise<
  { type: 'email'; value: string } | { type: 'phone'; value: string } | null
> {
  const trimmed = input.trim();

  // Email: contains @
  if (trimmed.includes('@')) {
    // Basic email validation
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return { type: 'email', value: trimmed.toLowerCase() };
    }
    return null;
  }

  // Phone: strip non-digits (except +), check if 10+ digits
  const digitsOnly = trimmed.replace(/[^\d]/g, '');
  if (digitsOnly.length >= 10) {
    const formatted = await validateAndFormatPhone(trimmed, 'US');
    if (formatted) {
      return { type: 'phone', value: formatted };
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Check if this is an SMS confirmation request
    const smsConfirm = ConfirmSmsSchema.safeParse(body);
    if (smsConfirm.success) {
      const { confirmSmsSubscriber } = await import('@/lib/subscribers');
      const formatted = await validateAndFormatPhone(smsConfirm.data.phone, 'US');
      if (!formatted) {
        return NextResponse.json({ error: 'invalid phone number' }, { status: 400 });
      }
      const subscriber = await confirmSmsSubscriber(formatted, smsConfirm.data.code);
      if (!subscriber) {
        return NextResponse.json({ error: 'invalid or expired code' }, { status: 400 });
      }
      return NextResponse.json({ message: 'confirmed', channel: 'sms' });
    }

    // Regular subscribe request
    const validation = SubscribeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'invalid input' }, { status: 400 });
    }

    const detected = await detectChannel(validation.data.contact);
    if (!detected) {
      return NextResponse.json({ error: 'enter a valid email address' }, { status: 400 });
    }

    // SMS subscriptions temporarily disabled (Twilio verification pending)
    if (detected.type === 'phone') {
      return NextResponse.json({ error: 'text notifications coming soon. use email for now.' }, { status: 400 });
    }

    if (detected.type === 'email') {
      const { subscriber, action } = await upsertEmailSubscriber(detected.value);

      if (action === 'already_confirmed') {
        return NextResponse.json({ message: 'already subscribed', channel: 'email' });
      }

      // Send (or resend) confirmation email
      const template = confirmationEmail(subscriber.confirmation_token);
      await getResend().emails.send({
        from: 'The Web <theweb@iris.mikeveson.com>',
        to: subscriber.email!,
        subject: template.subject,
        html: template.html,
      });

      return NextResponse.json({ message: 'confirmation sent', channel: 'email' }, { status: 201 });
    }

    // SMS channel — unreachable while SMS is disabled above, but kept for re-enablement
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const phoneValue = (detected as any).value as string;
    const { subscriber: smsSub, action: smsAction } = await upsertSmsSubscriber(phoneValue);

    if (smsAction === 'already_confirmed') {
      return NextResponse.json({ message: 'already subscribed', channel: 'sms' });
    }

    const twilioClient = getTwilioClient();
    const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

    if (!twilioClient || !twilioFrom) {
      console.error('[Subscribe] Twilio not configured');
      return NextResponse.json({ error: 'sms not available right now' }, { status: 503 });
    }

    await twilioClient.messages.create({
      body: `your confirmation code for the web: ${smsSub.confirmation_code}`,
      from: twilioFrom,
      to: smsSub.phone!,
    });

    return NextResponse.json(
      { message: 'confirmation code sent', channel: 'sms', phone: phoneValue },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Subscribe] Error:', error);
    return NextResponse.json(
      { error: 'something went wrong. try again later.' },
      { status: 500 }
    );
  }
}
