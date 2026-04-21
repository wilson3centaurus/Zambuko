// packages/database/src/client.ts
// Supabase client factory — use these in Next.js App Router

import { createBrowserClient } from "@supabase/ssr";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

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
