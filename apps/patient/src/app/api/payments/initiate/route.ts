import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { initiateMobilePayment, type MobileProvider } from "@/lib/paynow/client";

const MOBILE_PROVIDERS = new Set<MobileProvider>(["ecocash", "onemoney", "telecash"]);

/**
 * POST /api/payments/initiate
 * Authenticates the patient and derives the doctor and fee from trusted data.
 */
export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return NextResponse.json({ error: "Payment service is not configured." }, { status: 503 });
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: { consultation_id?: string; provider?: MobileProvider; phone_number?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const consultationId = body.consultation_id;
    const provider = body.provider;
    const phone = body.phone_number?.replace(/^\+263/, "0").replace(/\s|-/g, "");
    if (!consultationId || !provider || !MOBILE_PROVIDERS.has(provider) || !phone) {
      return NextResponse.json({ error: "Consultation, provider, and phone number are required." }, { status: 400 });
    }
    if (!/^0[7-8]\d{8}$/.test(phone)) {
      return NextResponse.json({ error: "Enter a valid Zimbabwe mobile-money number." }, { status: 400 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: consultation, error: consultationError } = await admin
      .from("consultations")
      .select("id, patient_id, doctor_id, status")
      .eq("id", consultationId)
      .eq("patient_id", user.id)
      .single();

    if (consultationError || !consultation?.doctor_id) {
      return NextResponse.json({ error: "Consultation not found or no doctor is assigned." }, { status: 404 });
    }
    if (!["pending", "accepted"].includes(consultation.status)) {
      return NextResponse.json({ error: "This consultation is not awaiting payment." }, { status: 409 });
    }

    const [{ data: doctor, error: doctorError }, { data: existingPayment }] = await Promise.all([
      admin
        .from("doctors")
        .select("consultation_fee_usd")
        .eq("id", consultation.doctor_id)
        .single(),
      admin
        .from("payments")
        .select("id, status, paynow_poll_url")
        .eq("consultation_id", consultation.id)
        .eq("patient_id", user.id)
        .in("status", ["pending", "success"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (doctorError || !doctor) {
      return NextResponse.json({ error: "The doctor’s consultation fee is unavailable." }, { status: 409 });
    }
    if (existingPayment?.status === "success") {
      return NextResponse.json({ error: "This consultation has already been paid." }, { status: 409 });
    }
    if (existingPayment?.status === "pending" && existingPayment.paynow_poll_url) {
      return NextResponse.json({
        payment_id: existingPayment.id,
        poll_url: existingPayment.paynow_poll_url,
        message: "A payment request is already pending. Check your phone to complete it.",
      });
    }

    const amount = Number(doctor.consultation_fee_usd);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "The configured consultation fee is invalid." }, { status: 409 });
    }

    const platformFee = Number((amount * 0.1).toFixed(2));
    const doctorPayout = Number((amount - platformFee).toFixed(2));
    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .insert({
        consultation_id: consultation.id,
        patient_id: user.id,
        doctor_id: consultation.doctor_id,
        provider,
        amount_usd: amount,
        phone_number: phone,
        platform_fee_usd: platformFee,
        doctor_payout_usd: doctorPayout,
        status: "pending",
      })
      .select("id")
      .single();

    if (paymentError || !payment) {
      return NextResponse.json({ error: "Failed to create payment record." }, { status: 500 });
    }

    const result = await initiateMobilePayment({
      reference: payment.id,
      email: user.email ?? "patient@hutano.co.zw",
      phone,
      amount,
      description: `Hutano consultation ${payment.id}`,
      method: provider,
    });

    if (!result.success) {
      await admin
        .from("payments")
        .update({ status: "failed", failure_reason: result.error ?? "Provider initiation failed" })
        .eq("id", payment.id);
      return NextResponse.json({ error: result.error || "Payment initiation failed." }, { status: 502 });
    }

    await admin.from("payments").update({ paynow_poll_url: result.pollUrl }).eq("id", payment.id);
    return NextResponse.json({
      payment_id: payment.id,
      poll_url: result.pollUrl,
      amount,
      message: result.instructions || "Check your phone for a payment prompt and enter your PIN.",
    });
  } catch {
    return NextResponse.json({ error: "Payment service unavailable." }, { status: 500 });
  }
}
