import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/admin/get-user?userId=<uuid>
 * Returns the auth user object (email, created_at, last_sign_in_at, etc.)
 * using the service role key — only callable from the admin server.
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    headers: {
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch user" }, { status: res.status });
  }

  const user = await res.json();
  // Return only what the UI needs — avoid leaking unnecessary data
  return NextResponse.json({
    email: user.email ?? null,
    created_at: user.created_at ?? null,
    last_sign_in_at: user.last_sign_in_at ?? null,
    email_confirmed_at: user.email_confirmed_at ?? null,
  });
}
