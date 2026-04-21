import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Verify Paynow callback hash to prevent spoofing.
 * Hash = uppercase(MD5(all_field_values_except_hash + integrationKey))
 */
function verifyHash(fields: Record<string, string>): boolean {
  const key = process.env.PAYNOW_INTEGRATION_KEY;
  if (!key) return false;
  const { hash: receivedHash, ...rest } = fields;
  if (!receivedHash) return false;
  const computed = crypto
    .createHash("md5")
    .update(Object.values(rest).join("") + key)
    .digest("hex")
    .toUpperCase();
  return computed === receivedHash.toUpperCase();
}

/**
 * POST /api/payments/callback
 * Paynow posts status updates here after payment confirmation.
 * Must respond with plain-text "OK" to acknowledge receipt.
 */
export async function POST(req: NextRequest) {
  const text = await req.text();
  const params = new URLSearchParams(text);
  const fields: Record<string, string> = {};
  params.forEach((value, key) => { fields[key] = value; });

  if (!verifyHash(fields)) {
    console.warn("[payments/callback] Hash mismatch – rejected", fields);
    return new Response("REJECTED", { status: 400, headers: { "Content-Type": "text/plain" } });
  }

  const { reference, status } = fields;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const isPaid = status?.toLowerCase() === "paid";
  const isFailed = ["cancelled", "failed", "disputed"].includes(status?.toLowerCase() ?? "");

  if (isPaid) {
    await admin.from("payments").update({ status: "paid" }).eq("id", reference);
  } else if (isFailed) {
    await admin.from("payments").update({ status: "failed" }).eq("id", reference);
  }

  return new Response("OK", { headers: { "Content-Type": "text/plain" } });
}
