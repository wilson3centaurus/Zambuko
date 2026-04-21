"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@zambuko/database/client";
import { format } from "date-fns";

type Emergency = {
  id: string;
  type: string;
  status: string;
  priority: number | null;
  patient_address: string | null;
  description: string | null;
  dispatched_at: string | null;
  arrived_at: string | null;
  resolved_at: string | null;
  actual_arrival_minutes: number | null;
  created_at: string;
  profiles: { full_name: string } | null; // patient
};

const STATUS_COLORS: Record<string, string> = {
  resolved:   "bg-green-900/50 text-green-400",
  cancelled:  "bg-gray-800 text-gray-400",
  dispatched: "bg-blue-900/50 text-blue-400",
  en_route:   "bg-amber-900/50 text-amber-400",
  pending:    "bg-yellow-900/50 text-yellow-400",
};

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  5: { label: "IMMEDIATE", color: "text-red-400" },
  4: { label: "CRITICAL",  color: "text-orange-400" },
  3: { label: "HIGH",      color: "text-yellow-400" },
  2: { label: "MEDIUM",    color: "text-blue-400" },
  1: { label: "LOW",       color: "text-gray-400" },
};

export default function DispatchHistoryPage() {
  const supabase = createClient();

  const { data: emergencies = [], isLoading } = useQuery<Emergency[]>({
    queryKey: ["dispatch-history"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("emergencies")
        .select("id, type, status, priority, patient_address, description, dispatched_at, arrived_at, resolved_at, actual_arrival_minutes, created_at, profiles!patient_id(full_name)")
        .eq("dispatcher_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as Emergency[];
    },
  });

  const resolved = emergencies.filter((e) => e.status === "resolved").length;
  const avgArrival = (() => {
    const with_time = emergencies.filter((e) => e.actual_arrival_minutes != null);
    if (!with_time.length) return null;
    return Math.round(with_time.reduce((s, e) => s + (e.actual_arrival_minutes ?? 0), 0) / with_time.length);
  })();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-slate-400">Loading history…</p>
      </div>
    );
  }

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 border-b border-slate-700">
        <h1 className="text-white font-black text-xl">Dispatch History</h1>
        <p className="text-slate-400 text-sm mt-0.5">Your emergency response log</p>

        <div className="flex gap-3 mt-4">
          {[
            { label: "Total", value: emergencies.length },
            { label: "Resolved", value: resolved },
            { label: "Avg Arrival", value: avgArrival != null ? `${avgArrival} min` : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="flex-1 bg-slate-800 rounded-xl px-3 py-2 text-center">
              <p className="text-white font-black">{value}</p>
              <p className="text-slate-400 text-xs">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="px-4 py-4 space-y-3">
        {emergencies.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-white font-bold">No dispatches yet</p>
            <p className="text-slate-400 text-sm mt-1">Completed emergencies will appear here</p>
          </div>
        ) : (
          emergencies.map((em) => {
            const priority = PRIORITY_LABELS[em.priority ?? 1] ?? { label: "LOW", color: "text-gray-400" };
            return (
              <div key={em.id} className="bg-slate-800 rounded-2xl p-4 space-y-2">
                {/* Row 1: patient + timestamp */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-white font-semibold text-sm">{em.profiles?.full_name ?? "Unknown Patient"}</p>
                    <p className="text-slate-400 text-xs mt-0.5 capitalize">{em.type?.replace(/_/g, " ")}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-slate-400 text-xs">{format(new Date(em.created_at), "d MMM yyyy")}</p>
                    <p className="text-slate-500 text-xs">{format(new Date(em.created_at), "HH:mm")}</p>
                  </div>
                </div>

                {/* Row 2: description */}
                {em.description && (
                  <p className="text-slate-300 text-xs leading-relaxed">{em.description}</p>
                )}
                {em.patient_address && (
                  <p className="text-slate-400 text-xs">📍 {em.patient_address}</p>
                )}

                {/* Row 3: badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-black ${priority.color}`}>{priority.label}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[em.status] ?? "bg-slate-700 text-slate-300"}`}>
                    {em.status?.replace(/_/g, " ")}
                  </span>
                  {em.actual_arrival_minutes != null && (
                    <span className="text-[10px] text-slate-400 ml-auto">⏱ {em.actual_arrival_minutes} min arrival</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
