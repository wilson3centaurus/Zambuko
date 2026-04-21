"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createClient } from "@zambuko/database/client";
import { format, isToday, isYesterday, startOfDay } from "date-fns";

type Consultation = {
  id: string;
  created_at: string;
  chief_complaint: string;
  status: string;
  triage_level: string;
  patient_id: string;
  profiles: { full_name: string } | null;
};

function groupByDate(consultations: Consultation[]) {
  const groups: Record<string, Consultation[]> = {};
  for (const c of consultations) {
    const key = format(startOfDay(new Date(c.created_at)), "yyyy-MM-dd");
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  }
  return groups;
}

function dateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEEE, d MMMM yyyy");
}

const TRIAGE_COLORS: Record<string, string> = {
  critical: "bg-red-900/50 text-red-400",
  high: "bg-orange-900/50 text-orange-400",
  medium: "bg-yellow-900/50 text-yellow-400",
  low: "bg-green-900/50 text-green-400",
};

const STATUS_COLORS: Record<string, string> = {
  completed: "text-green-400",
  cancelled: "text-red-400",
  pending: "text-yellow-400",
  in_progress: "text-sky-400",
};

export default function DoctorSchedulePage() {
  const supabase = createClient();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: consultations = [], isLoading } = useQuery<Consultation[]>({
    queryKey: ["doctor-schedule"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("consultations")
        .select("id, created_at, chief_complaint, status, triage_level, patient_id, profiles!patient_id(full_name)")
        .eq("doctor_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as Consultation[];
    },
  });

  const groups = groupByDate(consultations);

  const pending = consultations.filter((c) => c.status === "pending");
  const history = consultations.filter((c) => c.status !== "pending");
  const historyGroups = groupByDate(history);
  const historySortedKeys = Object.keys(historyGroups).sort((a, b) => (a < b ? 1 : -1));

  const total = consultations.length;
  const completed = consultations.filter((c) => c.status === "completed").length;

  const acceptMutation = useMutation({
    mutationFn: async (consultationId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("consultations")
        .update({ status: "accepted", doctor_id: user.id })
        .eq("id", consultationId);
      if (error) throw error;
    },
    onSuccess: (_, consultationId) => {
      qc.invalidateQueries({ queryKey: ["doctor-schedule"] });
      qc.invalidateQueries({ queryKey: ["pending-consultations"] });
      router.push(`/consultation/${consultationId}`);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <p className="text-slate-400">Loading schedule…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 pb-24">
      {/* Header */}
      <div className="bg-slate-900 px-5 pt-12 pb-6 border-b border-slate-800">
        <h1 className="text-white font-black text-xl">Schedule</h1>
        <p className="text-slate-400 text-sm mt-0.5">Your consultation history</p>
        {/* Stats row */}
        <div className="flex gap-4 mt-4">
          {[
            { label: "Total", value: total },
            { label: "Completed", value: completed },
            { label: "Completion %", value: total > 0 ? `${Math.round((completed / total) * 100)}%` : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="flex-1 bg-slate-800 rounded-xl px-3 py-2 text-center">
              <p className="text-white font-black text-lg">{value}</p>
              <p className="text-slate-400 text-xs">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="px-4 py-5 space-y-6">
        {/* Pending requests — need action */}
        {pending.length > 0 && (
          <div>
            <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3">
              Pending Requests ({pending.length})
            </p>
            <div className="space-y-2">
              {pending.map((c) => (
                <div key={c.id} className="bg-amber-950/40 border border-amber-800/50 rounded-2xl px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="text-slate-500 text-xs w-12 shrink-0 mt-0.5">
                      {format(new Date(c.created_at), "HH:mm")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm leading-tight truncate">
                        {c.profiles?.full_name ?? "Patient"}
                      </p>
                      <p className="text-slate-400 text-xs truncate mt-0.5">{c.chief_complaint}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TRIAGE_COLORS[c.triage_level] ?? "text-slate-400"}`}>
                        {(c.triage_level ?? "").toUpperCase()}
                      </span>
                      <button
                        onClick={() => acceptMutation.mutate(c.id)}
                        disabled={acceptMutation.isPending}
                        className="text-xs font-bold bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-white px-3 py-1 rounded-full transition-colors"
                      >
                        {acceptMutation.isPending ? "…" : "Accept"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History */}
        {historySortedKeys.length === 0 && pending.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📅</p>
            <p className="text-white font-bold">No consultations yet</p>
            <p className="text-slate-400 text-sm mt-1">Your completed sessions will appear here</p>
          </div>
        ) : (
          historySortedKeys.map((dateKey) => {
            const items = historyGroups[dateKey] ?? [];
            return (
              <div key={dateKey}>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  {dateLabel(dateKey)}
                </p>
                <div className="space-y-2">
                  {items.map((c) => (
                    <div key={c.id} className="bg-slate-900 rounded-2xl px-4 py-3 flex items-start gap-3">
                      {/* Time */}
                      <div className="text-slate-500 text-xs w-12 shrink-0 mt-0.5">
                        {format(new Date(c.created_at), "HH:mm")}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm leading-tight truncate">
                          {c.profiles?.full_name ?? "Patient"}
                        </p>
                        <p className="text-slate-400 text-xs truncate mt-0.5">{c.chief_complaint}</p>
                      </div>
                      {/* Badges */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TRIAGE_COLORS[c.triage_level] ?? "text-slate-400"}`}>
                          {(c.triage_level ?? "").toUpperCase()}
                        </span>
                        <span className={`text-[10px] font-medium ${STATUS_COLORS[c.status] ?? "text-slate-400"}`}>
                          {c.status.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
