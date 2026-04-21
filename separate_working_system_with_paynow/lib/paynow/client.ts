/**
 * Paynow EcoCash integration wrapper.
 * Docs: https://developers.paynow.co.zw
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Paynow } = require('paynow');
import crypto from 'crypto';

interface PaynowConfig {
  integrationId: string;
  integrationKey: string;
  resultUrl: string;
  returnUrl: string;
}

interface MobilePaymentResult {
  success: boolean;
  pollUrl?: string;
  error?: string;
  instructions?: string;
}

interface PollResult {
  paid: boolean;
  status: string;
  paynowReference?: string;
  amount?: number;
}

function getClient(config: PaynowConfig) {
  const client = new Paynow(config.integrationId, config.integrationKey);
  client.resultUrl = config.resultUrl;
  client.returnUrl = config.returnUrl;
  return client;
}

/**
 * Initiate a mobile money payment (EcoCash STK push).
 */
export async function initiateMobilePayment(opts: {
  reference: string;
  email: string;
  phone: string;
  amount: number;
  description: string;
}): Promise<MobilePaymentResult> {
  const config: PaynowConfig = {
    integrationId: process.env.PAYNOW_INTEGRATION_ID!,
    integrationKey: process.env.PAYNOW_INTEGRATION_KEY!,
    resultUrl: process.env.PAYNOW_RESULT_URL!,
    returnUrl: process.env.PAYNOW_RETURN_URL!,
  };

  const client = getClient(config);
  const payment = client.createPayment(opts.reference, opts.email);
  payment.add(opts.description, opts.amount);

  try {
    const response = await client.sendMobile(payment, opts.phone, 'ecocash');

    if (response.success) {
      return {
        success: true,
        pollUrl: response.pollUrl,
        instructions: response.instructions,
      };
    }

    return {
      success: false,
      error: response.error || 'Payment initiation failed',
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Poll Paynow for transaction status.
 */
export async function pollPaymentStatus(pollUrl: string): Promise<PollResult> {
  const config: PaynowConfig = {
    integrationId: process.env.PAYNOW_INTEGRATION_ID!,
    integrationKey: process.env.PAYNOW_INTEGRATION_KEY!,
    resultUrl: process.env.PAYNOW_RESULT_URL!,
    returnUrl: process.env.PAYNOW_RETURN_URL!,
  };

  const client = getClient(config);

  try {
    const status = await client.pollTransaction(pollUrl);
    return {
      paid: status.paid(),
      status: status.status,
      paynowReference: status.paynowReference,
      amount: status.amount,
    };
  } catch {
    return { paid: false, status: 'error' };
  }
}

/**
 * Verify the hash of an incoming Paynow callback to prevent spoofing.
 * Paynow hash = uppercase(MD5(values + integrationKey))
 * Field order: amount, reference, paynowreference, status, returnurl, hash (excluded from hash compute)
 */
export function verifyPaynowCallback(body: Record<string, string>): boolean {
  const integrationKey = process.env.PAYNOW_INTEGRATION_KEY;
  if (!integrationKey) return false;

  const { hash: receivedHash, ...fields } = body;
  if (!receivedHash) return false;

  // Build the string to hash: all field values concatenated in the order received, + key
  const fieldValues = Object.values(fields).join('');
  const computedHash = crypto
    .createHash('md5')
    .update(fieldValues + integrationKey)
    .digest('hex')
    .toUpperCase();

  return computedHash === receivedHash.toUpperCase();
}
