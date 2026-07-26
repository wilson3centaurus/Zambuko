import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!accessToken) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${accessToken}` },
  });
  if (!userResponse.ok) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const user = await userResponse.json() as { id: string; email?: string };

  await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      user_id: user.id,
      type: "consent_confirmation",
      title: "Health-data consent recorded",
      body: "Your Hutano health-data consent has been recorded. You can contact support to ask about your information rights.",
      data: { consent_version: "2026-07-25" },
      action_url: "/profile",
    }),
  });

  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.CONSENT_FROM_EMAIL;
  const replyToEmail = process.env.CONSENT_REPLY_TO_EMAIL;
  let emailSent = false;
  if (resendKey && fromEmail && user.email) {
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `consent-confirmation-${user.id}-2026-07-25`,
      },
      body: JSON.stringify({
        from: fromEmail,
        ...(replyToEmail ? { reply_to: replyToEmail } : {}),
        to: [user.email],
        subject: "Your Hutano consent confirmation",
        html: "<h1>Consent recorded</h1><p>Your informed consent for Hutano to process health and location information for care and emergency services has been recorded.</p><p>Consent version: 2026-07-25.</p><p>Contact Hutano support if you want to ask about access, correction, or deletion of your information.</p>",
      }),
    });
    emailSent = emailResponse.ok;
    if (!emailResponse.ok) {
      console.error("[consent-email] Resend rejected confirmation", {
        status: emailResponse.status,
        detail: (await emailResponse.text()).slice(0, 500),
      });
    }
  } else {
    console.warn("[consent-email] Confirmation email skipped because server configuration or recipient email is missing");
  }

  return NextResponse.json({ ok: true, emailSent });
}
