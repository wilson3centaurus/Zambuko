import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getAdminFromCookie } from '@/lib/auth/jwt';
import { getActiveSessions } from '@/lib/mikrotik/client';

// GET /api/sessions – list sessions (admin only)
export async function GET(request: NextRequest) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const activeOnly = searchParams.get('active') === 'true';
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
  const offset = parseInt(searchParams.get('offset') || '0');

  const supabase = createServiceRoleClient();
  let query = supabase
    .from('sessions')
    .select(
      `*, voucher:vouchers(code, status, expires_at, package:packages(name, speed_limit))`,
      { count: 'exact' }
    )
    .order('start_time', { ascending: false })
    .range(offset, offset + limit - 1);

  if (activeOnly) query = query.eq('active', true);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Enrich with live MikroTik data where possible
  let mikrotikSessions: Record<string, unknown>[] = [];
  try {
    mikrotikSessions = (await getActiveSessions()) as unknown as Record<string, unknown>[];
  } catch {
    // Non-fatal – MikroTik may be offline
  }

  const mikrotikMap = new Map(
    mikrotikSessions.map((s: Record<string, unknown>) => [s.user, s])
  );

  const enriched = (data || []).map((session) => {
    const voucherCode = (session.voucher as { code?: string } | null)?.code;
    const live = voucherCode ? mikrotikMap.get(voucherCode) : undefined;
    return { ...session, live: live ?? null };
  });

  return NextResponse.json({ success: true, data: enriched, total: count });
}
