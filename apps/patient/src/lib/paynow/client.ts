/**
 * Paynow mobile money integration wrapper.
 * Uses the official paynow SDK so hash computation is handled correctly.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Paynow } = require("paynow");

export type MobileProvider = "ecocash" | "telecash" | "onemoney";

export interface MobilePaymentResult {
  success: boolean;
  pollUrl?: string;
  error?: string;
  instructions?: string;
}

function getClient() {
  const client = new Paynow(
    process.env.PAYNOW_INTEGRATION_ID!,
    process.env.PAYNOW_INTEGRATION_KEY!,
  );
  client.resultUrl = process.env.PAYNOW_RESULT_URL!;
  client.returnUrl = process.env.PAYNOW_RETURN_URL!;
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

  console.log("[paynow/sdk] initiating mobile payment:", {
    reference: opts.reference,
    email: opts.email,
    phone: opts.phone,
    amount: opts.amount,
    method: opts.method,
    resultUrl: client.resultUrl,
    returnUrl: client.returnUrl,
    integrationId: process.env.PAYNOW_INTEGRATION_ID,
  });

  const response = await client.sendMobile(payment, opts.phone, opts.method);

  console.log("[paynow/sdk] raw response:", JSON.stringify(response));

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

