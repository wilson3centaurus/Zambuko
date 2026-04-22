import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => request.cookies.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove: (name: string, options: CookieOptions) => {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );
  const { data: { session } } = await supabase.auth.getSession();
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/")) return response;
  if (!session && !pathname.startsWith("/login") && !pathname.startsWith("/forgot-password") && !pathname.startsWith("/reset-password")) return NextResponse.redirect(new URL("/login", request.url));
  if (session && pathname === "/login") return NextResponse.redirect(new URL("/dashboard", request.url));
  if (session && !pathname.startsWith("/login")) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
    if (profile?.role !== "dispatcher") return NextResponse.redirect(new URL("/login?error=unauthorized", request.url));
  }
  return response;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-|icon.png|icon.svg|logo.svg|api/pwa-icon).*)"] };
