import { NextResponse, type NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';

const ADMIN_PATHS = ['/admin/dashboard'];
const PUBLIC_ADMIN_PATHS = ['/admin/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Admin route protection ────────────────────────────────
  const isAdminPath = pathname.startsWith('/admin');
  const isPublicAdminPath = PUBLIC_ADMIN_PATHS.some((p) => pathname.startsWith(p));

  if (isAdminPath && !isPublicAdminPath) {
    const token = request.cookies.get('connect_admin_token')?.value;

    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    const payload = await verifyToken(token);
    if (!payload) {
      const response = NextResponse.redirect(new URL('/admin/login', request.url));
      response.cookies.delete('connect_admin_token');
      return response;
    }

    // Inject admin identity into headers for downstream route handlers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-admin-id', payload.sub);
    requestHeaders.set('x-admin-email', payload.email);
    requestHeaders.set('x-admin-role', payload.role);

    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── Redirect already-authed admins away from login page ───
  if (isPublicAdminPath) {
    const token = request.cookies.get('connect_admin_token')?.value;
    if (token) {
      const payload = await verifyToken(token);
      if (payload) {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
