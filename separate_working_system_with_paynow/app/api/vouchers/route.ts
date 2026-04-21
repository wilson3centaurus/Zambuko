import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getAdminFromCookie } from '@/lib/auth/jwt';
import { generateVouchersSchema } from '@/lib/utils/validation';
import { generateVoucherCode, generateBatchId } from '@/lib/utils/voucher';
import { ZodError } from 'zod';

// GET /api/vouchers – list vouchers (admin only)
export async function GET(request: NextRequest) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status');
  const packageId = searchParams.get('packageId');
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
  const offset = parseInt(searchParams.get('offset') || '0');

  const supabase = createServiceRoleClient();
  let query = supabase
    .from('vouchers')
    .select('*, package:packages(id, name, price, duration_hours, speed_limit)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);
  if (packageId) query = query.eq('package_id', packageId);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, data, total: count });
}

// POST /api/vouchers – bulk generate vouchers (admin only)
export async function POST(request: NextRequest) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { packageId, quantity } = generateVouchersSchema.parse(body);

    // ── Voucher secret gate ───────────────────────────────────────────────────
    const supabase = createServiceRoleClient();
    const { data: secretRow } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'voucher_secret')
      .single();

    const requiredSecret = secretRow?.value ?? '';

    if (requiredSecret) {
      // A secret key is configured – all admins (including superadmin) must provide it
      if (!body.secret || body.secret !== requiredSecret) {
        return NextResponse.json({ success: false, error: 'Invalid voucher secret key' }, { status: 403 });
      }
    } else {
      // No secret configured – only superadmin may generate vouchers
      if (admin.role !== 'superadmin') {
        return NextResponse.json({
          success: false,
          error: 'No voucher secret key has been set. Ask a superadmin to configure one in Settings.',
        }, { status: 403 });
      }
    }

    // Verify package exists
    const { data: pkg, error: pkgError } = await supabase
      .from('packages')
      .select('id, name')
      .eq('id', packageId)
      .single();

    if (pkgError || !pkg) {
      return NextResponse.json({ success: false, error: 'Package not found' }, { status: 404 });
    }

    const batchId = generateBatchId();

    // Generate unique codes with collision avoidance
    const codes: string[] = [];
    let attempts = 0;
    while (codes.length < quantity && attempts < quantity * 3) {
      codes.push(generateVoucherCode());
      attempts++;
    }

    const vouchers = codes.slice(0, quantity).map((code) => ({
      code,
      package_id: packageId,
      batch_id: batchId,
      status: 'unused' as const,
    }));

    const { data, error } = await supabase
      .from('vouchers')
      .insert(vouchers)
      .select('id, code, package_id, status, created_at');

    if (error) {
      console.error('[vouchers/generate]', error);
      return NextResponse.json({ success: false, error: 'Failed to generate vouchers' }, { status: 500 });
    }

    await supabase.from('logs').insert({
      type: 'voucher',
      level: 'info',
      message: `Generated ${quantity} vouchers (batch: ${batchId}) for ${pkg.name}`,
      metadata: { batchId, quantity, packageId, adminId: admin.sub },
    });

    return NextResponse.json({ success: true, data: { batchId, vouchers: data, count: data?.length } }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ success: false, error: err.errors[0].message }, { status: 400 });
    }
    console.error('[vouchers/POST]', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
