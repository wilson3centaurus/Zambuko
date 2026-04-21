import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format, differenceInSeconds } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format currency in USD (used throughout Zimbabwe hotspot) */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

/** Format bytes to human-readable string */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Format a date string to a readable format */
export function formatDate(dateStr: string): string {
  return format(new Date(dateStr), 'dd MMM yyyy, HH:mm');
}

/** Format time remaining until expiry */
export function formatTimeRemaining(expiresAt: string): string {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const seconds = differenceInSeconds(expiry, now);

  if (seconds <= 0) return 'Expired';

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Get seconds until expiry (negative = expired) */
export function secondsUntilExpiry(expiresAt: string): number {
  return differenceInSeconds(new Date(expiresAt), new Date());
}

/** Format relative time (e.g., "2 hours ago") */
export function formatRelative(dateStr: string): string {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
}

/** Format a phone number for display */
export function formatPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 10) return `0${clean.slice(1, 4)} ${clean.slice(4, 7)} ${clean.slice(7)}`;
  return phone;
}

/** Mask phone number for privacy */
export function maskPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.length >= 9) {
    return `${clean.slice(0, 3)}****${clean.slice(-3)}`;
  }
  return '***';
}

/** Parse a MikroTik rate-limit string (e.g. "5M/5M") for display */
export function parseSpeedLimit(rateLimit: string): { down: string; up: string } {
  const [down, up] = rateLimit.split('/');
  return { down: down ?? rateLimit, up: up ?? rateLimit };
}
