declare module "paynow" {
  type MobileMethod = "ecocash" | "telecash" | "onemoney";

  type Payment = {
    add(description: string, amount: number): void;
  };

  type MobileResponse = {
    success: boolean;
    pollUrl?: string;
    instructions?: string;
    error?: string;
  };

  export class Paynow {
    constructor(integrationId: string, integrationKey: string);
    resultUrl: string;
    returnUrl: string;
    createPayment(reference: string, email: string): Payment;
    sendMobile(payment: Payment, phone: string, method: MobileMethod): Promise<MobileResponse>;
  }
}
