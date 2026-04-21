"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@zambuko/database/client";
import { Card, CardBody, Badge, Button } from "@zambuko/ui";
import { format, isAfter } from "date-fns";

export default function PrescriptionsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "issued" | "dispensed" | "cancelled">("all");

  const { data: prescriptions = [], isLoading } = useQuery({
    queryKey: ["doctor-prescriptions", filter],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      let q = supabase
        .from("prescriptions")
        .select(`
          *,
          patient:profiles!patient_id(full_name, phone),
          consultation:consultations(chief_complaint)
        `)
        .eq("doctor_id", user.id)
        .order("created_at", { ascending: false });
      if (filter !== "all") q = q.eq("status", filter);
      const { data } = await q;
      return data ?? [];
    },
  });

  const STATUS_COLORS: Record<string, string> = {
    issued: "bg-blue-100 text-blue-700",
    dispensed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-600",
    expired: "bg-gray-100 text-gray-500",
  };

  function getStatus(rx: any) {
    if (rx.status === "cancelled") return "cancelled";
    if (rx.status === "dispensed") return "dispensed";
    if (rx.valid_until && !isAfter(new Date(rx.valid_until), new Date())) return "expired";
    return rx.status;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-slate-900 px-5 pt-12 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-white">Prescriptions</h1>
            <p className="text-slate-400 text-sm mt-0.5">{prescriptions.length} total</p>
          </div>
          <Button size="sm" onClick={() => router.push("/prescriptions/new")}>
            + New Rx
          </Button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
          {(["all", "issued", "dispensed", "cancelled"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                filter === f ? "bg-sky-500 text-white" : "bg-slate-800 text-slate-400"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {isLoading && (
          <div className="text-center py-12 text-slate-400">Loading…</div>
        )}

        {!isLoading && prescriptions.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">💊</p>
            <p className="text-slate-500 font-medium">No prescriptions yet</p>
            <button
              onClick={() => router.push("/prescriptions/new")}
              className="mt-4 text-sky-500 text-sm font-semibold"
            >
              Write your first prescription →
            </button>
          </div>
        )}

        {prescriptions.map((rx: any) => {
          const status = getStatus(rx);
          return (
            <div key={rx.id} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
              {/* Top row */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-slate-900 text-sm">
                    {rx.patient?.full_name ?? "Unknown patient"}
                  </p>
                  {rx.consultation?.chief_complaint && (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                      {rx.consultation.chief_complaint}
                    </p>
                  )}
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600"}`}>
                  {status}
                </span>
              </div>

              {/* Medications */}
              <div className="space-y-1.5">
                {(rx.medications as any[]).map((med: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sky-500 text-xs">💊</span>
                    <span className="text-sm text-slate-700 font-medium">{med.name}</span>
                    <span className="text-xs text-slate-400">— {med.dosage}, {med.frequency}, {med.duration_days}d</span>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-50">
                <p className="text-xs text-slate-400">
                  {format(new Date(rx.created_at), "d MMM yyyy")}
                </p>
                {rx.valid_until && (
                  <p className="text-xs text-slate-400">
                    Valid until {format(new Date(rx.valid_until), "d MMM yyyy")}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
