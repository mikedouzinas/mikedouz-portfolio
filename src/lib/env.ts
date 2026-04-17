/**
 * Safe environment variable loader
 * Validates required env vars at startup and provides typed access
 */

const requiredEnvVars = {
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  ADMIN_API_KEY: process.env.ADMIN_API_KEY,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
} as const;

// Check for missing required variables
const missingVars = Object.entries(requiredEnvVars)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.warn(
    `⚠️  Missing required environment variables for inbox feature: ${missingVars.join(', ')}`
  );
}

/**
 * Environment configuration
 * Exports validated environment variables with fallbacks
 */
export const env = {
  // Resend API for sending emails
  resendApiKey: requiredEnvVars.RESEND_API_KEY || '',
  
  // Admin API key for inbox access
  adminApiKey: requiredEnvVars.ADMIN_API_KEY || '',
  
  // Supabase configuration
  supabaseUrl: requiredEnvVars.SUPABASE_URL || '',
  supabaseServiceRoleKey: requiredEnvVars.SUPABASE_SERVICE_ROLE_KEY || '',
  
  // Email recipient for inbox notifications
  inboxRecipientEmail: process.env.INBOX_RECIPIENT_EMAIL || 'mike@douzinas.com',

  // Twilio configuration (for SMS subscriptions)
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || '',

  // ElevenLabs configuration (for audio listen feature)
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || '',
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || '',
} as const;

/**
 * Check if inbox feature is fully configured
 */
export function isInboxConfigured(): boolean {
  return !!(
    env.resendApiKey &&
    env.adminApiKey &&
    env.supabaseUrl &&
    env.supabaseServiceRoleKey
  );
}
