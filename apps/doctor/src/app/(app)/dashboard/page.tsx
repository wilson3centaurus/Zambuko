"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@zambuko/database/client";
import { getDoctorConsultations } from "@zambuko/database";
import { Card, CardBody, TriageBadge, Button } from "@zambuko/ui";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import type { DoctorStatus } from "@zambuko/database";

const STATUS_OPTIONS: { value: DoctorStatus; label: string; color: string }[] = [
  { value: "available", label: "Available", color: "bg-green-500" },
  { value: "busy", label: "Busy", color: "bg-amber-500" },
  { value: "offline", label: "Offline", color: "bg-gray-400" },
];

export default function DoctorDashboard() {
  const router = useRouter();
  const supabase = createClient();
  const qc = useQueryClient();
  const [doctorStatus, setDoctorStatus] = useState<DoctorStatus>("available");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const { data: doctorProfile } = useQuery({
    queryKey: ["doctor-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data } = await supabase
        .from("doctors")
        .select("*, profiles(*)")
        .eq("id", user.id)
        .single();
      if (data) setDoctorStatus(data.status as DoctorStatus);
      return data;
    },
  });

  const { data: pendingConsults = [], isLoading: loadingPending } = useQuery({
    queryKey: ["pending-consultations"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data } = await supabase
        .from("consultations")
        .select(`id, status, type, triage_level, chief_complaint, symptoms, created_at, payment_method, patient:profiles!patient_id(id, full_name, avatar_url)`)
        .eq("status", "pending")
        .or(`doctor_id.is.null,doctor_id.eq.${user.id}`)
        .order("created_at", { ascending: true })
        .limit(50);
      return data ?? [];
    },
    refetchInterval: 10_000,
  });

  const { data: activeConsults = [] } = useQuery({
    queryKey: ["active-consultations"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error();
      return getDoctorConsultations(supabase, user.id, ["accepted", "active"]);
    },
    refetchInterval: 5_000,
  });

  const { data: todayConsults = [] } = useQuery({
    queryKey: ["today-consultations"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error();
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("consultations")
        .select("*")
        .eq("doctor_id", user.id)
        .gte("created_at", today)
        .in("status", ["completed"]);
      return data ?? [];
    },
  });

  async function updateStatus(status: DoctorStatus) {
    setUpdatingStatus(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("doctors")
      .update({ status, heartbeat_at: new Date().toISOString() })
      .eq("id", user.id);
    if (!error) {
      setDoctorStatus(status);
      toast.success(`Status set to ${status}`);
    }
    setUpdatingStatus(false);
  }

  const acceptMutation = useMutation({
    mutationFn: async (consultationId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error();
      const { error } = await supabase
        .from("consultations")
        .update({ status: "accepted", doctor_id: user.id })
        .eq("id", consultationId);
      if (error) throw error;
    },
    onSuccess: (_, consultationId) => {
      toast.success("Consultation accepted!");
      qc.invalidateQueries({ queryKey: ["pending-consultations"] });
      router.push(`/consultation/${consultationId}`);
    },
    onError: () => toast.error("Could not accept consultation."),
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-slate-900 px-4 pt-safe py-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <p className="text-slate-400 text-xs">Good {getGreeting()}</p>
            <p className="text-white font-bold text-lg">Dr. {doctorProfile?.profiles?.full_name?.split(" ")[0] ?? "Doctor"}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${STATUS_OPTIONS.find(s => s.value === doctorStatus)?.color ?? "bg-gray-400"} ${doctorStatus === "available" ? "animate-pulse" : ""}`} />
            <select
              value={doctorStatus}
              onChange={(e) => updateStatus(e.target.value as DoctorStatus)}
              disabled={updatingStatus}
              className="bg-slate-800 text-white text-sm rounded-xl px-3 py-1.5 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3 mt-4 max-w-lg mx-auto">
          {[
            { label: "Pending", value: pendingConsults.length, color: "text-amber-400" },
            { label: "Active", value: activeConsults.length, color: "text-sky-400" },
            { label: "Today", value: todayConsults.length, color: "text-green-400" },
          ].map(stat => (
            <div key={stat.label} className="bg-slate-800 rounded-xl px-3 py-2.5 text-center">
              <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
              <p className="text-slate-400 text-xs">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-5 max-w-lg mx-auto">
        {/* Active consultations */}
        {activeConsults.length > 0 && (
          <section>
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Active Now</h2>
            <div className="space-y-3">
              {activeConsults.map((c) => (
                <Card key={c.id} className="border-sky-200 bg-sky-50 cursor-pointer" onClick={() => router.push(`/consultation/${c.id}`)}>
                  <CardBody>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{c.chief_complaint}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Started {formatDistanceToNow(new Date(c.started_at ?? c.created_at))} ago
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {c.triage_level && <TriageBadge level={c.triage_level as any} />}
                        <span className="text-sky-600 font-bold text-sm">→</span>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Pending queue */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Waiting Queue</h2>
            <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
              {pendingConsults.length} waiting
            </span>
          </div>

          {loadingPending && (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="bg-white rounded-2xl h-24 animate-pulse" />)}
            </div>
          )}

          {!loadingPending && pendingConsults.length === 0 && (
            <div className="text-center py-10 bg-white rounded-2xl border border-gray-100">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-gray-500 text-sm">No patients waiting</p>
              {doctorStatus !== "available" && (
                <button onClick={() => updateStatus("available")}
                  className="mt-3 text-sky-600 text-sm font-semibold hover:underline">
                  Go Available
                </button>
              )}
            </div>
          )}

          <div className="space-y-3">
            {pendingConsults.map((c) => (
              <Card key={c.id}>
                <CardBody>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm truncate">{c.chief_complaint}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {c.triage_level && <TriageBadge level={c.triage_level as any} />}
                        <span className="text-xs text-gray-500 capitalize">
                          {c.type === "in_person" ? "🏥 In Person" : `${c.type} call`}
                        </span>
                        {c.payment_method === "cash" ? (
                          <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
                            💵 Cash on arrival
                          </span>
                        ) : c.payment_method ? (
                          <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                            ✓ Paid via {c.payment_method}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Waiting {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      loading={acceptMutation.isPending}
                      onClick={() => acceptMutation.mutate(c.id)}
                    >
                      Accept
                    </Button>
                  </div>

                  {c.symptoms && c.symptoms.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {c.symptoms.slice(0, 4).map((s: string) => (
                        <span key={s} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">
                          {s.replace(/_/g, " ")}
                        </span>
                      ))}
                      {c.symptoms.length > 4 && (
                        <span className="text-xs text-gray-400">+{c.symptoms.length - 4} more</span>
                      )}
                    </div>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        </section>

        {/* Today's rating */}
        {doctorProfile && (
          <Card>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide">Overall Rating</p>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-2xl font-black text-gray-900">{doctorProfile.rating?.toFixed(1)}</span>
                    <span className="text-amber-400 text-xl">★</span>
                    <span className="text-xs text-gray-400">({doctorProfile.rating_count} reviews)</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide">Fee</p>
                  <p className="text-xl font-black text-gray-900">${doctorProfile.consultation_fee_usd}</p>
                </div>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
