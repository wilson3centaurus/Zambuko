// supabase/functions/payment-webhook/index.ts
// Handles Paynow Zimbabwe payment status callbacks
// verify_jwt = false — Paynow sends unsigned webhooks, we verify with MD5 hash

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std@0.208.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

// Verify Paynow MD5 hash to authenticate the webhook call
async function verifyPaynowHash(
  params: URLSearchParams,
  integrationKey: string
): Promise<boolean> {
  const fields = [...params.keys()].filter((k) => k !== "hash").sort();
  const rawString = fields.map((k) => params.get(k)).join("") + integrationKey;
  const hashBytes = await crypto.subtle.digest(
    "MD5",
    new TextEncoder().encode(rawString)
  );
  const expectedHash = encodeHex(new Uint8Array(hashBytes)).toUpperCase();
  return params.get("hash") === expectedHash;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const body = await req.text();
    const params = new URLSearchParams(body);

    const integrationKey = Deno.env.get("PAYNOW_INTEGRATION_KEY");
    if (!integrationKey) {
      console.error("PAYNOW_INTEGRATION_KEY not configured");
      return new Response("Server configuration error", { status: 500 });
    }

    // Authenticate the webhook
    const isValid = await verifyPaynowHash(params, integrationKey);
    if (!isValid) {
      console.warn("Invalid Paynow hash received — potential spoofing attempt");
      return new Response("Invalid signature", { status: 400 });
    }

    const status = params.get("status");           // 'Paid', 'Failed', 'Cancelled', 'Awaiting Delivery'
    const reference = params.get("reference");     // Our payment UUID
    const paynowRef = params.get("paynowreference");
    const amount = params.get("amount");

    if (!reference) {
      return new Response("Missing reference", { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (status === "Paid" || status === "Awaiting Delivery") {
      // Mark payment successful — trigger will handle consultation + notifications
      await supabase
        .from("payments")
        .update({
          status: "success",
          paynow_ref: paynowRef,
          paid_at: new Date().toISOString(),
        })
        .eq("id", reference)
        .eq("status", "pending"); // idempotent guard

    } else if (status === "Failed" || status === "Cancelled") {
      await supabase
        .from("payments")
        .update({
          status: "failed",
          failure_reason: status,
        })
        .eq("id", reference);

    } else if (status === "Refunded") {
      await supabase
        .from("payments")
        .update({ status: "refunded" })
        .eq("id", reference);
    }

    console.log(`Payment webhook processed: ${reference} → ${status}`);
    return new Response("OK", { status: 200 });

  } catch (error) {
    console.error("Payment webhook error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
});
