import { NextResponse } from 'next/server';
import { getAdminFromCookie } from '@/lib/auth/jwt';

export async function GET() {
  const admin = await getAdminFromCookie();
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthenticated' }, { status: 401 });
  }
  return NextResponse.json({
    success: true,
    data: { id: admin.sub, email: admin.email, name: admin.name, role: admin.role },
  });
}
