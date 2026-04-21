"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@zambuko/database/client";
import { format } from "date-fns";

export default function EmergenciesAdminPage() {
  const supabase = createClient();
  const [filter, setFilter] = useState<"all" | "active" | "resolved">("all");

  const { data: emergencies = [], isLoading } = useQuery({
    queryKey: ["admin-emergencies-full", filter],
    queryFn: async () => {
      let q = supabase
        .from("emergencies")
        .select(`*, 
          patient:profiles!emergencies_patient_id_fkey(full_name, phone),
          dispatcher:profiles!emergencies_dispatcher_id_fkey(full_name, phone)
        `)
        .order("created_at", { ascending: false });
      if (filter === "active") q = q.not("status", "in", '("resolved","cancelled")');
      if (filter === "resolved") q = q.in("status", ["resolved", "cancelled"]);
      const { data } = await q;
      return data ?? [];
    },
    refetchInterval: filter === "active" ? 5_000 : 30_000,
  });

  const EMERGENCY_TYPE_LABELS: Record<string, string> = {
    chest_pain: "Chest Pain / Heart", trauma: "Trauma", respiratory: "Respiratory",
    stroke: "Stroke", maternity: "Maternity", other: "Other",
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Emergencies</h1>
        <p className="text-sm text-gray-500">Monitor all emergency incidents in real-time</p>
      </div>

      <div className="flex gap-2">
        {(["all", "active", "resolved"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border capitalize transition-all ${filter === f ? "bg-red-600 text-white border-red-600" : "bg-white text-gray-600 border-gray-200"}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["Patient", "Type", "Priority", "Status", "Dispatcher", "ETA", "Created"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading && <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading…</td></tr>}
            {!isLoading && emergencies.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-400">No emergencies found.</td></tr>}
            {emergencies.map((e: any) => (
              <tr key={e.id} className={`hover:bg-gray-50 transition-colors ${["pending"].includes(e.status) ? "bg-red-50/50" : ""}`}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-gray-900 text-sm">{e.patient?.full_name ?? "Unknown"}</p>
                  <p className="text-xs text-gray-400">{e.patient?.phone}</p>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{EMERGENCY_TYPE_LABELS[e.type] ?? e.type}</td>
                <td className="px-4 py-3">
                  <div className={`inline-flex w-7 h-7 rounded-full items-center justify-center font-black text-sm ${
                    e.priority >= 5 ? "bg-red-600 text-white" :
                    e.priority >= 4 ? "bg-orange-500 text-white" :
                    e.priority >= 3 ? "bg-amber-400 text-white" :
                    "bg-gray-200 text-gray-700"
                  }`}>{e.priority}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                    e.status === "pending" ? "bg-red-100 text-red-700 animate-pulse" :
                    e.status === "dispatched" || e.status === "en_route" ? "bg-amber-100 text-amber-700" :
                    e.status === "arrived" ? "bg-blue-100 text-blue-700" :
                    e.status === "resolved" ? "bg-green-100 text-green-700" :
                    "bg-gray-100 text-gray-500"
                  }`}>{e.status.replace(/_/g, " ")}</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {e.dispatcher?.full_name ?? <span className="text-gray-300 italic">Unassigned</span>}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {e.estimated_arrival_minutes ? `${e.estimated_arrival_minutes} min` : "—"}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {format(new Date(e.created_at), "d MMM HH:mm")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
