import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerSideClient } from "@zambuko/database/client";

/**
 * GET /api/payments/status/[id]
 * Polls Paynow for a payment owned by the authenticated patient.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Payment service is not configured." }, { status: 503 });
  }

  const userClient = createServerSideClient(cookies());
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: payment, error } = await admin
    .from("payments")
    .select("id, patient_id, status, paynow_poll_url, consultation_id")
    .eq("id", params.id)
    .eq("patient_id", user.id)
    .single();

  if (error || !payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  if (payment.status === "success") {
    return NextResponse.json({ status: "paid", consultation_id: payment.consultation_id });
  }
  if (["failed", "expired", "refunded"].includes(payment.status)) {
    return NextResponse.json({ status: "failed" });
  }

  if (payment.paynow_poll_url) {
    try {
      const pollResponse = await fetch(payment.paynow_poll_url, {
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      const pollText = await pollResponse.text();
      const pollStatus = new URLSearchParams(pollText).get("status")?.toLowerCase() ?? "pending";

      if (pollStatus === "paid") {
        await admin
          .from("payments")
          .update({ status: "success", paid_at: new Date().toISOString() })
          .eq("id", payment.id)
          .eq("status", "pending");
        return NextResponse.json({ status: "paid", consultation_id: payment.consultation_id });
      }
      if (["cancelled", "failed", "disputed"].includes(pollStatus)) {
        await admin
          .from("payments")
          .update({ status: "failed", failure_reason: `Provider status: ${pollStatus}` })
          .eq("id", payment.id)
          .eq("status", "pending");
        return NextResponse.json({ status: "failed" });
      }
    } catch {
      // A transient provider failure remains pending and can be polled again.
    }
  }

  return NextResponse.json({ status: "pending" });
}
