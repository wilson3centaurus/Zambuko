import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * POST /api/admin/create-user
 * Body: { email, password, role, full_name }
 * Returns: { userId }
 *
 * Requires service role key (server-side only — never exposed to client).
 */
export async function POST(req: NextRequest) {
  const { email, password, role, full_name } = await req.json();

  if (!email || !password || !role || !full_name) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!["doctor", "dispatcher"].includes(role)) {
    return NextResponse.json({ error: "Invalid role. Must be doctor or dispatcher." }, { status: 400 });
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, full_name },
    }),
  });

  const json = await res.json();

  if (!res.ok) {
    const msg = json?.msg ?? json?.error_description ?? json?.message ?? "Failed to create user";
    return NextResponse.json({ error: msg }, { status: res.status });
  }

  return NextResponse.json({ userId: json.id });
}
