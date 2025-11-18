import { createHash } from 'crypto';

/**
 * Hash IP address for privacy-preserving logs
 * One-way hashing ensures we can't recover the original IP
 * 
 * @param ip - Raw IP address
 * @returns Hashed IP (first 16 chars of SHA-256)
 */
export function hashIpUa(ip: string, userAgent: string): string {
  const combined = `${ip}:${userAgent}`;
  return createHash('sha256').update(combined).digest('hex').substring(0, 16);
}

/**
 * Escape HTML characters to prevent XSS
 * 
 * @param text - Raw text that might contain HTML
 * @returns Escaped HTML-safe text
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Strip control characters and trim whitespace
 * Useful for sanitizing user input before storing in database
 * 
 * @param text - Raw text
 * @param maxLength - Optional maximum length to truncate
 * @returns Sanitized text
 */
export function sanitizeText(text: string, maxLength?: number): string {
  // Remove control characters (except newlines and tabs)
  let sanitized = text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  // Normalize whitespace
  sanitized = sanitized.trim().replace(/\s+/g, ' ');
  
  // Truncate if needed
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength).trim();
  }
  
  return sanitized;
}

/**
 * Create a short preview of text
 * Useful for email subjects and admin UI
 * 
 * @param text - Full text
 * @param maxLength - Maximum preview length
 * @returns Truncated text with ellipsis if needed
 */
export function previewText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  
  // Try to break at word boundary
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}

/**
 * Generate a random nonce for form submissions
 * Helps prevent CSRF and ensures unique submissions
 * 
 * @param length - Nonce length in characters
 * @returns Random alphanumeric string
 */
export function generateNonce(length: number = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}
