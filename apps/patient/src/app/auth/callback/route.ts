import { createServerSideClient } from "@zambuko/database/client";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/reset-password";
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const supabase = createServerSideClient(cookies());

  const result = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" })
      : { error: new Error("The recovery link is missing its verification token.") };

  const destination = new URL(next, url.origin);
  if (result.error) destination.searchParams.set("error", result.error.message);
  return NextResponse.redirect(destination);
}
