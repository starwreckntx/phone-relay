import { CountryCode } from 'libphonenumber-js';
export declare function normalizeToE164(phoneNumber: string, defaultCountry?: CountryCode): string | null;
export declare function extractPhoneNumber(input: string): string | null;
