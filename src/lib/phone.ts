/**
 * Phone number validation and formatting helper
 * Uses libphonenumber-js for E.164 format compliance
 */

// Dynamic import to handle cases where library might not be available
let libphonenumber: typeof import('libphonenumber-js') | null = null;

async function loadLibphonenumber() {
  if (libphonenumber) return libphonenumber;
  
  try {
    libphonenumber = await import('libphonenumber-js');
    return libphonenumber;
  } catch {
    console.warn('[Phone] libphonenumber-js not available, using basic validation');
    return null;
  }
}

/**
 * Validate and format phone number to E.164 format
 * Returns null if invalid
 * 
 * @param phoneNumber - Raw phone number input
 * @param defaultCountry - ISO country code (e.g., 'US', 'GB')
 * @returns E.164 formatted phone or null
 */
export async function validateAndFormatPhone(
  phoneNumber: string,
  defaultCountry: string = 'US'
): Promise<string | null> {
  // Basic sanitization: remove non-digit characters except +
  const sanitized = phoneNumber.replace(/[^\d+]/g, '');
  
  // If already in E.164 format (starts with +), validate it
  if (sanitized.startsWith('+')) {
    const lib = await loadLibphonenumber();
    if (!lib) {
      // Fallback: basic validation for E.164
      return sanitized.length >= 8 && sanitized.length <= 15 ? sanitized : null;
    }
    
    try {
      const parsed = lib.parsePhoneNumber(sanitized);
      return parsed.isValid() ? parsed.format('E.164') : null;
    } catch {
      return null;
    }
  }
  
  // Try parsing with default country
  const lib = await loadLibphonenumber();
  if (!lib) {
    // Fallback: prepend +1 for US if no country code
    return defaultCountry === 'US' ? `+1${sanitized}` : null;
  }
  
  try {
    const parsed = lib.parsePhoneNumber(sanitized, defaultCountry as 'US');
    return parsed.isValid() ? parsed.format('E.164') : null;
  } catch {
    return null;
  }
}

/**
 * Basic phone number validation (synchronous, no library required)
 * Useful for client-side validation before server-side processing
 * 
 * @param phoneNumber - Raw phone number input
 * @returns true if format looks valid
 */
export function isValidPhoneFormat(phoneNumber: string): boolean {
  const sanitized = phoneNumber.replace(/[^\d+]/g, '');
  return sanitized.length >= 7 && sanitized.length <= 15;
}
