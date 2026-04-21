import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getAdminFromCookie } from '@/lib/auth/jwt';
import { startOfDay, startOfWeek, startOfMonth, subDays, format } from 'date-fns';

// GET /api/admin/stats
export async function GET(request: NextRequest) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceRoleClient();
  const now = new Date();
  const todayStart = startOfDay(now).toISOString();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
  const monthStart = startOfMonth(now).toISOString();

  // Run queries in parallel
  const [
    { count: activeUsers },
    { data: revenueToday },
    { data: revenueWeek },
    { data: revenueMonth },
    { count: vouchersSoldToday },
    { count: totalVouchers },
    { count: unusedVouchers },
    { data: revenueChart },
  ] = await Promise.all([
    supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('active', true),
    supabase.from('transactions').select('amount').eq('status', 'paid').gte('created_at', todayStart),
    supabase.from('transactions').select('amount').eq('status', 'paid').gte('created_at', weekStart),
    supabase.from('transactions').select('amount').eq('status', 'paid').gte('created_at', monthStart),
    supabase.from('vouchers').select('id', { count: 'exact', head: true }).neq('status', 'unused').gte('used_at', todayStart),
    supabase.from('vouchers').select('id', { count: 'exact', head: true }),
    supabase.from('vouchers').select('id', { count: 'exact', head: true }).eq('status', 'unused'),
    // Last 30 days revenue per day
    supabase
      .from('transactions')
      .select('created_at, amount')
      .eq('status', 'paid')
      .gte('created_at', subDays(now, 29).toISOString())
      .order('created_at', { ascending: true }),
  ]);

  // Aggregate revenue
  const sumAmount = (rows: { amount: number }[] | null) =>
    (rows || []).reduce((acc, r) => acc + Number(r.amount), 0);

  // Build 30-day revenue chart data
  const chartMap = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = subDays(now, i);
    chartMap.set(format(d, 'yyyy-MM-dd'), 0);
  }
  (revenueChart || []).forEach((tx) => {
    const day = tx.created_at.slice(0, 10);
    chartMap.set(day, (chartMap.get(day) ?? 0) + Number(tx.amount));
  });

  const revenueChartData = Array.from(chartMap.entries()).map(([date, revenue]) => ({
    date,
    revenue: parseFloat(revenue.toFixed(2)),
  }));

  return NextResponse.json({
    success: true,
    data: {
      activeUsers: activeUsers ?? 0,
      revenueToday: parseFloat(sumAmount(revenueToday).toFixed(2)),
      revenueWeek: parseFloat(sumAmount(revenueWeek).toFixed(2)),
      revenueMonth: parseFloat(sumAmount(revenueMonth).toFixed(2)),
      vouchersSoldToday: vouchersSoldToday ?? 0,
      totalVouchers: totalVouchers ?? 0,
      unusedVouchers: unusedVouchers ?? 0,
      revenueChart: revenueChartData,
    },
  });
}
