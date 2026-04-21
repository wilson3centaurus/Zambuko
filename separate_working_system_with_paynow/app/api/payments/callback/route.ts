import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { verifyPaynowCallback } from '@/lib/paynow/client';
import { generateVoucherCode } from '@/lib/utils/voucher';
import { addHotspotUser, hoursToUptimeString } from '@/lib/mikrotik/client';
import { addHours } from 'date-fns';

/**
 * POST /api/payments/callback
 * Paynow posts status updates here (the resultUrl).
 * Must respond with "OK" (plain text) to acknowledge receipt.
 *
 * Security: we verify the MD5 hash Paynow sends to prevent spoofing.
 */
export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';

  let fields: Record<string, string> = {};

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await request.text();
    const params = new URLSearchParams(text);
    params.forEach((value, key) => { fields[key] = value; });
  } else {
    fields = await request.json();
  }

  // ── Hash verification ─────────────────────────────────────
  if (!verifyPaynowCallback(fields)) {
    console.warn('[payments/callback] Hash mismatch – possible spoofing attempt', fields);
    await createServiceRoleClient().from('logs').insert({
      type: 'payment',
      level: 'warn',
      message: 'Paynow callback hash mismatch – rejected',
      metadata: fields,
    });
    return new Response('REJECTED', { status: 400, headers: { 'Content-Type': 'text/plain' } });
  }

  const { reference, paynowreference, status, amount } = fields;
  const supabase = createServiceRoleClient();

  // Fetch the pending transaction
  const { data: transaction } = await supabase
    .from('transactions')
    .select('*, package:packages(*)')
    .eq('reference', reference)
    .single();

  if (!transaction) {
    console.error('[payments/callback] Unknown reference:', reference);
    return new Response('OK', { headers: { 'Content-Type': 'text/plain' } });
  }

  const isPaid = status?.toLowerCase() === 'paid';

  if (isPaid && transaction.status !== 'paid') {
    const pkg = transaction.package;

    // Generate and activate voucher
    const voucherCode = generateVoucherCode();
    const expiresAt = addHours(new Date(), pkg.duration_hours).toISOString();

    // Insert voucher
    const { data: voucher } = await supabase
      .from('vouchers')
      .insert({
        code: voucherCode,
        package_id: pkg.id,
        status: 'unused',
      })
      .select('id')
      .single();

    if (voucher) {
      // Create MikroTik user (will be activated when user logs in with the voucher)
      await addHotspotUser(voucherCode, pkg.name, hoursToUptimeString(pkg.duration_hours));

      // Mark voucher as linked to this transaction
      await supabase
        .from('vouchers')
        .update({ transaction_id: transaction.id })
        .eq('id', voucher.id);

      // Mark transaction as paid, link voucher
      await supabase
        .from('transactions')
        .update({
          status: 'paid',
          paynow_reference: paynowreference,
          voucher_id: voucher.id,
          raw_callback: fields,
        })
        .eq('reference', reference);

      await supabase.from('logs').insert({
        type: 'payment',
        level: 'info',
        message: `Payment confirmed: ${reference} – voucher ${voucherCode} issued`,
        metadata: { reference, paynowreference, amount, voucherCode, packageId: pkg.id },
      });
    }
  } else if (['cancelled', 'failed', 'disputed'].includes(status?.toLowerCase() ?? '')) {
    await supabase
      .from('transactions')
      .update({ status: 'failed', raw_callback: fields })
      .eq('reference', reference);
  }

  return new Response('OK', { headers: { 'Content-Type': 'text/plain' } });
}
