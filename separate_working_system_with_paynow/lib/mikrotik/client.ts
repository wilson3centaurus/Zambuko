/**
 * MikroTik RouterOS API integration.
 * Uses node-routeros to communicate with the router's API port (8728).
 *
 * All functions are safe to call even when MIKROTIK_HOST is not configured –
 * they will return a graceful result so the system can operate in
 * "standalone voucher mode" without a physical router.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { RouterOSAPI } = require('node-routeros');

interface MikrotikConfig {
  host: string;
  user: string;
  password: string;
  port: number;
}

function getConfig(): MikrotikConfig | null {
  const host = process.env.MIKROTIK_HOST;
  if (!host) return null;
  return {
    host,
    user: process.env.MIKROTIK_USER || 'admin',
    password: process.env.MIKROTIK_PASSWORD || '',
    port: parseInt(process.env.MIKROTIK_PORT || '8728', 10),
  };
}

async function withApi<T>(fn: (api: typeof RouterOSAPI) => Promise<T>): Promise<T | null> {
  const config = getConfig();
  if (!config) {
    console.warn('[MikroTik] MIKROTIK_HOST not configured – skipping router call');
    return null;
  }

  const api = new RouterOSAPI({
    host: config.host,
    user: config.user,
    password: config.password,
    port: config.port,
    timeout: 10,
  });

  try {
    await api.connect();
    const result = await fn(api);
    await api.close();
    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[MikroTik] API error:', msg);
    try { await api.close(); } catch { /* ignore */ }
    return null;
  }
}

export interface HotspotUser {
  id: string;
  name: string;
  profile: string;
  comment: string;
  disabled: string;
  'limit-uptime': string;
}

export interface ActiveSession {
  id: string;
  user: string;
  address: string;
  'mac-address': string;
  'host-name': string;
  uptime: string;
  'bytes-in': string;
  'bytes-out': string;
}

/**
 * Add a new hotspot user. Called after voucher validation / purchase.
 * @param voucherCode  Used as both username and password.
 * @param profile      MikroTik hotspot profile name (matches package).
 * @param uptimeLimit  e.g. "01:00:00" for 1 hour, "1d" for 1 day.
 */
export async function addHotspotUser(
  voucherCode: string,
  profile: string,
  uptimeLimit: string
): Promise<string | null> {
  return withApi(async (api) => {
    const server = process.env.MIKROTIK_HOTSPOT_SERVER || '';
    const params: string[] = [
      `=name=${voucherCode}`,
      `=password=${voucherCode}`,
      `=profile=${profile}`,
      `=limit-uptime=${uptimeLimit}`,
      `=comment=ConnectWifi`,
    ];
    if (server) params.push(`=server=${server}`);

    const result = await api.write('/ip/hotspot/user/add', params);
    // MikroTik returns the new ID reference like ["!re", "*1"]
    return result?.[0]?.['ret'] ?? null;
  });
}

/**
 * Remove (delete) a hotspot user by voucher code (username).
 */
export async function removeHotspotUser(voucherCode: string): Promise<boolean> {
  const result = await withApi(async (api) => {
    // First find the user's internal ID
    const users: HotspotUser[] = await api.write('/ip/hotspot/user/print', [
      `?name=${voucherCode}`,
    ]);
    if (!users?.length) return false;
    await api.write('/ip/hotspot/user/remove', [`=numbers=${users[0].id}`]);
    return true;
  });
  return result === true;
}

/**
 * Disable a hotspot user (soft-remove – keeps audit trail).
 */
export async function disableHotspotUser(voucherCode: string): Promise<boolean> {
  const result = await withApi(async (api) => {
    const users: HotspotUser[] = await api.write('/ip/hotspot/user/print', [
      `?name=${voucherCode}`,
    ]);
    if (!users?.length) return false;
    await api.write('/ip/hotspot/user/set', [
      `=numbers=${users[0].id}`,
      '=disabled=yes',
    ]);
    return true;
  });
  return result === true;
}

/**
 * Fetch all currently active hotspot sessions.
 */
export async function getActiveSessions(): Promise<ActiveSession[]> {
  const result = await withApi(async (api) => {
    return api.write('/ip/hotspot/active/print') as Promise<ActiveSession[]>;
  });
  return result ?? [];
}

/**
 * Kick (disconnect) an active session by username.
 */
export async function kickActiveSession(username: string): Promise<boolean> {
  const result = await withApi(async (api) => {
    const sessions: ActiveSession[] = await api.write('/ip/hotspot/active/print', [
      `?user=${username}`,
    ]);
    if (!sessions?.length) return false;
    await api.write('/ip/hotspot/active/remove', [`=numbers=${sessions[0].id}`]);
    return true;
  });
  return result === true;
}

/**
 * Build the MikroTik uptime string from hours (integer).
 * MikroTik format: HH:MM:SS or Dd HH:MM:SS for multi-day
 */
export function hoursToUptimeString(hours: number): string {
  const totalSeconds = hours * 3600;
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  const time = [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
  return d > 0 ? `${d}d ${time}` : time;
}

/**
 * Build the MikroTik login redirect URL.
 * The browser POSTs to this URL to authenticate the captive portal session.
 */
export function buildMikrotikLoginUrl(
  hotspotIp: string,
  username: string,
  password: string,
  dst = 'https://www.google.com'
): string {
  const params = new URLSearchParams({ username, password, dst });
  return `http://${hotspotIp}/login?${params.toString()}`;
}
