/**
 * Email templates for "The Web" newsletter
 * Inline styles for email client compatibility.
 *
 * Light theme by design: light-background emails render predictably across
 * Gmail, Apple Mail, and Outlook in both light and dark mode. Dark-themed
 * emails get force-inverted by clients (esp. the Gmail mobile app, which
 * ignores color-scheme meta tags entirely), so we keep these light and
 * declare color-scheme:light so compliant clients don't re-theme them.
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://mikeveson.com';

const HEAD = `<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<style>:root{color-scheme:light;supported-color-schemes:light;}</style>
</head>`;

// Shared palette
const PAGE_BG = '#f3f4f6'; // light gray page background
const CARD_BG = '#ffffff';
const HEADING = '#111827';
const BODY = '#4b5563';
const MUTED = '#6b7280';
const FAINT = '#9ca3af';
const BORDER = '#e5e7eb';
const ACCENT = '#7c3aed';

/**
 * Confirmation email (double opt-in)
 */
export function confirmationEmail(confirmationToken: string): {
  subject: string;
  html: string;
} {
  const confirmUrl = `${BASE_URL}/api/the-web/subscribe/confirm?token=${confirmationToken}`;

  return {
    subject: 'confirm your subscription to the web',
    html: `
<!DOCTYPE html>
<html lang="en">
${HEAD}
<body style="margin:0;padding:0;background-color:${PAGE_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" bgcolor="${PAGE_BG}">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${PAGE_BG};padding:40px 20px;" bgcolor="${PAGE_BG}">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:${CARD_BG};border:1px solid ${BORDER};border-radius:12px;" bgcolor="${CARD_BG}">
          <tr>
            <td style="padding:32px 32px 0 32px;">
              <span style="color:${MUTED};font-size:13px;text-transform:lowercase;letter-spacing:0.05em;">the web</span> <span style="color:${FAINT};font-size:11px;">by mike veson</span>
            </td>
          </tr>
          <tr>
            <td style="color:${HEADING};font-size:18px;font-weight:600;padding:24px 32px 16px 32px;">
              confirm your subscription
            </td>
          </tr>
          <tr>
            <td style="color:${BODY};font-size:14px;line-height:1.6;padding:0 32px 28px 32px;">
              someone (hopefully you) subscribed to the web, my blog about research, philosophy, and thinking. click below to confirm and you'll get an email whenever i publish something new.
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px 32px;">
              <a href="${confirmUrl}" style="display:inline-block;background-color:${ACCENT};color:#ffffff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:500;">confirm subscription</a>
            </td>
          </tr>
          <tr>
            <td style="color:${FAINT};font-size:12px;line-height:1.5;padding:0 32px 32px 32px;">
              if you didn't request this, just ignore this email. no action needed.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };
}

/**
 * New post notification email
 */
export function newPostEmail(post: {
  title: string;
  subtitle: string | null;
  slug: string;
  preview: string;
  reading_time: number;
  tags: string[];
}, unsubscribeToken: string): {
  subject: string;
  html: string;
} {
  const postUrl = `${BASE_URL}/the-web/${post.slug}`;
  const unsubscribeUrl = `${BASE_URL}/api/the-web/subscribe/unsubscribe?token=${unsubscribeToken}`;
  const tagsHtml = post.tags.length > 0
    ? post.tags.map(t => `<span style="display:inline-block;padding:2px 8px;background-color:rgba(124,58,237,0.10);color:${ACCENT};border-radius:12px;font-size:11px;margin-right:4px;">${t}</span>`).join(' ')
    : '';

  return {
    subject: `new on the web: ${post.title}`,
    html: `
<!DOCTYPE html>
<html lang="en">
${HEAD}
<body style="margin:0;padding:0;background-color:${PAGE_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" bgcolor="${PAGE_BG}">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${PAGE_BG};padding:40px 20px;" bgcolor="${PAGE_BG}">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:${CARD_BG};border:1px solid ${BORDER};border-radius:12px;" bgcolor="${CARD_BG}">
          <tr>
            <td style="padding:32px 32px 0 32px;">
              <span style="color:${MUTED};font-size:13px;text-transform:lowercase;letter-spacing:0.05em;">the web</span> <span style="color:${FAINT};font-size:11px;">by mike veson</span>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 8px 32px;">
              <a href="${postUrl}" style="color:${HEADING};font-size:20px;font-weight:600;text-decoration:none;">${post.title}</a>
            </td>
          </tr>
          ${post.subtitle ? `<tr><td style="color:${BODY};font-size:14px;padding:0 32px 12px 32px;">${post.subtitle}</td></tr>` : ''}
          <tr>
            <td style="color:${FAINT};font-size:12px;padding:0 32px 16px 32px;">
              ${post.reading_time} min read${tagsHtml ? ' &middot; ' + tagsHtml : ''}
            </td>
          </tr>
          <tr>
            <td style="color:${BODY};font-size:14px;line-height:1.6;padding:0 32px 24px 32px;">
              ${post.preview}
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px 32px;">
              <a href="${postUrl}" style="display:inline-block;background-color:${ACCENT};color:#ffffff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:500;">read the full post</a>
            </td>
          </tr>
          <tr>
            <td style="border-top:1px solid ${BORDER};padding:16px 32px 32px 32px;">
              <span style="color:${FAINT};font-size:11px;">
                you're receiving this because you subscribed to the web.
                <a href="${unsubscribeUrl}" style="color:${MUTED};text-decoration:underline;">unsubscribe</a>
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };
}
