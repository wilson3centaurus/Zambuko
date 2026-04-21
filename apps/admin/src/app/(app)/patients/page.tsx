"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@zambuko/database/client";
import { format } from "date-fns";

export default function PatientsAdminPage() {
  const supabase = createClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["admin-patients", page, search],
    queryFn: async () => {
      let q = supabase
        .from("profiles")
        .select("*, patients(*)", { count: "exact" })
        .eq("role", "patient")
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (search) q = q.ilike("full_name", `%${search}%`);
      const { data, count } = await q;
      return { patients: data ?? [], total: count ?? 0 };
    },
  });

  const patients = data?.patients ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Patients</h1>
        <p className="text-sm text-gray-500">{total} registered patients</p>
      </div>

      <input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        placeholder="Search by name…"
        className="w-full max-w-xs rounded-xl border border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm" />

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["Patient", "Phone", "City", "Blood Type", "Conditions", "Joined"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading && <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading…</td></tr>}
            {!isLoading && patients.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-400">No patients found.</td></tr>}
            {patients.map((p: any) => (
              <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-brand-100 flex items-center justify-center text-sm font-bold text-brand-600">
                      {p.full_name?.charAt(0) ?? "?"}
                    </div>
                    <p className="font-semibold text-gray-900 text-sm">{p.full_name}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{p.phone ?? "—"}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{p.city ?? "—"}</td>
                <td className="px-4 py-3 text-sm font-semibold text-red-700">{p.patients?.blood_type ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {p.patients?.chronic_conditions?.length > 0 ? p.patients.chronic_conditions.slice(0, 2).join(", ") : "None"}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">{format(new Date(p.created_at), "d MMM yyyy")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
        </p>
        <div className="flex gap-2">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 disabled:opacity-40 hover:bg-gray-100">
            ← Prev
          </button>
          <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= total}
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 disabled:opacity-40 hover:bg-gray-100">
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
