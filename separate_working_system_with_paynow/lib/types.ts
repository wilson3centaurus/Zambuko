// ── Database entity types ────────────────────────────────────

export interface Package {
  id: string;
  name: string;
  price: number;
  duration_hours: number;
  speed_limit: string;
  max_devices: number;
  data_limit_mb: number | null;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export type VoucherStatus = 'unused' | 'active' | 'expired' | 'disabled';

export interface Voucher {
  id: string;
  code: string;
  package_id: string;
  status: VoucherStatus;
  batch_id: string | null;
  transaction_id: string | null;
  user_mac: string | null;
  user_ip: string | null;
  device_name: string | null;
  mikrotik_user_id: string | null;
  created_at: string;
  used_at: string | null;
  expires_at: string | null;
  // joined
  package?: Package;
}

export type TransactionStatus = 'pending' | 'paid' | 'failed' | 'cancelled';

export interface Transaction {
  id: string;
  reference: string;
  paynow_reference: string | null;
  phone: string;
  amount: number;
  package_id: string | null;
  status: TransactionStatus;
  voucher_id: string | null;
  poll_url: string | null;
  raw_callback: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  // joined
  package?: Package;
  voucher?: Voucher;
}

export interface Session {
  id: string;
  voucher_id: string;
  mac_address: string | null;
  ip_address: string | null;
  device_name: string | null;
  start_time: string;
  end_time: string | null;
  bytes_in: number;
  bytes_out: number;
  active: boolean;
  mikrotik_session_id: string | null;
  // joined
  voucher?: Voucher & { package?: Package };
}

export interface Admin {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'superadmin';
  active: boolean;
  avatar_url?: string | null;
  last_login_at: string | null;
  created_at: string;
}

export interface Log {
  id: string;
  type: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ── API response types ───────────────────────────────────────

export interface ApiSuccess<T = undefined> {
  success: true;
  data?: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

export type ApiResponse<T = undefined> = ApiSuccess<T> | ApiError;

// ── Portal / client-facing types ─────────────────────────────

export interface PaymentInitiateRequest {
  phone: string;
  packageId: string;
}

export interface PaymentInitiateResponse {
  reference: string;
  pollInterval: number; // ms
  message: string;
}

export interface PaymentStatusResponse {
  status: TransactionStatus;
  voucherCode?: string;
  expiresAt?: string;
}

export interface VoucherValidateRequest {
  code: string;
  mac?: string;
  ip?: string;
  deviceName?: string;
}

export interface VoucherValidateResponse {
  voucher: Pick<Voucher, 'id' | 'code' | 'expires_at' | 'status'>;
  package: Pick<Package, 'name' | 'duration_hours' | 'speed_limit'>;
  mikrotikRedirectUrl?: string;
}

// ── Admin types ──────────────────────────────────────────────

export interface AdminStats {
  activeUsers: number;
  revenueToday: number;
  revenueWeek: number;
  revenueMonth: number;
  vouchersSoldToday: number;
  totalVouchers: number;
  unusedVouchers: number;
}

export interface RevenuePoint {
  date: string;
  revenue: number;
}

export interface GenerateVouchersRequest {
  packageId: string;
  quantity: number;
}

export interface NetworkSettings {
  packages: Array<Pick<Package, 'id' | 'name' | 'speed_limit' | 'max_devices' | 'data_limit_mb'>>;
}
