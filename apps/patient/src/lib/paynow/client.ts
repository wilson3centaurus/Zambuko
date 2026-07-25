/**
 * Paynow mobile-money integration wrapper.
 * All credentials and provider responses remain server-side.
 */

import { Paynow } from "paynow";

export type MobileProvider = "ecocash" | "telecash" | "onemoney";

export interface MobilePaymentResult {
  success: boolean;
  pollUrl?: string;
  error?: string;
  instructions?: string;
}

function getClient() {
  const integrationId = process.env.PAYNOW_INTEGRATION_ID;
  const integrationKey = process.env.PAYNOW_INTEGRATION_KEY;
  const resultUrl = process.env.PAYNOW_RESULT_URL;
  const returnUrl = process.env.PAYNOW_RETURN_URL;
  if (!integrationId || !integrationKey || !resultUrl || !returnUrl) {
    throw new Error("Paynow is not configured.");
  }

  const client = new Paynow(integrationId, integrationKey);
  client.resultUrl = resultUrl;
  client.returnUrl = returnUrl;
  return client;
}

export async function initiateMobilePayment(opts: {
  reference: string;
  email: string;
  phone: string;
  amount: number;
  description: string;
  method: MobileProvider;
}): Promise<MobilePaymentResult> {
  const client = getClient();
  const payment = client.createPayment(opts.reference, opts.email);
  payment.add(opts.description, opts.amount);

  const response = await client.sendMobile(payment, opts.phone, opts.method);
  if (response.success) {
    return {
      success: true,
      pollUrl: response.pollUrl,
      instructions: response.instructions,
    };
  }

  return {
    success: false,
    error: response.error || "Payment initiation failed",
  };
}
