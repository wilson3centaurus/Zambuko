import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getAdminFromCookie } from '@/lib/auth/jwt';
import { disableHotspotUser, kickActiveSession } from '@/lib/mikrotik/client';

// GET /api/vouchers/[id]
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('vouchers')
    .select('*, package:packages(*), session:sessions(id, active, start_time, end_time, bytes_in, bytes_out, ip_address, mac_address)')
    .eq('id', params.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ success: false, error: 'Voucher not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data });
}

// PATCH /api/vouchers/[id] – disable voucher (admin only)
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const supabase = createServiceRoleClient();

  const { data: voucher } = await supabase
    .from('vouchers')
    .select('code, status')
    .eq('id', params.id)
    .single();

  if (!voucher) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

  if (body.status === 'disabled') {
    // Kick active session from MikroTik
    await kickActiveSession(voucher.code);
    await disableHotspotUser(voucher.code);
  }

  const { error } = await supabase
    .from('vouchers')
    .update({ status: body.status })
    .eq('id', params.id);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

// DELETE /api/vouchers/[id]
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from('vouchers').delete().eq('id', params.id);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
