import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/require-admin";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * PATCH /api/admin/update-user
 * Body: { userId, email?, password? }
 * Updates auth email and/or password for any user via service role.
 */
export async function PATCH(req: NextRequest) {
  const authorization = await requireAdmin();
  if ("response" in authorization) return authorization.response;

  let payload: { userId?: string; email?: string; password?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const userId = payload.userId;
  const email = payload.email?.trim().toLowerCase();
  const password = payload.password;

  if (!userId || (!email && !password)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (password && password.length < 8) {
    return NextResponse.json({ error: "Password must contain at least 8 characters." }, { status: 400 });
  }

  const body: Record<string, string> = {};
  if (email) body.email = email;
  if (password) body.password = password;

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ ...body, email_confirm: true }),
  });

  const json = await res.json();

  if (!res.ok) {
    const msg = json?.msg ?? json?.error_description ?? json?.message ?? "Update failed";
    return NextResponse.json({ error: msg }, { status: res.status });
  }

  return NextResponse.json({ ok: true });
}
