
import { parsePhoneNumber, CountryCode } from 'libphonenumber-js';

/**
 * Normalize phone number to E.164 format
 * @param phoneNumber - Raw phone number string
 * @param defaultCountry - Default country code (e.g., 'US')
 * @returns E.164 formatted number or null if invalid
 */
export function normalizeToE164(
  phoneNumber: string,
  defaultCountry: CountryCode = 'US',
): string | null {
  try {
    const parsed = parsePhoneNumber(phoneNumber, defaultCountry);
    if (parsed && parsed.isValid()) {
      return parsed.format('E.164');
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Extract phone number from various formats
 * @param input - Input string that may contain a phone number
 * @returns Extracted phone number or null
 */
export function extractPhoneNumber(input: string): string | null {
  // Remove common punctuation and whitespace
  const cleaned = input.replace(/[\s\-\(\)\.]/g, '');
  
  // Try to find a phone number pattern
  const patterns = [
    /\+?\d{10,15}/, // International format
    /\d{10}/, // US format without country code
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return null;
}
