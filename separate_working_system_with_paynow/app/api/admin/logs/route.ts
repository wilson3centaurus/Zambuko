import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getAdminFromCookie } from '@/lib/auth/jwt';

// GET /api/admin/logs
export async function GET(request: NextRequest) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const type = searchParams.get('type');
  const level = searchParams.get('level');
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);
  const offset = parseInt(searchParams.get('offset') || '0');

  const supabase = createServiceRoleClient();
  let query = supabase
    .from('logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (type) query = query.eq('type', type);
  if (level) query = query.eq('level', level);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, data, total: count });
}
