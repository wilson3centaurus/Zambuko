"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@zambuko/database/client";
import { getPatientConsultations } from "@zambuko/database";
import { Badge, Card, CardBody, TriageBadge } from "@zambuko/ui";
import { format } from "date-fns";

type HistoryFilter = "all" | "upcoming" | "completed" | "cancelled";

const FILTERS: { value: HistoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_LABELS: Record<string, string> = {
  pending: "Finding a doctor",
  accepted: "Doctor assigned",
  active: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "Missed",
};

function HistoryContent() {
  const params = useSearchParams();
  const requested = params.get("filter");
  const [filter, setFilter] = useState<HistoryFilter>(
    requested === "upcoming" || requested === "completed" || requested === "cancelled" ? requested : "all"
  );
  const supabase = useMemo(() => createClient(), []);

  const { data: consultations = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["patient-consultations", "history"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error("Not authenticated");
      return getPatientConsultations(supabase, user.id);
    },
  });

  const filtered = useMemo(() => consultations.filter((consultation) => {
    if (filter === "all") return true;
    if (filter === "upcoming") return ["pending", "accepted", "active"].includes(consultation.status);
    if (filter === "completed") return consultation.status === "completed";
    return ["cancelled", "no_show"].includes(consultation.status);
  }), [consultations, filter]);

  return (
    <div className="min-h-app bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">Your care</p>
          <h1 className="mt-1 text-xl font-bold text-slate-950">Consultation history</h1>
          <p className="mt-1 text-sm text-slate-500">Review appointments, care notes, follow-ups, and ratings.</p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-5 lg:px-8">
        <div className="flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Filter consultations">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={filter === item.value}
              onClick={() => setFilter(item.value)}
              className={`min-h-10 whitespace-nowrap rounded-lg border px-4 text-sm font-semibold transition-colors ${
                filter === item.value
                  ? "border-brand-700 bg-brand-700 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:text-brand-800"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[1, 2, 3, 4].map((item) => <div key={item} className="h-40 animate-pulse rounded-xl bg-slate-200" />)}
          </div>
        )}

        {isError && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-center">
            <h2 className="font-bold text-red-900">We couldn’t load your history</h2>
            <p className="mt-1 text-sm text-red-700">Check your connection and try again.</p>
            <button type="button" onClick={() => refetch()} className="mt-4 min-h-10 rounded-lg bg-red-700 px-4 text-sm font-bold text-white">Try again</button>
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-700">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v3m8-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" />
              </svg>
            </div>
            <h2 className="mt-4 font-bold text-slate-900">No {filter === "all" ? "" : filter} consultations</h2>
            <p className="mt-1 text-sm text-slate-500">When you consult a Hutano doctor, the visit will appear here.</p>
            <Link href="/triage" className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-brand-700 px-4 text-sm font-bold text-white">Start a symptom check</Link>
          </div>
        )}

        {!isLoading && !isError && filtered.length > 0 && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {filtered.map((consultation) => {
              const doctor = consultation.doctor as { full_name?: string | null } | null;
              const statusVariant =
                consultation.status === "completed" ? "success" :
                consultation.status === "cancelled" || consultation.status === "no_show" ? "default" :
                consultation.status === "active" ? "info" : "warning";

              return (
                <Card key={consultation.id} className="h-full">
                  <CardBody className="flex h-full flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-500">{format(new Date(consultation.created_at), "d MMM yyyy, HH:mm")}</p>
                        <h2 className="mt-1 truncate font-bold text-slate-950">{consultation.chief_complaint}</h2>
                        <p className="mt-1 text-sm text-slate-500">{doctor?.full_name ?? "Care team matching in progress"}</p>
                      </div>
                      <Badge variant={statusVariant}>{STATUS_LABELS[consultation.status] ?? consultation.status}</Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="rounded-md bg-slate-100 px-2 py-1 font-semibold capitalize">{consultation.type.replace("_", " ")}</span>
                      {consultation.triage_level && <TriageBadge level={consultation.triage_level} />}
                      {consultation.duration_minutes && <span>{consultation.duration_minutes} min</span>}
                    </div>

                    {consultation.diagnosis && (
                      <div className="rounded-lg bg-slate-50 px-3 py-2">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Care summary</p>
                        <p className="mt-1 text-sm text-slate-700">{consultation.diagnosis}</p>
                      </div>
                    )}

                    {consultation.follow_up_date && (
                      <p className="text-sm font-semibold text-brand-800">Follow-up: {format(new Date(consultation.follow_up_date), "d MMM yyyy")}</p>
                    )}

                    <div className="mt-auto flex gap-2 border-t border-slate-100 pt-3">
                      <Link href={`/consultation/${consultation.id}`} className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                        View details
                      </Link>
                      {consultation.status === "completed" && consultation.doctor_id && !consultation.patient_rating && (
                        <Link href={`/consultation/${consultation.id}/rate`} className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg bg-brand-700 px-3 text-sm font-bold text-white hover:bg-brand-800">
                          Rate care
                        </Link>
                      )}
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<div className="min-h-app bg-slate-50" />}>
      <HistoryContent />
    </Suspense>
  );
}
