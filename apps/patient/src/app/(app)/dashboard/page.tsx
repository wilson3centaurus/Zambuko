"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@zambuko/database/client";
import { getPatientConsultations } from "@zambuko/database";
import { getPatientEmergencies } from "@zambuko/database";
import { Card, CardBody, Badge, TriageBadge, DoctorStatusBadge, Button } from "@zambuko/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import type { Profile } from "@zambuko/database";

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const qc = useQueryClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [storedEmergencyId, setStoredEmergencyId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function cancelConsultation(id: string, e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm("Cancel this appointment?")) return;
    setCancellingId(id);
    const { error } = await supabase
      .from("consultations")
      .update({ status: "cancelled" })
      .eq("id", id);
    setCancellingId(null);
    if (error) { alert("Could not cancel. Please try again."); return; }
    qc.invalidateQueries({ queryKey: ["patient-consultations"] });
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single()
          .then(({ data }) => setProfile(data));
      }
    });
    // Pick up any active emergency from localStorage
    const stored = localStorage.getItem("zambuko_active_emergency");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { id: string };
        setStoredEmergencyId(parsed.id);
      } catch {
        localStorage.removeItem("zambuko_active_emergency");
      }
    }
  }, []);

  const { data: consultations = [], isLoading: consultLoading } = useQuery({
    queryKey: ["patient-consultations"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      return getPatientConsultations(supabase, user.id);
    },
    refetchInterval: 10_000,
  });

  const { data: emergencies = [] } = useQuery({
    queryKey: ["patient-emergencies"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      return getPatientEmergencies(supabase, user.id);
    },
  });

  // Live active emergency (from localStorage ID or most recent non-resolved emergency)
  const activeEmergencyId = storedEmergencyId ?? (emergencies.find(
    (e: { status: string }) => !["resolved", "cancelled"].includes(e.status)
  ) as { id: string } | undefined)?.id ?? null;

  const { data: liveEmergency } = useQuery({
    queryKey: ["dashboard-emergency", activeEmergencyId],
    enabled: !!activeEmergencyId,
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("emergencies")
        .select("*, dispatchers(unit_id, profiles(full_name, phone))")
        .eq("id", activeEmergencyId!)
        .single();
      return data;
    },
  });

  const activeConsultation = consultations.find((c) =>
    ["pending", "accepted", "active"].includes(c.status)
  );

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-brand-700 to-brand-900 px-5 pt-12 pb-8">
        <p className="text-brand-200 text-sm">{greeting},</p>
        <h1 className="text-2xl font-bold text-white mt-0.5">{firstName} 👋</h1>
        <p className="text-brand-200 text-sm mt-1">How are you feeling today?</p>
      </div>

      <div className="px-4 -mt-4 space-y-4 pb-4">
        {/* Active emergency banner */}
        {liveEmergency && !["resolved", "cancelled"].includes(liveEmergency.status) && (
          <div className={`rounded-2xl p-4 border-2 space-y-3 ${
            liveEmergency.status === "declined"
              ? "bg-amber-950/80 border-amber-600"
              : "bg-red-950/80 border-red-500 shadow-lg shadow-red-950"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🚨</span>
                <div>
                  <p className="text-white font-black text-sm">Active Emergency</p>
                  <p className={`text-xs font-semibold uppercase ${
                    liveEmergency.status === "declined" ? "text-amber-400" :
                    liveEmergency.status === "dispatched" ? "text-amber-300" :
                    liveEmergency.status === "en_route" ? "text-blue-300" :
                    liveEmergency.status === "arrived" ? "text-green-300" : "text-red-300"
                  }`}>{liveEmergency.status.replace("_", " ")}</p>
                </div>
              </div>
              {liveEmergency.estimated_arrival_minutes && (
                <div className="text-right">
                  <p className="text-white font-black text-xl">{liveEmergency.estimated_arrival_minutes} min</p>
                  <p className="text-red-300 text-xs">ETA</p>
                </div>
              )}
            </div>

            {/* Dispatcher contact (when assigned) */}
            {liveEmergency.dispatchers?.profiles && (
              <div className="flex items-center justify-between bg-black/30 rounded-xl px-3 py-2">
                <div>
                  <p className="text-white text-sm font-semibold">{liveEmergency.dispatchers.profiles.full_name ?? "Responder"}</p>
                  {liveEmergency.dispatchers.unit_id && (
                    <p className="text-red-300 text-xs">Unit {liveEmergency.dispatchers.unit_id}</p>
                  )}
                </div>
                {liveEmergency.dispatchers.profiles.phone && (
                  <a
                    href={`tel:${liveEmergency.dispatchers.profiles.phone}`}
                    className="flex items-center gap-1 bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl"
                  >
                    📞 Call
                  </a>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => router.push("/emergency")}
                className="flex-1 py-2.5 bg-red-700 hover:bg-red-600 text-white text-sm font-bold rounded-xl"
              >
                Track Status
              </button>
              {liveEmergency.status === "declined" && (
                <button
                  onClick={() => {
                    localStorage.removeItem("zambuko_active_emergency");
                    router.push("/emergency");
                  }}
                  className="flex-1 py-2.5 bg-amber-700 hover:bg-amber-600 text-white text-sm font-bold rounded-xl"
                >
                  Re-Declare
                </button>
              )}
            </div>
          </div>
        )}

        {/* Active consultation banner */}
        {activeConsultation && (
          <Card variant="elevated" className="border-l-4 border-brand-500 bg-brand-50">
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-brand-600 font-semibold uppercase tracking-wide">Active Consultation</p>
                  <p className="text-gray-900 font-medium mt-0.5 text-sm">{activeConsultation.chief_complaint}</p>
                  <Badge variant="info" className="mt-1">
                    {activeConsultation.status === "pending" ? "Waiting for doctor…" : "In progress"}
                  </Badge>
                </div>
                <Link href={`/consultation/${activeConsultation.id}`}>
                  <Button size="sm">Continue</Button>
                </Link>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/triage" className="block">
            <Card clickable className="h-full">
              <CardBody className="flex flex-col items-center text-center py-5">
                <div className="w-12 h-12 rounded-2xl bg-brand-100 flex items-center justify-center mb-3">
                  <svg className="w-7 h-7 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="font-semibold text-gray-900 text-sm">See a Doctor</p>
                <p className="text-xs text-gray-500 mt-0.5">Check symptoms & book</p>
              </CardBody>
            </Card>
          </Link>

          <Link href="/emergency" className="block">
            <Card clickable className="h-full bg-emergency-50 border border-emergency-200">
              <CardBody className="flex flex-col items-center text-center py-5">
                <div className="w-12 h-12 rounded-2xl bg-emergency-100 flex items-center justify-center mb-3">
                  <svg className="w-7 h-7 text-emergency-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <p className="font-semibold text-emergency-700 text-sm">Emergency</p>
                <p className="text-xs text-emergency-500 mt-0.5">Request ambulance</p>
              </CardBody>
            </Card>
          </Link>

          <Link href="/prescriptions" className="block">
            <Card clickable className="h-full">
              <CardBody className="flex flex-col items-center text-center py-5">
                <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center mb-3">
                  <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="font-semibold text-gray-900 text-sm">Prescriptions</p>
                <p className="text-xs text-gray-500 mt-0.5">View & collect</p>
              </CardBody>
            </Card>
          </Link>

          <Card className="h-full">
            <CardBody className="flex flex-col items-center text-center py-5">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center mb-3">
                <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="font-semibold text-gray-900 text-sm">Appointments</p>
              <p className="text-xs text-gray-500 mt-0.5">Scheduled sessions</p>
            </CardBody>
          </Card>
        </div>

        {/* Recent consultations */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900">Recent Consultations</h2>
            <Link href="/history" className="text-sm text-brand-600 font-medium">See all</Link>
          </div>

          {consultLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 rounded-2xl bg-gray-200 animate-pulse" />
              ))}
            </div>
          ) : consultations.length === 0 ? (
            <Card>
              <CardBody className="text-center py-8">
                <p className="text-gray-400 text-sm">No consultations yet.</p>
                <Link href="/triage">
                  <Button size="sm" className="mt-3">Book your first consultation</Button>
                </Link>
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-3">
              {consultations.slice(0, 5).map((c) => (
                <Link key={c.id} href={`/consultation/${c.id}`}>
                  <Card clickable>
                    <CardBody>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">{c.chief_complaint}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {c.triage_level && (
                            <TriageBadge level={c.triage_level as "low" | "moderate" | "high" | "emergency"} />
                          )}
                          <Badge
                            variant={
                              c.status === "completed" ? "success" :
                              c.status === "cancelled" ? "default" :
                              c.status === "active" ? "info" : "warning"
                            }
                          >
                            {c.status}
                          </Badge>
                          {c.status === "pending" && (
                            <button
                              onClick={(e) => cancelConsultation(c.id, e)}
                              disabled={cancellingId === c.id}
                              className="text-xs text-red-500 hover:text-red-700 font-medium mt-0.5 disabled:opacity-50"
                            >
                              {cancellingId === c.id ? "Cancelling…" : "Cancel"}
                            </button>
                          )}
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
