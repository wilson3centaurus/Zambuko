import crypto from 'crypto';

/**
 * Generates a secure, human-readable voucher code.
 * Format: XXXX-XXXX  (8 uppercase alphanumeric chars, no ambiguous chars)
 * Example: "BZTK-9YMR"
 */
export function generateVoucherCode(): string {
  // Exclude ambiguous chars: 0/O, 1/I/L
  const charset = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  const code = Array.from(bytes)
    .map((b) => charset[b % charset.length])
    .join('');
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * Generates a unique payment reference.
 * Format: CW-<timestamp-base36>-<4 random hex chars>
 * Keeps it short enough for Paynow's reference field.
 */
export function generatePaymentReference(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `CW-${ts}-${rand}`;
}

/**
 * Generates a batch ID for bulk voucher operations.
 */
export function generateBatchId(): string {
  return `BATCH-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomBytes(3)
    .toString('hex')
    .toUpperCase()}`;
}

/**
 * Validates that a voucher code matches the expected format.
 */
export function isValidVoucherFormat(code: string): boolean {
  return /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code.trim().toUpperCase());
}

/**
 * Normalise user-supplied code (trim, uppercase, add dash if missing).
 */
export function normaliseVoucherCode(raw: string): string {
  const clean = raw.trim().toUpperCase().replace(/\s/g, '');
  // If they typed 8 chars without a dash: insert it
  if (/^[A-Z0-9]{8}$/.test(clean)) {
    return `${clean.slice(0, 4)}-${clean.slice(4)}`;
  }
  return clean;
}
