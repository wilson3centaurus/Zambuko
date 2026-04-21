import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getAdminFromCookie } from '@/lib/auth/jwt';
import { kickActiveSession, disableHotspotUser } from '@/lib/mikrotik/client';
import { addHours } from 'date-fns';

// GET /api/sessions/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('sessions')
    .select('*, voucher:vouchers(*, package:packages(*))')
    .eq('id', params.id)
    .single();

  if (error || !data) return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });

  return NextResponse.json({ success: true, data });
}

// PATCH /api/sessions/[id] – disconnect or extend
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const supabase = createServiceRoleClient();

  const { data: session } = await supabase
    .from('sessions')
    .select('*, voucher:vouchers(code, expires_at, package_id, package:packages(duration_hours))')
    .eq('id', params.id)
    .single();

  if (!session) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

  const voucherCode = (session.voucher as { code?: string })?.code;

  if (body.action === 'disconnect') {
    if (voucherCode) {
      await kickActiveSession(voucherCode);
      await disableHotspotUser(voucherCode);
    }

    await supabase
      .from('sessions')
      .update({ active: false, end_time: new Date().toISOString() })
      .eq('id', params.id);

    await supabase
      .from('vouchers')
      .update({ status: 'disabled' })
      .eq('code', voucherCode);

    await supabase.from('logs').insert({
      type: 'login',
      level: 'warn',
      message: `Session disconnected by admin: ${voucherCode}`,
      metadata: { sessionId: params.id, adminId: admin.sub },
    });

    return NextResponse.json({ success: true });
  }

  if (body.action === 'extend') {
    const hours = parseInt(body.hours || '1', 10);
    const currentExpiry = (session.voucher as { expires_at?: string })?.expires_at;
    const baseDate = currentExpiry ? new Date(currentExpiry) : new Date();
    const newExpiry = addHours(baseDate, hours).toISOString();

    await supabase
      .from('vouchers')
      .update({ expires_at: newExpiry })
      .eq('code', voucherCode);

    await supabase
      .from('sessions')
      .update({ end_time: newExpiry })
      .eq('id', params.id);

    await supabase.from('logs').insert({
      type: 'login',
      level: 'info',
      message: `Session extended ${hours}h by admin: ${voucherCode}`,
      metadata: { sessionId: params.id, hours, newExpiry, adminId: admin.sub },
    });

    return NextResponse.json({ success: true, data: { expires_at: newExpiry } });
  }

  return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
}
