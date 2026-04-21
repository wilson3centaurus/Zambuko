// supabase/functions/initiate-payment/index.ts
// Initiates a Paynow Zimbabwe payment for a consultation
// Returns a redirect URL for EcoCash / OneMoney / Telecash

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std@0.208.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentRequest {
  consultation_id: string;
  doctor_id: string;
  amount_usd: number;
  provider: "ecocash" | "onemoney" | "telecash";
  phone_number: string; // e.g. 0771234567
}

// Paynow payment method codes
const PAYNOW_METHODS: Record<string, string> = {
  ecocash: "ecocash",
  onemoney: "onemoney",
  telecash: "telecash",
};

async function buildPaynowHash(values: string[], integrationKey: string): Promise<string> {
  const raw = values.join("") + integrationKey;
  const hashBytes = await crypto.subtle.digest("MD5", new TextEncoder().encode(raw));
  return encodeHex(new Uint8Array(hashBytes)).toUpperCase();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: PaymentRequest = await req.json();

    // Validate inputs
    if (!body.consultation_id || !body.doctor_id || !body.amount_usd || !body.provider || !body.phone_number) {
      return new Response(JSON.stringify({ error: "Missing required payment fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.amount_usd <= 0) {
      return new Response(JSON.stringify({ error: "Amount must be greater than 0" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Create payment record to get UUID (used as Paynow reference)
    const { data: payment, error: paymentError } = await adminClient
      .from("payments")
      .insert({
        consultation_id: body.consultation_id,
        patient_id: user.id,
        doctor_id: body.doctor_id,
        provider: body.provider,
        amount_usd: body.amount_usd,
        phone_number: body.phone_number,
        status: "pending",
      })
      .select("id")
      .single();

    if (paymentError || !payment) {
      console.error("Failed to create payment record:", paymentError);
      return new Response(JSON.stringify({ error: "Failed to initiate payment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const integrationId = Deno.env.get("PAYNOW_INTEGRATION_ID")!;
    const integrationKey = Deno.env.get("PAYNOW_INTEGRATION_KEY")!;
    const returnUrl = `${Deno.env.get("PATIENT_APP_URL")}/payment/${payment.id}/callback`;
    const resultUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/payment-webhook`;
    const reference = payment.id;
    const amount = body.amount_usd.toFixed(2);
    const email = user.email ?? "patient@zambuko.co.zw";
    const description = `Zambuko Consultation - ${reference}`;
    const phone = body.phone_number.replace(/^\+263/, "0").replace(/\s/g, "");
    const method = PAYNOW_METHODS[body.provider] ?? "ecocash";

    // Build Paynow initiate transaction request
    const fields: Record<string, string> = {
      id: integrationId,
      reference,
      amount,
      additionalinfo: description,
      returnurl: returnUrl,
      resulturl: resultUrl,
      status: "Message",
      phone,
      method,
    };

    // Hash: id + reference + amount + additionalinfo + returnurl + resulturl + status + key
    // Note: phone and method are NOT included in the hash per Paynow mobile docs
    const hashValues = [
      fields.id, fields.reference, fields.amount, fields.additionalinfo,
      fields.returnurl, fields.resulturl, fields.status,
    ];
    fields.hash = await buildPaynowHash(hashValues, integrationKey);

    // Initiate payment on Paynow (mobile money express checkout)
    const paynowEndpoint = "https://www.paynow.co.zw/interface/remotetransaction";
    const formBody = new URLSearchParams(fields).toString();

    const paynowResp = await fetch(paynowEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody,
    });

    const paynowText = await paynowResp.text();
    const paynowParams = new URLSearchParams(paynowText);
    const paynowStatus = paynowParams.get("status");

    if (paynowStatus !== "Ok") {
      const errorMsg = paynowParams.get("error") ?? "Payment gateway error";
      await adminClient.from("payments").update({ status: "failed", failure_reason: errorMsg }).eq("id", payment.id);
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const redirectUrl = paynowParams.get("browserurl");
    const pollUrl = paynowParams.get("pollurl");

    // Save poll URL for status checking
    await adminClient
      .from("payments")
      .update({ paynow_poll_url: pollUrl })
      .eq("id", payment.id);

    return new Response(
      JSON.stringify({
        payment_id: payment.id,
        redirect_url: redirectUrl,
        poll_url: pollUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Payment initiation error:", error);
    return new Response(JSON.stringify({ error: "Payment service unavailable" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
