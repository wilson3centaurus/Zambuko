import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

function verifyHash(fields: Record<string, string>): boolean {
  const integrationKey = process.env.PAYNOW_INTEGRATION_KEY;
  if (!integrationKey) return false;
  const { hash: receivedHash, ...signedFields } = fields;
  if (!receivedHash) return false;

  const computedHash = crypto
    .createHash("md5")
    .update(Object.values(signedFields).join("") + integrationKey)
    .digest("hex")
    .toUpperCase();
  return computedHash === receivedHash.toUpperCase();
}

/**
 * Paynow server callback. Payment success is accepted only after the callback
 * hash is verified with the server-side integration key.
 */
export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return new Response("UNAVAILABLE", { status: 503 });

  const body = await req.text();
  if (body.length > 16_384) return new Response("REJECTED", { status: 413 });

  const params = new URLSearchParams(body);
  const fields: Record<string, string> = {};
  params.forEach((value, key) => { fields[key] = value; });
  if (!verifyHash(fields)) return new Response("REJECTED", { status: 400 });

  const reference = fields.reference;
  const providerStatus = fields.status?.toLowerCase();
  if (!reference || !providerStatus) return new Response("REJECTED", { status: 400 });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (providerStatus === "paid") {
    await admin
      .from("payments")
      .update({ status: "success", paid_at: new Date().toISOString() })
      .eq("id", reference)
      .eq("status", "pending");
  } else if (["cancelled", "failed", "disputed"].includes(providerStatus)) {
    await admin
      .from("payments")
      .update({ status: "failed", failure_reason: `Provider status: ${providerStatus}` })
      .eq("id", reference)
      .eq("status", "pending");
  }

  return new Response("OK", { headers: { "Content-Type": "text/plain" } });
}
