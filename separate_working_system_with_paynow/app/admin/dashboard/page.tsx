'use client';

import { useEffect, useState } from 'react';
import { Users, DollarSign, Ticket, Activity, TrendingUp } from 'lucide-react';
import { StatsCard } from '@/components/admin/StatsCard';
import { RevenueChart } from '@/components/admin/RevenueChart';
import { formatCurrency } from '@/lib/utils/format';

interface Stats {
  activeUsers: number;
  revenueToday: number;
  revenueWeek: number;
  revenueMonth: number;
  vouchersSoldToday: number;
  totalVouchers: number;
  unusedVouchers: number;
  revenueChart: Array<{ date: string; revenue: number }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((r) => r.json())
      .then((j) => { if (j.success) setStats(j.data); })
      .finally(() => setLoading(false));
  }, []);

  const v = (n: number | undefined) => loading ? '-' : (n ?? 0);

  return (
    <div className="p-6 flex flex-col gap-6 max-w-7xl w-full mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 mb-1">Dashboard</p>
          <h1 className="text-2xl font-black text-slate-100">Overview</h1>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-slate-400">Live</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Active Sessions"
          value={v(stats?.activeUsers)}
          icon={<Users size={18} />}
          colorClass="bg-blue-500/10 text-blue-400"
        />
        <StatsCard
          title="Revenue Today"
          value={loading ? '-' : formatCurrency(stats?.revenueToday ?? 0)}
          icon={<DollarSign size={18} />}
          colorClass="bg-emerald-500/10 text-emerald-400"
        />
        <StatsCard
          title="Revenue This Month"
          value={loading ? '-' : formatCurrency(stats?.revenueMonth ?? 0)}
          icon={<TrendingUp size={18} />}
          colorClass="bg-purple-500/10 text-purple-400"
        />
        <StatsCard
          title="Vouchers Sold Today"
          value={v(stats?.vouchersSoldToday)}
          subtitle={loading ? '' : `${stats?.unusedVouchers ?? 0} unused in stock`}
          icon={<Ticket size={18} />}
          colorClass="bg-amber-500/10 text-amber-400"
        />
      </div>

      {/* Revenue chart */}
      {stats?.revenueChart && (
        <DarkChartWrapper>
          <RevenueChart data={stats.revenueChart} />
        </DarkChartWrapper>
      )}

      {/* Secondary stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Vouchers', value: v(stats?.totalVouchers), icon: Ticket },
          { label: 'Revenue This Week', value: loading ? '-' : formatCurrency(stats?.revenueWeek ?? 0), icon: Activity },
          { label: 'Unused Stock', value: v(stats?.unusedVouchers), icon: Users },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon size={14} className="text-slate-500" />
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
            </div>
            <p className="text-2xl font-black text-slate-100">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DarkChartWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
      <h2 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wide">Revenue (Last 14 Days)</h2>
      {children}
    </div>
  );
}