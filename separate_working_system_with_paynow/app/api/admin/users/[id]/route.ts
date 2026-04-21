import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getAdminFromCookie } from '@/lib/auth/jwt';
import bcrypt from 'bcryptjs';

// PATCH /api/admin/users/[id] – update admin (superadmin can edit any; admin can only edit themselves)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await getAdminFromCookie();
  if (!me) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const isSelf = me.sub === params.id;
  const isSuperAdmin = me.role === 'superadmin';

  if (!isSelf && !isSuperAdmin) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.name) updates.name = body.name;
  if (body.email) updates.email = body.email;
  if (body.avatar_url !== undefined) updates.avatar_url = body.avatar_url;
  if (body.password) {
    if (body.password.length < 8) {
      return NextResponse.json({ success: false, error: 'Password must be at least 8 characters' }, { status: 400 });
    }
    updates.password_hash = await bcrypt.hash(body.password, 12);
  }
  // Only superadmin can toggle active
  if (isSuperAdmin && !isSelf && typeof body.active === 'boolean') {
    updates.active = body.active;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('admins')
    .update(updates)
    .eq('id', params.id)
    .select('id, email, name, role, active, avatar_url, last_login_at, created_at')
    .single();

  if (error) {
    const msg = error.code === '23505' ? 'Email already exists' : error.message;
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
  return NextResponse.json({ success: true, data });
}

// DELETE /api/admin/users/[id] – delete admin (superadmin only, cannot delete self)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await getAdminFromCookie();
  if (!me) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  if (me.role !== 'superadmin') return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  if (me.sub === params.id) return NextResponse.json({ success: false, error: 'Cannot delete your own account' }, { status: 400 });

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from('admins').delete().eq('id', params.id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
