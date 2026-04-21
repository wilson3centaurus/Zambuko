import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { initiateMobilePayment, type MobileProvider } from "@/lib/paynow/client";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * POST /api/payments/initiate
 * Initiates a Paynow mobile money STK push for a consultation.
 */
export async function POST(req: NextRequest) {
  console.log("[payments/initiate] ── request received ──");
  try {
    // Authenticate via Supabase Bearer token
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      console.error("[payments/initiate] no auth header");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUser = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) {
      console.error("[payments/initiate] auth failed:", authErr);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("[payments/initiate] authenticated user:", user.id, user.email);

    const body = await req.json();
    console.log("[payments/initiate] request body:", JSON.stringify(body));
    const { consultation_id, doctor_id, amount, provider, phone_number } = body;

    if (!consultation_id || !doctor_id || !amount || !provider || !phone_number) {
      console.error("[payments/initiate] missing fields:", { consultation_id, doctor_id, amount, provider, phone_number });
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Create payment record
    const { data: payment, error: payErr } = await admin
      .from("payments")
      .insert({
        consultation_id,
        patient_id: user.id,
        doctor_id,
        provider,
        amount_usd: amount,
        phone_number,
        status: "pending",
      })
      .select("id")
      .single();

    if (payErr || !payment) {
      console.error("[payments/initiate] payment record insert error:", payErr);
      return NextResponse.json({ error: "Failed to create payment record" }, { status: 500 });
    }
    console.log("[payments/initiate] payment record created:", payment.id);

    const phone = phone_number.replace(/^\+263/, "0").replace(/\s/g, "");
    const email = user.email ?? `patient@hutano.co.zw`;
    const description = `Hutano Consultation - ${payment.id}`;
    const method: MobileProvider =
      provider === "onemoney" ? "onemoney"
      : provider === "telecash" ? "telecash"
      : "ecocash";

    console.log("[payments/initiate] calling initiateMobilePayment:", { reference: payment.id, email, phone, amount, description, method });

    const result = await initiateMobilePayment({
      reference: payment.id,
      email,
      phone,
      amount: Number(amount),
      description,
      method,
    });

    console.log("[payments/initiate] initiateMobilePayment result:", JSON.stringify(result));

    if (!result.success) {
      await admin.from("payments").update({ status: "failed" }).eq("id", payment.id);
      return NextResponse.json({ error: result.error || "Payment initiation failed" }, { status: 502 });
    }

    await admin.from("payments").update({ paynow_poll_url: result.pollUrl }).eq("id", payment.id);
    console.log("[payments/initiate] ✓ success, pollUrl:", result.pollUrl);

    return NextResponse.json({
      payment_id: payment.id,
      poll_url: result.pollUrl,
      message: result.instructions || "Check your phone for a payment prompt and enter your PIN.",
    });
  } catch (err) {
    console.error("[payments/initiate] unhandled error:", err);
    return NextResponse.json({ error: "Payment service unavailable" }, { status: 500 });
  }
}

