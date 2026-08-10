/**
 * Normalizes a Brazilian phone number to E.164 format.
 * Expected formats: (67) 99999-9999, 67999999999, +5567999999999
 */
export function normalizeBrazilPhone(phone: string): string {
  // Remove non-numeric characters
  let cleaned = phone.replace(/\D/g, "");

  // If starts with 55, check if it's already full
  if (cleaned.startsWith("55") && cleaned.length >= 12 && cleaned.length <= 13) {
    return `+${cleaned}`;
  }

  // If it's just DDD + Number (10 or 11 digits)
  if (cleaned.length === 10 || cleaned.length === 11) {
    return `+55${cleaned}`;
  }

  // Fallback or invalid format
  return `+${cleaned}`;
}

// Kept as the canonical compatibility export for existing call sites.
export const normalizePhone = normalizeBrazilPhone;

/**
 * Validates if a normalized phone number is a valid Brazilian mobile number.
 * Format: +55 (2 digits DDD) (9 digits mobile)
 */
export function isValidBrazilianPhone(normalizedPhone: string): boolean {
  // E.164 for Brazil mobile is +55 followed by 11 digits
  // +55 XX 9XXXX-XXXX
  const regex = /^\+55\d{11}$/;
  return regex.test(normalizedPhone);
}

/**
 * Maps a validated E.164 Brazilian phone number to its internal Auth email.
 * This identifier is an implementation detail: it is never rendered or
 * collected in the interface, and it is not an authorization mechanism.
 */
export function technicalEmailFromPhone(normalizedPhone: string): string {
  if (!isValidBrazilianPhone(normalizedPhone)) {
    throw new Error("Invalid normalized Brazilian phone number");
  }

  return `${normalizedPhone.slice(1)}@auth.greensport.internal`;
}

/**
 * Visual mask for Brazilian phone numbers: (XX) XXXXX-XXXX
 */
export function maskPhone(value: string): string {
  let cleaned = value.replace(/\D/g, "");
  
  // Limit to 11 digits (DDD + 9 digits)
  if (cleaned.length > 11) cleaned = cleaned.slice(0, 11);

  if (cleaned.length <= 2) {
    return cleaned.length > 0 ? `(${cleaned}` : "";
  }
  if (cleaned.length <= 6) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
  }
  if (cleaned.length <= 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
}
