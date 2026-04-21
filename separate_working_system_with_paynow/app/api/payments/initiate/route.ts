import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { paymentInitiateSchema } from '@/lib/utils/validation';
import { normalisePhone } from '@/lib/utils/validation';
import { generatePaymentReference, generateVoucherCode } from '@/lib/utils/voucher';
import { initiateMobilePayment } from '@/lib/paynow/client';
import { ZodError } from 'zod';

// POST /api/payments/initiate
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone: rawPhone, packageId } = paymentInitiateSchema.parse(body);
    const phone = normalisePhone(rawPhone);

    const supabase = createServiceRoleClient();

    // Verify package
    const { data: pkg, error: pkgError } = await supabase
      .from('packages')
      .select('id, name, price, duration_hours')
      .eq('id', packageId)
      .eq('active', true)
      .single();

    if (pkgError || !pkg) {
      return NextResponse.json({ success: false, error: 'Package not available' }, { status: 404 });
    }

    const reference = generatePaymentReference();

    // Create pending transaction record first
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        reference,
        phone,
        amount: pkg.price,
        package_id: packageId,
        status: 'pending',
      })
      .select('id')
      .single();

    if (txError || !transaction) {
      console.error('[payments/initiate] insert error:', txError);
      return NextResponse.json({ success: false, error: 'Failed to create transaction' }, { status: 500 });
    }

    // Trigger EcoCash STK push via Paynow
    const result = await initiateMobilePayment({
      reference,
      email: `${phone}@connectwifi.co.zw`,
      phone,
      amount: pkg.price,
      description: `Connect WiFi – ${pkg.name}`,
    });

    if (!result.success) {
      // Mark transaction as failed
      await supabase
        .from('transactions')
        .update({ status: 'failed' })
        .eq('id', transaction.id);

      return NextResponse.json(
        { success: false, error: result.error || 'Payment initiation failed' },
        { status: 502 }
      );
    }

    // Store poll URL
    await supabase
      .from('transactions')
      .update({ poll_url: result.pollUrl })
      .eq('id', transaction.id);

    await supabase.from('logs').insert({
      type: 'payment',
      level: 'info',
      message: `Payment initiated: ${reference} for ${phone}`,
      metadata: { reference, phone, packageId, amount: pkg.price },
    });

    return NextResponse.json({
      success: true,
      data: {
        reference,
        pollInterval: 5000,
        message: result.instructions || 'Check your phone for an EcoCash prompt and enter your PIN.',
      },
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ success: false, error: err.errors[0].message }, { status: 400 });
    }
    console.error('[payments/initiate]', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
