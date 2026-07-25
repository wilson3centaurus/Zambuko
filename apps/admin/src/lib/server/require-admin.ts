import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerSideClient } from "@zambuko/database/client";

export async function requireAdmin() {
  const supabase = createServerSideClient(cookies());
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { response: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "admin" || profile.is_active === false) {
    return { response: NextResponse.json({ error: "Administrator access required." }, { status: 403 }) };
  }

  return { user };
}
