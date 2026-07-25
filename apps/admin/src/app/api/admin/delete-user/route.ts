import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/server/require-admin";

/**
 * DELETE /api/admin/delete-user
 *
 * Healthcare records are retained for auditability. This endpoint archives
 * the profile and blocks authentication instead of deleting linked clinical
 * records or the auth identity.
 */
export async function DELETE(req: NextRequest) {
  const authorization = await requireAdmin();
  if ("response" in authorization) return authorization.response;

  let payload: { userId?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const userId = payload.userId;
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }
  if (userId === authorization.user.id) {
    return NextResponse.json({ error: "You cannot archive your own administrator account." }, { status: 409 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Administration service is not configured." }, { status: 503 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .single();
  if (profileError || !profile) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const { error: archiveError } = await admin
    .from("profiles")
    .update({ is_active: false })
    .eq("id", userId);
  if (archiveError) {
    return NextResponse.json({ error: "The account could not be archived." }, { status: 500 });
  }

  if (profile.role === "doctor") {
    await admin.from("doctors").update({ status: "offline" }).eq("id", userId);
  } else if (profile.role === "dispatcher") {
    await admin.from("dispatchers").update({ status: "offline" }).eq("id", userId);
  }

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "apikey": serviceRoleKey,
      "Authorization": `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ ban_duration: "876000h" }),
  });

  if (!authResponse.ok) {
    await admin.from("profiles").update({ is_active: true }).eq("id", userId);
    return NextResponse.json({ error: "The account login could not be disabled." }, { status: 502 });
  }

  await admin.from("audit_logs").insert({
    user_id: authorization.user.id,
    action: "account_archived",
    table_name: "profiles",
    record_id: userId,
    new_data: { is_active: false, archived_role: profile.role },
  });

  return NextResponse.json({ ok: true, archived: true });
}
