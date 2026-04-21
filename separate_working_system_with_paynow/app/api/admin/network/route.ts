import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getAdminFromCookie } from '@/lib/auth/jwt';
import { updatePackageSchema, createPackageSchema } from '@/lib/utils/validation';
import { ZodError } from 'zod';

// GET /api/admin/network – list packages (for network control)
export async function GET(request: NextRequest) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('packages')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, data });
}

// POST /api/admin/network – create a new package
export async function POST(request: NextRequest) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const data = createPackageSchema.parse(body);

    const supabase = createServiceRoleClient();

    const { data: maxOrder } = await supabase
      .from('packages')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const sort_order = (maxOrder?.sort_order ?? 0) + 1;

    const { data: pkg, error } = await supabase
      .from('packages')
      .insert({ ...data, sort_order })
      .select()
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    await supabase.from('logs').insert({
      type: 'network',
      level: 'info',
      message: `Package "${data.name}" created`,
      metadata: { pkg, adminId: admin.sub },
    });

    return NextResponse.json({ success: true, data: pkg }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ success: false, error: err.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

// PATCH /api/admin/network – update a package's network settings
export async function PATCH(request: NextRequest) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const { id, ...rest } = await request.json();
    if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

    const updates = updatePackageSchema.parse(rest);
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const { error } = await supabase.from('packages').update(updates).eq('id', id);

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    await supabase.from('logs').insert({
      type: 'network',
      level: 'info',
      message: `Package ${id} updated`,
      metadata: { id, updates, adminId: admin.sub },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ success: false, error: err.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
