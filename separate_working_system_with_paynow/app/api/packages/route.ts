import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

// GET /api/packages – public endpoint: returns active packages for portal
export async function GET() {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('packages')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data: data ?? [] });
}
