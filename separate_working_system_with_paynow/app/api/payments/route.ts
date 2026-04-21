import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getAdminFromCookie } from '@/lib/auth/jwt';

// GET /api/payments – list transactions (admin only)
export async function GET(request: NextRequest) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status');
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
  const offset = parseInt(searchParams.get('offset') || '0');

  const supabase = createServiceRoleClient();
  let query = supabase
    .from('transactions')
    .select('*, package:packages(name, price), voucher:vouchers(code)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, data, total: count });
}
