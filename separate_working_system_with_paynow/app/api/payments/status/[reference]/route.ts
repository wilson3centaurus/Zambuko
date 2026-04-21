import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { pollPaymentStatus } from '@/lib/paynow/client';
import { generateVoucherCode } from '@/lib/utils/voucher';
import { addHotspotUser, hoursToUptimeString } from '@/lib/mikrotik/client';
import { addHours } from 'date-fns';

// GET /api/payments/status/[reference]
export async function GET(
  request: NextRequest,
  { params }: { params: { reference: string } }
) {
  const { reference } = params;
  if (!reference || !reference.startsWith('CW-')) {
    return NextResponse.json({ success: false, error: 'Invalid reference' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data: transaction, error } = await supabase
    .from('transactions')
    .select('id, status, poll_url, voucher_id, package:packages(*), voucher:vouchers(code, expires_at)')
    .eq('reference', reference)
    .single();

  if (error || !transaction) {
    return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
  }

  // If already resolved, return cached state
  if (transaction.status === 'paid') {
    const voucher = Array.isArray(transaction.voucher) ? transaction.voucher[0] : transaction.voucher;
    return NextResponse.json({
      success: true,
      data: {
        status: 'paid',
        voucherCode: voucher?.code,
        expiresAt: voucher?.expires_at,
      },
    });
  }

  if (transaction.status === 'failed' || transaction.status === 'cancelled') {
    return NextResponse.json({ success: true, data: { status: transaction.status } });
  }

  // Poll Paynow for live status
  if (transaction.poll_url) {
    const poll = await pollPaymentStatus(transaction.poll_url);

    if (poll.paid) {
      // Check if the callback already handled it
      const { data: refreshed } = await supabase
        .from('transactions')
        .select('status, voucher:vouchers(code, expires_at)')
        .eq('reference', reference)
        .single();

      if (refreshed?.status === 'paid') {
        const voucher = Array.isArray(refreshed.voucher) ? refreshed.voucher[0] : refreshed.voucher;
        return NextResponse.json({
          success: true,
          data: { status: 'paid', voucherCode: voucher?.code, expiresAt: voucher?.expires_at },
        });
      }

      // Callback hasn't fired (e.g. localhost or unreachable result URL) – process inline
      const pkg = Array.isArray(transaction.package) ? transaction.package[0] : transaction.package;
      if (pkg) {
        const voucherCode = generateVoucherCode();
        const expiresAt = addHours(new Date(), pkg.duration_hours).toISOString();

        const { data: newVoucher } = await supabase
          .from('vouchers')
          .insert({ code: voucherCode, package_id: pkg.id, status: 'unused' })
          .select('id')
          .single();

        if (newVoucher) {
          await addHotspotUser(voucherCode, pkg.name, hoursToUptimeString(pkg.duration_hours));

          await supabase
            .from('vouchers')
            .update({ transaction_id: transaction.id })
            .eq('id', newVoucher.id);

          await supabase
            .from('transactions')
            .update({ status: 'paid', voucher_id: newVoucher.id })
            .eq('reference', reference);

          await supabase.from('logs').insert({
            type: 'payment',
            level: 'info',
            message: `Payment confirmed via poll: ${reference} – voucher ${voucherCode} issued`,
            metadata: { reference, voucherCode, packageId: pkg.id, source: 'poll' },
          });

          return NextResponse.json({
            success: true,
            data: { status: 'paid', voucherCode, expiresAt },
          });
        }
      }
    }

    if (['cancelled', 'failed'].includes(poll.status.toLowerCase())) {
      await supabase
        .from('transactions')
        .update({ status: 'failed' })
        .eq('reference', reference);
      return NextResponse.json({ success: true, data: { status: 'failed' } });
    }
  }

  return NextResponse.json({ success: true, data: { status: 'pending' } });
}
