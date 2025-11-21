/**
 * Metadata extraction utilities for analytics
 * Extracts visitor ID, geo data, device info from requests
 */

import { NextRequest } from 'next/server';

export interface RequestMetadata {
  visitor_id?: string;
  ip_address?: string;
  country?: string;
  city?: string;
  region?: string;
  referrer?: string;
  device_type?: string;
  screen_size?: string;
  user_agent?: string;
}

/**
 * Extract comprehensive metadata from Next.js request
 * Includes Vercel geo headers, visitor tracking, and device detection
 */
export function extractRequestMetadata(req: NextRequest): RequestMetadata {
  const headers = req.headers;

  // Vercel Analytics visitor ID (from cookie or header)
  const visitorId =
    req.cookies.get('va_id')?.value ||
    headers.get('x-vercel-id') ||
    undefined;

  // IP address (Vercel provides this in headers)
  const ipAddress =
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers.get('x-real-ip') ||
    undefined;

  // Geo data from Vercel Edge Network
  const country = headers.get('x-vercel-ip-country') || undefined;
  const city = headers.get('x-vercel-ip-city') || undefined;
  const region = headers.get('x-vercel-ip-country-region') || undefined;

  // Referrer
  const referrer = headers.get('referer') || headers.get('referrer') || undefined;

  // User agent
  const userAgent = headers.get('user-agent') || undefined;

  // Device detection from user agent
  const deviceType = detectDeviceType(userAgent);

  // Screen size from custom header (if frontend sends it)
  const screenSize = headers.get('x-screen-size') || undefined;

  return {
    visitor_id: visitorId,
    ip_address: ipAddress,
    country,
    city,
    region,
    referrer,
    device_type: deviceType,
    screen_size: screenSize,
    user_agent: userAgent
  };
}

/**
 * Detect device type from user agent string
 */
function detectDeviceType(userAgent?: string): string | undefined {
  if (!userAgent) return undefined;

  const ua = userAgent.toLowerCase();

  // Mobile detection
  if (/(android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini)/i.test(ua)) {
    // Tablet detection
    if (/(ipad|tablet|playbook|silk)|(android(?!.*mobile))/i.test(ua)) {
      return 'tablet';
    }
    return 'mobile';
  }

  return 'desktop';
}

/**
 * Generate a simple session ID if not provided
 * Used for conversation threading
 */
export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
