import { z } from 'zod';

// ── Phone number validation (Zimbabwe-aware) ──────────────────
// Supports: 07xxxxxxxx, 263xxxxxxxx, +263xxxxxxxx
export const zimbabwePhoneSchema = z
  .string()
  .trim()
  .transform((v: string) => v.replace(/\s/g, ''))
  .refine(
    (v: string) => /^(\+?263|0)?7[1-8]\d{7}$/.test(v),
    'Enter a valid Zimbabwean mobile number (e.g. 0771234567)'
  );

/** Normalise phone to 07xxxxxxxx format */
export function normalisePhone(raw: string): string {
  const clean = raw.replace(/\s|\+/g, '');
  if (clean.startsWith('263')) return '0' + clean.slice(3);
  return clean.startsWith('0') ? clean : '0' + clean;
}

// ── Payment ───────────────────────────────────────────────────
export const paymentInitiateSchema = z.object({
  phone: zimbabwePhoneSchema,
  packageId: z.string().uuid('Invalid package'),
});

// ── Voucher validation ────────────────────────────────────────
export const voucherValidateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(4, 'Invalid voucher code')
    .max(12, 'Invalid voucher code')
    .transform((v: string) => v.toUpperCase().replace(/\s/g, '')),
  mac: z.string().optional(),
  ip: z.string().optional(),
  deviceName: z.string().optional(),
});

// ── Admin auth ────────────────────────────────────────────────
export const adminLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// ── Package creation ─────────────────────────────────────────
export const createPackageSchema = z.object({
  name: z.string().trim().min(2, 'Package name is required').max(50),
  description: z.string().trim().max(200).nullable().optional(),
  price: z.number().min(0.01, 'Price must be at least $0.01'),
  duration_hours: z.number().int().min(1, 'Duration must be at least 1 hour').max(8760),
  speed_limit: z.string().trim().default('5M/5M'),
  max_devices: z.number().int().min(1).max(20).default(3),
  data_limit_mb: z.number().int().min(1).nullable().optional(),
  active: z.boolean().default(true),
});

// ── Voucher generation ────────────────────────────────────────
export const generateVouchersSchema = z.object({
  packageId: z.string().uuid('Invalid package'),
  quantity: z.number().int().min(1).max(500),
});

// ── Network settings ──────────────────────────────────────────
export const updatePackageSchema = z.object({
  speed_limit: z.string().regex(/^\d+[KMG]\/\d+[KMG]$/, 'Format: 5M/5M').optional(),
  max_devices: z.number().int().min(1).max(10).optional(),
  data_limit_mb: z.number().int().min(0).nullable().optional(),
  active: z.boolean().optional(),
});
