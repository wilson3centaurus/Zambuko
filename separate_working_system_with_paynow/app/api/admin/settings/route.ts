import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getAdminFromCookie } from '@/lib/auth/jwt';

// GET /api/admin/settings – all admins can read
export async function GET() {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from('settings').select('key, value');
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const map: Record<string, string> = {};
  data?.forEach((row) => { map[row.key] = row.value; });
  return NextResponse.json({ success: true, data: map });
}

// PATCH /api/admin/settings – superadmin only
export async function PATCH(request: NextRequest) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  if (admin.role !== 'superadmin') {
    return NextResponse.json({ success: false, error: 'Superadmin access required' }, { status: 403 });
  }

  const body = await request.json() as Record<string, string>;
  const supabase = createServiceRoleClient();

  const updates = Object.entries(body).map(([key, value]) =>
    supabase
      .from('settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return NextResponse.json({ success: false, error: failed.error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
