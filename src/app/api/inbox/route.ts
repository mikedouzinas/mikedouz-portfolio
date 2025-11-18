import { NextRequest, NextResponse } from 'next/server';
import { InboxPayload } from '@/lib/types';
import { env, isInboxConfigured } from '@/lib/env';
import { insertInboxMessage, getInboxMessages } from '@/lib/supabaseAdmin';
import { validateAndFormatPhone } from '@/lib/phone';
import { sanitizeText, escapeHtml, previewText, hashIpUa } from '@/lib/security';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { Resend } from 'resend';

export const runtime = 'nodejs';

// Initialize Resend client
let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    if (!env.resendApiKey) {
      throw new Error('Resend API key not configured');
    }
    resendClient = new Resend(env.resendApiKey);
  }
  return resendClient;
}

/**
 * POST /api/inbox
 * Submit a message to Mike's inbox
 * Validates, rate limits, stores in Supabase, and sends email notification
 */
export async function POST(req: NextRequest) {
  try {
    // Check if feature is configured
    if (!isInboxConfigured()) {
      console.error('[Inbox] Feature not fully configured, missing environment variables');
      return NextResponse.json(
        { error: 'Inbox feature is not configured' },
        { status: 503 }
      );
    }
    
    // Parse and validate request body
    const body = await req.json();
    
    // Validate with Zod schema
    const validation = InboxPayload.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: `Validation failed: ${validation.error.message}` },
        { status: 400 }
      );
    }
    
    const payload = validation.data;
    
    // Honeypot check - reject if filled (spam detection)
    if (payload.honeypot) {
      console.warn('[Inbox] Honeypot field filled, likely spam');
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      );
    }
    
    // Rate limiting - prevent abuse
    const ip = getClientIp(req);
    const userAgent = req.headers.get('user-agent') || 'unknown';
    
    const rateLimit = checkRateLimit(ip, userAgent);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded. Please try again later.',
          resetAt: rateLimit.resetAt 
        },
        { status: 429 }
      );
    }
    
    // Normalize phone number if provided (validation already done client-side)
    let normalizedContactValue: string | undefined;
    if (payload.contact.method === 'phone') {
      // Client-side validation already ensures this is valid, but format it for storage
      const formatted = await validateAndFormatPhone(payload.contact.value, 'US');
      normalizedContactValue = formatted || payload.contact.value; // Fallback to original if formatting fails
    } else if (payload.contact.method === 'email') {
      normalizedContactValue = payload.contact.value;
    }
    
    // Sanitize and truncate text fields
    const sanitized = {
      source: payload.source,
      user_query: payload.userQuery ? sanitizeText(payload.userQuery, 1000) : undefined,
      iris_answer: payload.irisAnswer ? sanitizeText(payload.irisAnswer, 20000) : undefined,
      draft_message: sanitizeText(payload.message, 500),
      contact_method: payload.contact.method,
      contact_value: normalizedContactValue,
      user_agent: sanitizeText(userAgent, 500),
      ip_hash: hashIpUa(ip, userAgent),
    };
    
    // Insert into Supabase
    const messageId = await insertInboxMessage(sanitized);
    
    // Send email notification via Resend
    try {
      const emailResult = await sendInboxEmail({
        messageId,
        source: sanitized.source,
        draftMessage: sanitized.draft_message,
        contactMethod: sanitized.contact_method,
        contactValue: sanitized.contact_value,
        userQuery: sanitized.user_query,
        irisAnswer: sanitized.iris_answer,
      });
      console.log(`[Inbox] Email result for message ${messageId}:`, JSON.stringify(emailResult, null, 2));
    } catch (emailError) {
      console.error('[Inbox] Failed to send email notification:', emailError);
      if (emailError instanceof Error) {
        console.error('[Inbox] Error details:', emailError.message);
        console.error('[Inbox] Error stack:', emailError.stack);
      }
      // Don't fail the request if email fails - message is already in DB
    }
    
    return NextResponse.json({ id: messageId });
    
  } catch (error) {
    console.error('[Inbox] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/inbox
 * Admin-only endpoint to retrieve inbox messages
 * Requires x-admin-key header
 */
export async function GET(req: NextRequest) {
  try {
    // Check admin authentication
    const adminKey = req.headers.get('x-admin-key');
    if (!adminKey || adminKey !== env.adminApiKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const status = searchParams.get('status') as 'new' | 'read' | 'replied' | undefined;
    
    // Fetch messages
    const messages = await getInboxMessages({
      limit: Math.min(limit, 100), // Cap at 100
      offset,
      status,
    });
    
    return NextResponse.json({ messages });
    
  } catch (error) {
    console.error('[Inbox] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Send email notification via Resend
 * Includes full context in HTML format
 */
async function sendInboxEmail(data: {
  messageId: string;
  source: string;
  draftMessage: string;
  contactMethod: string;
  contactValue?: string;
  userQuery?: string;
  irisAnswer?: string;
}) {
  const resend = getResendClient();
  
  // Build email HTML
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #3b82f6 0%, #10b981 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
    .section { margin: 20px 0; padding: 15px; background: white; border-radius: 6px; border-left: 3px solid #3b82f6; }
    .label { font-weight: 600; color: #6b7280; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
    .value { margin-top: 6px; color: #1f2937; }
    pre { background: #f3f4f6; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 13px; white-space: pre-wrap; word-wrap: break-word; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">New Message from Portfolio</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.9;">Message ID: ${data.messageId}</p>
    </div>
    
    <div class="content">
      <div class="section">
        <div class="label">Source</div>
        <div class="value">${escapeHtml(data.source)}</div>
      </div>
      
      <div class="section">
        <div class="label">Contact</div>
        <div class="value">
          ${data.contactMethod === 'anon' 
            ? 'Anonymous' 
            : `${data.contactMethod}: ${escapeHtml(data.contactValue || 'N/A')}`}
        </div>
      </div>
      
      <div class="section">
        <div class="label">User's Message</div>
        <div class="value"><pre>${escapeHtml(data.draftMessage)}</pre></div>
      </div>
      
      ${data.userQuery ? `
      <div class="section">
        <div class="label">Original Question</div>
        <div class="value"><pre>${escapeHtml(data.userQuery)}</pre></div>
      </div>
      ` : ''}
      
      ${data.irisAnswer ? `
      <div class="section">
        <div class="label">Iris's Answer</div>
        <div class="value"><pre>${escapeHtml(data.irisAnswer)}</pre></div>
      </div>
      ` : ''}
    </div>
    
    <div class="footer">
      <p>Sent from your portfolio inbox at ${new Date().toISOString()}</p>
    </div>
  </div>
</body>
</html>
  `;
  
  console.log(`[Inbox] Attempting to send email for message ${data.messageId}`);
  console.log(`[Inbox] To: ${env.inboxRecipientEmail}`);
  console.log(`[Inbox] Resend API Key configured: ${!!env.resendApiKey}`);
  
  const result = await resend.emails.send({
    from: 'Iris Inbox <inbox@iris.mikeveson.com>',
    to: env.inboxRecipientEmail,
    subject: `[Inbox:${data.messageId}] ${previewText(data.draftMessage, 50)}`,
    html,
  });
  
  console.log(`[Inbox] Email API response for message ${data.messageId}:`, result);
  console.log(`[Inbox] Email sent successfully for message ${data.messageId}`);
  
  return result;
}
