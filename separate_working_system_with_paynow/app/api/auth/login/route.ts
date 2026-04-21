import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { adminLoginSchema } from '@/lib/utils/validation';
import { signToken, COOKIE_NAME } from '@/lib/auth/jwt';
import { ZodError } from 'zod';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = adminLoginSchema.parse(body);

    const supabase = createServiceRoleClient();

    const { data: admin, error } = await supabase
      .from('admins')
      .select('id, email, name, role, password_hash, active')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !admin) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    if (!admin.active) {
      return NextResponse.json({ success: false, error: 'Account disabled' }, { status: 403 });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password_hash);
    if (!passwordMatch) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    // Update last login
    await supabase
      .from('admins')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', admin.id);

    const token = await signToken({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      name: admin.name,
    });

    // Log the login
    await supabase.from('logs').insert({
      type: 'login',
      level: 'info',
      message: `Admin login: ${admin.email}`,
      metadata: { adminId: admin.id },
    });

    const response = NextResponse.json({
      success: true,
      data: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
    });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8, // 8 hours
    });

    return response;
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: err.errors[0].message },
        { status: 400 }
      );
    }
    console.error('[auth/login]', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
