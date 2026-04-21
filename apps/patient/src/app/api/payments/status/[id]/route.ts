import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/payments/status/[id]
 * Polls the Paynow status for a payment and returns the current state.
 * Called by the book page every 5 seconds after initiating a mobile payment.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: "Missing payment ID" }, { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: payment, error } = await admin
    .from("payments")
    .select("id, status, paynow_poll_url, consultation_id")
    .eq("id", id)
    .single();

  if (error || !payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  // Already resolved — return cached state immediately
  if (payment.status === "paid") {
    return NextResponse.json({ status: "paid", consultation_id: payment.consultation_id });
  }
  if (payment.status === "failed") {
    return NextResponse.json({ status: "failed" });
  }

  // Poll Paynow live via a plain GET to the poll URL
  if (payment.paynow_poll_url) {
    try {
      const pollResp = await fetch(payment.paynow_poll_url);
      const pollText = await pollResp.text();
      const pollParams = new URLSearchParams(pollText);
      const pollStatus = pollParams.get("status")?.toLowerCase() ?? "pending";

      if (pollStatus === "paid") {
        await admin.from("payments").update({ status: "paid" }).eq("id", id);
        return NextResponse.json({ status: "paid", consultation_id: payment.consultation_id });
      }
      if (pollStatus === "cancelled" || pollStatus === "failed") {
        await admin.from("payments").update({ status: "failed" }).eq("id", id);
        return NextResponse.json({ status: "failed" });
      }
    } catch (err) {
      console.error("[payments/status] poll error:", err);
    }
  }

  return NextResponse.json({ status: "pending" });
}

