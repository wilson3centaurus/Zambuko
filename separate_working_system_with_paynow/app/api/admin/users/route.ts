import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getAdminFromCookie } from '@/lib/auth/jwt';
import bcrypt from 'bcryptjs';

// GET /api/admin/users – list all admins (superadmin only)
export async function GET() {
  const me = await getAdminFromCookie();
  if (!me) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  if (me.role !== 'superadmin') return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('admins')
    .select('id, email, name, role, active, avatar_url, last_login_at, created_at')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

// POST /api/admin/users – create a new admin (superadmin only, role=admin)
export async function POST(request: NextRequest) {
  const me = await getAdminFromCookie();
  if (!me) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  if (me.role !== 'superadmin') return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

  const { name, email, password, avatar_url } = await request.json();
  if (!name || !email || !password) {
    return NextResponse.json({ success: false, error: 'name, email and password are required' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ success: false, error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const password_hash = await bcrypt.hash(password, 12);

  const { data, error } = await supabase
    .from('admins')
    .insert({ name, email, password_hash, role: 'admin', active: true, avatar_url: avatar_url ?? null })
    .select('id, email, name, role, active, avatar_url, created_at')
    .single();

  if (error) {
    const msg = error.code === '23505' ? 'Email already exists' : error.message;
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
  return NextResponse.json({ success: true, data }, { status: 201 });
}
