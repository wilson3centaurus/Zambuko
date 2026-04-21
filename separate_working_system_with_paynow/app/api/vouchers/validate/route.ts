import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { voucherValidateSchema } from '@/lib/utils/validation';
import { normaliseVoucherCode } from '@/lib/utils/voucher';
import { addHotspotUser, hoursToUptimeString, buildMikrotikLoginUrl } from '@/lib/mikrotik/client';
import { ZodError } from 'zod';
import { addHours } from 'date-fns';

// POST /api/vouchers/validate
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code: rawCode, mac, ip, deviceName } = voucherValidateSchema.parse(body);

    const code = normaliseVoucherCode(rawCode);
    const supabase = createServiceRoleClient();

    // Fetch voucher + package
    const { data: voucher, error } = await supabase
      .from('vouchers')
      .select('*, package:packages(*)')
      .eq('code', code)
      .single();

    if (error || !voucher) {
      return NextResponse.json({ success: false, error: 'Voucher not found' }, { status: 404 });
    }

    if (voucher.status === 'disabled') {
      return NextResponse.json({ success: false, error: 'Voucher has been disabled' }, { status: 403 });
    }

    if (voucher.status === 'expired') {
      return NextResponse.json({ success: false, error: 'Voucher has expired' }, { status: 410 });
    }

    if (voucher.status === 'active') {
      // Allow re-auth from same MAC (user changed IP, etc.)
      if (mac && voucher.user_mac && voucher.user_mac !== mac) {
        return NextResponse.json({ success: false, error: 'Voucher already in use on another device' }, { status: 409 });
      }
      // Return existing session info
      return NextResponse.json({
        success: true,
        data: {
          voucher: { id: voucher.id, code: voucher.code, expires_at: voucher.expires_at, status: voucher.status },
          package: voucher.package,
          mikrotikRedirectUrl: buildMikrotikLoginUrl(
            process.env.MIKROTIK_HOST || '192.168.88.1',
            code,
            code
          ),
        },
      });
    }

    // ── Activate the voucher ──────────────────────────────────
    const pkg = voucher.package;
    const expiresAt = addHours(new Date(), pkg.duration_hours).toISOString();

    // Add user to MikroTik
    const uptimeStr = hoursToUptimeString(pkg.duration_hours);
    const mikrotikUserId = await addHotspotUser(code, pkg.name, uptimeStr);

    // Update voucher record
    const { error: updateError } = await supabase
      .from('vouchers')
      .update({
        status: 'active',
        used_at: new Date().toISOString(),
        expires_at: expiresAt,
        user_mac: mac ?? null,
        user_ip: ip ?? null,
        device_name: deviceName ?? null,
        mikrotik_user_id: mikrotikUserId,
      })
      .eq('id', voucher.id);

    if (updateError) {
      console.error('[vouchers/validate] update error:', updateError);
      return NextResponse.json({ success: false, error: 'Failed to activate voucher' }, { status: 500 });
    }

    // Create session record
    await supabase.from('sessions').insert({
      voucher_id: voucher.id,
      mac_address: mac ?? null,
      ip_address: ip ?? null,
      device_name: deviceName ?? null,
      start_time: new Date().toISOString(),
      end_time: expiresAt,
      active: true,
      mikrotik_session_id: mikrotikUserId,
    });

    await supabase.from('logs').insert({
      type: 'login',
      level: 'info',
      message: `Voucher activated: ${code}`,
      metadata: { voucherId: voucher.id, mac, ip, packageName: pkg.name },
    });

    return NextResponse.json({
      success: true,
      data: {
        voucher: { id: voucher.id, code, expires_at: expiresAt, status: 'active' },
        package: { name: pkg.name, duration_hours: pkg.duration_hours, speed_limit: pkg.speed_limit },
        mikrotikRedirectUrl: buildMikrotikLoginUrl(
          process.env.MIKROTIK_HOST || '192.168.88.1',
          code,
          code
        ),
      },
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ success: false, error: err.errors[0].message }, { status: 400 });
    }
    console.error('[vouchers/validate]', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
