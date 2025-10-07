import { NextResponse } from 'next/server';

/**
 * Health check endpoint for Iris API
 * Verifies environment configuration without exposing sensitive data
 * 
 * GET /api/iris/health
 */
export async function GET() {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    config: {
      // Check if required environment variables are set (without exposing values)
      openai_configured: !!process.env.OPENAI_API_KEY,
      openai_key_length: process.env.OPENAI_API_KEY?.length || 0,
      openai_key_prefix: process.env.OPENAI_API_KEY?.substring(0, 7) || 'NOT_SET', // Show sk-proj or sk-xxxx
      github_configured: !!process.env.GITHUB_TOKEN,
    },
    warnings: [] as string[]
  };

  // Add warnings if configuration is incomplete
  if (!process.env.OPENAI_API_KEY) {
    health.status = 'degraded';
    health.warnings.push('OPENAI_API_KEY is not set - AI features will not work');
  } else if (process.env.OPENAI_API_KEY.length < 20) {
    health.status = 'degraded';
    health.warnings.push('OPENAI_API_KEY appears to be invalid (too short)');
  } else if (!process.env.OPENAI_API_KEY.startsWith('sk-')) {
    health.status = 'degraded';
    health.warnings.push('OPENAI_API_KEY appears to be invalid (should start with sk-)');
  }

  if (!process.env.GITHUB_TOKEN) {
    health.warnings.push('GITHUB_TOKEN is not set - GitHub activity features will not work (optional)');
  }

  console.log('[Health API] Health check:', health);

  return NextResponse.json(health);
}

