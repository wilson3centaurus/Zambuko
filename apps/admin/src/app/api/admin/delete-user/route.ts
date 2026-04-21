import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** Helper: call Supabase REST API with service role */
async function pgPatch(table: string, set: Record<string, unknown>, matchCol: string, matchVal: string) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?${matchCol}=eq.${encodeURIComponent(matchVal)}`,
    {
      method: "PATCH",
      headers: {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify(set),
    }
  );
  return res;
}

/**
 * DELETE /api/admin/delete-user
 * Body: { userId }
 * Nullifies FK references then hard-deletes the user from Supabase auth.
 */
export async function DELETE(req: NextRequest) {
  const { userId } = await req.json();

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  // Nullify all FK references before deleting the profile/auth user
  await Promise.all([
    pgPatch("consultations", { doctor_id: null }, "doctor_id", userId),
    pgPatch("prescriptions", { doctor_id: null }, "doctor_id", userId),
    pgPatch("emergencies", { dispatcher_id: null }, "dispatcher_id", userId),
  ]);

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: {
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });

  if (!res.ok) {
    let msg = "Delete failed";
    try {
      const json = await res.json();
      msg = json?.msg ?? json?.error_description ?? json?.message ?? msg;
    } catch {}
    return NextResponse.json({ error: msg }, { status: res.status });
  }

  return NextResponse.json({ ok: true });
}
