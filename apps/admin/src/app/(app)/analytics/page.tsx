"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@zambuko/database/client";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";

export default function AnalyticsPage() {
  const supabase = createClient();
  const now = new Date();
  const monthStart = startOfMonth(now).toISOString();
  const monthEnd = endOfMonth(now).toISOString();
  const lastMonthStart = startOfMonth(subMonths(now, 1)).toISOString();
  const lastMonthEnd = endOfMonth(subMonths(now, 1)).toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      const [
        { count: totalPatients },
        { count: totalDoctors },
        { count: consultationsThisMonth },
        { count: consultationsLastMonth },
        { count: emergenciesThisMonth },
        { count: emergenciesLastMonth },
        { count: activeDoctors },
        { data: topSpecialties },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "patient"),
        supabase.from("doctors").select("*", { count: "exact", head: true }),
        supabase.from("consultations").select("*", { count: "exact", head: true }).gte("created_at", monthStart).lte("created_at", monthEnd),
        supabase.from("consultations").select("*", { count: "exact", head: true }).gte("created_at", lastMonthStart).lte("created_at", lastMonthEnd),
        supabase.from("emergencies").select("*", { count: "exact", head: true }).gte("created_at", monthStart).lte("created_at", monthEnd),
        supabase.from("emergencies").select("*", { count: "exact", head: true }).gte("created_at", lastMonthStart).lte("created_at", lastMonthEnd),
        supabase.from("doctors").select("*", { count: "exact", head: true }).in("status", ["available", "in_session"]),
        supabase.from("doctors").select("specialty"),
      ]);

      // Count specialties from top doctors
      const specCount: Record<string, number> = {};
      for (const d of topSpecialties ?? []) {
        const s = (d as any).specialty ?? "other";
        specCount[s] = (specCount[s] ?? 0) + 1;
      }
      const specialties = Object.entries(specCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

      return {
        totalPatients: totalPatients ?? 0,
        totalDoctors: totalDoctors ?? 0,
        consultationsThisMonth: consultationsThisMonth ?? 0,
        consultationsLastMonth: consultationsLastMonth ?? 0,
        emergenciesThisMonth: emergenciesThisMonth ?? 0,
        emergenciesLastMonth: emergenciesLastMonth ?? 0,
        activeDoctors: activeDoctors ?? 0,
        specialties,
      };
    },
  });

  function trend(current: number, previous: number) {
    if (!previous) return null;
    const pct = Math.round(((current - previous) / previous) * 100);
    if (pct > 0) return { label: `+${pct}% vs last month`, color: "text-green-600" };
    if (pct < 0) return { label: `${pct}% vs last month`, color: "text-red-500" };
    return { label: "Same as last month", color: "text-gray-400" };
  }

  const consultTrend = data ? trend(data.consultationsThisMonth, data.consultationsLastMonth) : null;
  const emergTrend = data ? trend(data.emergenciesThisMonth, data.emergenciesLastMonth) : null;

  const cards = data
    ? [
        { label: "Total Patients", value: data.totalPatients, icon: "👥", sub: null },
        { label: "Total Doctors", value: data.totalDoctors, icon: "🩺", sub: `${data.activeDoctors} online now` },
        { label: "Consultations", value: data.consultationsThisMonth, icon: "💬", sub: consultTrend?.label, subColor: consultTrend?.color },
        { label: "Emergencies", value: data.emergenciesThisMonth, icon: "🚨", sub: emergTrend?.label, subColor: emergTrend?.color },
      ]
    : [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500">{format(now, "MMMM yyyy")} overview</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse h-24" />
            ))
          : cards.map(({ label, value, icon, sub, subColor }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-start justify-between">
                  <span className="text-2xl">{icon}</span>
                  <p className="text-3xl font-black text-gray-900">{value.toLocaleString()}</p>
                </div>
                <p className="text-sm font-semibold text-gray-700 mt-2">{label}</p>
                {sub && <p className={`text-xs mt-0.5 ${subColor ?? "text-gray-400"}`}>{sub}</p>}
              </div>
            ))}
      </div>

      {/* Top specialties */}
      {data && data.specialties.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-black text-gray-700 mb-4">Doctors by Specialty</h2>
          <div className="space-y-3">
            {data.specialties.map(([specialty, count]) => {
              const pct = Math.round((count / (data.totalDoctors || 1)) * 100);
              return (
                <div key={specialty}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600 capitalize">{specialty.replace(/_/g, " ")}</span>
                    <span className="text-sm font-bold text-gray-900">{count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-center text-gray-400">Data refreshes on page load · More detailed charts coming soon</p>
    </div>
  );
}
