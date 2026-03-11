/**
 * Email templates for "The Web" newsletter
 * Inline styles for email client compatibility
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://mikeveson.com';

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
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" bgcolor="#111827">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111827;padding:40px 20px;" bgcolor="#111827">
    <tr>
      <td align="center" bgcolor="#111827">
        <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;">
          <tr>
            <td style="padding-bottom:24px;">
              <span style="color:#9CA3AF;font-size:13px;text-transform:lowercase;letter-spacing:0.05em;">the web</span> <span style="color:#6B7280;font-size:11px;">by mike veson</span>
            </td>
          </tr>
          <tr>
            <td style="color:#F3F4F6;font-size:18px;font-weight:600;padding-bottom:16px;">
              confirm your subscription
            </td>
          </tr>
          <tr>
            <td style="color:#9CA3AF;font-size:14px;line-height:1.6;padding-bottom:28px;">
              someone (hopefully you) subscribed to the web, my blog about research, philosophy, and thinking. click below to confirm and you'll get an email whenever i publish something new.
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:28px;">
              <a href="${confirmUrl}" style="display:inline-block;background-color:#7C3AED;color:#F3F4F6;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:500;">confirm subscription</a>
            </td>
          </tr>
          <tr>
            <td style="color:#6B7280;font-size:12px;line-height:1.5;">
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
    ? post.tags.map(t => `<span style="display:inline-block;padding:2px 8px;background-color:rgba(139,92,246,0.15);color:#A78BFA;border-radius:12px;font-size:11px;margin-right:4px;">${t}</span>`).join(' ')
    : '';

  return {
    subject: `new on the web: ${post.title}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" bgcolor="#111827">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111827;padding:40px 20px;" bgcolor="#111827">
    <tr>
      <td align="center" bgcolor="#111827">
        <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;">
          <tr>
            <td style="padding-bottom:24px;">
              <span style="color:#9CA3AF;font-size:13px;text-transform:lowercase;letter-spacing:0.05em;">the web</span> <span style="color:#6B7280;font-size:11px;">by mike veson</span>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:8px;">
              <a href="${postUrl}" style="color:#F3F4F6;font-size:20px;font-weight:600;text-decoration:none;">${post.title}</a>
            </td>
          </tr>
          ${post.subtitle ? `<tr><td style="color:#9CA3AF;font-size:14px;padding-bottom:12px;">${post.subtitle}</td></tr>` : ''}
          <tr>
            <td style="color:#6B7280;font-size:12px;padding-bottom:16px;">
              ${post.reading_time} min read${tagsHtml ? ' &middot; ' + tagsHtml : ''}
            </td>
          </tr>
          <tr>
            <td style="color:#D1D5DB;font-size:14px;line-height:1.6;padding-bottom:24px;">
              ${post.preview}
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:32px;">
              <a href="${postUrl}" style="display:inline-block;background-color:#7C3AED;color:#F3F4F6;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:500;">read the full post</a>
            </td>
          </tr>
          <tr>
            <td style="border-top:1px solid #374151;padding-top:16px;">
              <span style="color:#6B7280;font-size:11px;">
                you're receiving this because you subscribed to the web.
                <a href="${unsubscribeUrl}" style="color:#6B7280;text-decoration:underline;">unsubscribe</a>
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
