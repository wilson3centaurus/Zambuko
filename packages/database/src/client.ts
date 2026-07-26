// packages/database/src/client.ts
// Supabase client factory — use these in Next.js App Router

import { createBrowserClient } from "@supabase/ssr";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Minimal cookie store interface compatible with next/headers cookies()
interface ReadonlyCookieStore {
  get(name: string): { value: string } | undefined;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser client — for React components and client hooks
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Establishes a password-recovery session from every URL format Supabase may
 * send: PKCE codes, token hashes, or legacy implicit-flow hash tokens.
 */
export async function establishPasswordRecoverySession(
  supabase: SupabaseClient
) {
  const url = new URL(window.location.href);
  const query = url.searchParams;
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const providerError =
    query.get("error_description") ??
    query.get("error") ??
    hash.get("error_description") ??
    hash.get("error");

  if (providerError) {
    return { session: null, error: new Error(providerError) };
  }

  const code = query.get("code");
  const tokenHash = query.get("token_hash");
  const type = query.get("type");
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");

  let error: Error | null = null;

  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    error = result.error;
  } else if (tokenHash && type === "recovery") {
    const result = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });
    error = result.error;
  } else if (accessToken && refreshToken) {
    const result = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    error = result.error;
  }

  if (error) return { session: null, error };

  const result = await supabase.auth.getSession();
  if (result.error) return { session: null, error: result.error };

  if (result.data.session && (url.search || url.hash)) {
    window.history.replaceState({}, "", url.pathname);
  }

  return { session: result.data.session, error: null };
}

// Server client — for Server Components, Route Handlers, Server Actions
export function createServerSideClient(cookieStore: ReadonlyCookieStore) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          // @ts-expect-error — cookieStore.set exists in Route Handlers
          cookieStore.set({ name, value, ...options });
        } catch {
          // In Server Components, set is a no-op (handled by middleware)
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          // @ts-expect-error — cookieStore.set exists in Route Handlers
          cookieStore.set({ name, value: "", ...options });
        } catch {
          // No-op in Server Components
        }
      },
    },
  });
}

// Middleware client — for Next.js middleware.ts
export { createServerClient } from "@supabase/ssr";
