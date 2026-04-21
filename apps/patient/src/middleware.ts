import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // API routes are never auth-gated — always pass through
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return response;
  }

  const isAuthRoute = request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/verify") ||
    request.nextUrl.pathname.startsWith("/register") ||
    request.nextUrl.pathname.startsWith("/forgot-password") ||
    request.nextUrl.pathname.startsWith("/reset-password");

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Role guard — only patients can use this app
  if (user && !isAuthRoute) {
    const role = user.user_metadata?.role ?? "patient";
    if (role !== "patient") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      await supabase.auth.signOut();
      return NextResponse.redirect(url);
    }
  }

  if (user && isAuthRoute) {
    const role = user.user_metadata?.role ?? "patient";
    // Non-patients on auth routes: sign them out instead of bouncing to dashboard
    if (role !== "patient") {
      await supabase.auth.signOut();
      return response;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|screenshots/|sw.js|workbox-).*)",
  ],
};
