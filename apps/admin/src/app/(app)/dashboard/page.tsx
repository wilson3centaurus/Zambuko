"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@zambuko/database/client";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";

// ---------------------------------------------------------------------------
// Tiny primitives (no shared-component dependency for pixel-perfect control)
// ---------------------------------------------------------------------------
function MetricCard({ label, value, sub, trend }: { label: string; value: string | number; sub?: string; trend?: "up" | "down" | "neutral" }) {
  const trendColor = trend === "up" ? "text-emerald-500" : trend === "down" ? "text-red-500" : "text-gray-400";
  const trendIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 flex flex-col gap-2">
      <span className="text-xs font-medium text-gray-500 tracking-wide uppercase">{label}</span>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-semibold text-gray-900 tabular-nums">{value}</span>
        {trendIcon && <span className={`text-sm font-medium mb-0.5 ${trendColor}`}>{trendIcon}</span>}
      </div>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}

function SectionHeader({ title, badge }: { title: string; badge?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {badge != null && (
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full tabular-nums ${badge > 0 ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-400"}`}>
          {badge}
        </span>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    dispatched: "bg-blue-50 text-blue-700 border-blue-200",
    active: "bg-blue-50 text-blue-700 border-blue-200",
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    resolved: "bg-gray-100 text-gray-500 border-gray-200",
    cancelled: "bg-gray-100 text-gray-500 border-gray-200",
  };
  return (
    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded border capitalize ${map[status] ?? "bg-gray-100 text-gray-500 border-gray-200"}`}>
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
export default function AdminDashboard() {
  const supabase = createClient();

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [doctors, patients, consultations, emergencies, revenue, pendingDoctors] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "doctor"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "patient"),
        supabase.from("consultations").select("id", { count: "exact", head: true }),
        supabase.from("emergencies").select("id", { count: "exact", head: true }),
        supabase.from("payments").select("amount_usd").eq("status", "success"),
        supabase.from("doctors").select("id", { count: "exact", head: true }).eq("license_verified", false),
      ]);
      const totalRevenue = (revenue.data ?? []).reduce((sum, p) => sum + (p.amount_usd ?? 0), 0);
      return {
        doctors: doctors.count ?? 0,
        patients: patients.count ?? 0,
        consultations: consultations.count ?? 0,
        emergencies: emergencies.count ?? 0,
        revenue: totalRevenue,
        pendingDoctors: pendingDoctors.count ?? 0,
      };
    },
    refetchInterval: 60_000,
  });

  const { data: recentConsultations = [] } = useQuery({
    queryKey: ["admin-recent-consults"],
    queryFn: async () => {
      const { data } = await supabase
        .from("consultations")
        .select("id, status, chief_complaint, created_at, profiles!consultations_patient_id_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const { data: activeEmergencies = [] } = useQuery({
    queryKey: ["admin-emergencies"],
    queryFn: async () => {
      const { data } = await supabase
        .from("emergencies")
        .select("id, type, status, created_at, profiles!emergencies_patient_id_fkey(full_name)")
        .not("status", "in", '("resolved","cancelled")')
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    refetchInterval: 10_000,
  });

  const { data: chartData = [] } = useQuery({
    queryKey: ["admin-chart"],
    queryFn: async () => {
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = subDays(new Date(), 6 - i);
        return { date: format(d, "EEE"), start: startOfDay(d).toISOString() };
      });
      const results = await Promise.all(
        days.map(async (d, i) => {
          const nextDay = days[i + 1]?.start ?? new Date().toISOString();
          const { count } = await supabase
            .from("consultations")
            .select("id", { count: "exact", head: true })
            .gte("created_at", d.start)
            .lt("created_at", nextDay);
          return { date: d.date, consultations: count ?? 0 };
        })
      );
      return results;
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="border-b border-gray-200 bg-white px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Overview</h1>
            <p className="text-sm text-gray-400 mt-0.5">{format(new Date(), "EEEE, d MMMM yyyy")}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* KPI grid */}
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
          <MetricCard label="Doctors" value={stats?.doctors ?? "—"} sub="Registered on platform" />
          <MetricCard label="Patients" value={stats?.patients ?? "—"} sub="All time" />
          <MetricCard label="Consultations" value={stats?.consultations ?? "—"} sub="Total sessions" />
          <MetricCard label="Emergencies" value={stats?.emergencies ?? "—"} sub="Dispatched calls" />
          <MetricCard label="Revenue" value={stats ? `$${stats.revenue.toFixed(0)}` : "—"} sub="Confirmed payments (USD)" />
          <MetricCard
            label="Unverified Doctors"
            value={stats?.pendingDoctors ?? "—"}
            sub="Awaiting license review"
            trend={stats?.pendingDoctors ? "down" : "neutral"}
          />
        </div>

        {/* Chart */}
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-gray-900">Consultations</span>
            <span className="text-xs text-gray-400">Last 7 days</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#111827" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#111827" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }}
                cursor={{ stroke: "#e5e7eb" }}
              />
              <Area type="monotone" dataKey="consultations" stroke="#111827" strokeWidth={1.5} fill="url(#grad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Two-column tables */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Active emergencies */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <SectionHeader title="Active Emergencies" badge={activeEmergencies.length} />
            {activeEmergencies.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">No active emergencies</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100">
                    <th className="text-left pb-2 font-medium">Patient</th>
                    <th className="text-left pb-2 font-medium">Type</th>
                    <th className="text-right pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {activeEmergencies.slice(0, 7).map((e: any) => (
                    <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 font-medium text-gray-900">{(e.profiles as any)?.full_name ?? "Unknown"}</td>
                      <td className="py-2.5 text-gray-500 capitalize">{e.type?.replace(/_/g, " ")}</td>
                      <td className="py-2.5 text-right"><StatusPill status={e.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Recent consultations */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <SectionHeader title="Recent Consultations" />
            {recentConsultations.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">No consultations yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100">
                    <th className="text-left pb-2 font-medium">Patient</th>
                    <th className="text-left pb-2 font-medium">Complaint</th>
                    <th className="text-right pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentConsultations.map((c: any) => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 font-medium text-gray-900">{(c.profiles as any)?.full_name ?? "Patient"}</td>
                      <td className="py-2.5 text-gray-500 truncate max-w-[120px]">{c.chief_complaint ?? "—"}</td>
                      <td className="py-2.5 text-right"><StatusPill status={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
