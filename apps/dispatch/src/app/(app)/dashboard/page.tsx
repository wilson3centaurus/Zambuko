"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@zambuko/database/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Mapbox loaded dynamically — no SSR
const DispatchMap = dynamic(() => import("@/components/DispatchMap"), { ssr: false, loading: () => (
  <div className="w-full h-full bg-slate-800 flex items-center justify-center">
    <span className="text-slate-500 text-sm">Loading map…</span>
  </div>
) });

type Emergency = {
  id: string;
  type: string;
  status: string;
  priority: number;
  patient_id: string;
  patient_lat: number;
  patient_lng: number;
  patient_address: string | null;
  estimated_arrival_minutes: number | null;
  created_at: string;
  profiles: { full_name: string; phone: string | null } | null;
};

type ActiveDispatch = Emergency & {
  dispatcher_lat: number | null;
  dispatcher_lng: number | null;
};

const TYPE_LABELS: Record<string, string> = {
  chest_pain: "Chest Pain",
  trauma: "Trauma / Accident",
  respiratory: "Breathing Problem",
  stroke: "Stroke Symptoms",
  maternity: "Maternity Emergency",
  other: "Emergency",
};

const TYPE_ICONS: Record<string, string> = {
  chest_pain: "❤️‍🔥", trauma: "🩹", respiratory: "🫁", stroke: "🧠", maternity: "🤱", other: "🚨",
};

const PRIORITY_COLOR: Record<number, string> = {
  1: "bg-yellow-600", 2: "bg-orange-500", 3: "bg-red-500", 4: "bg-red-700", 5: "bg-purple-700",
};

const DECLINE_REASONS = [
  "Already on another emergency",
  "Unit needs refuelling",
  "Mechanical issue",
  "Out of coverage area",
  "Medical crew unavailable",
  "Other (see notes)",
];

export default function DispatchDashboard() {
  const supabase = createClient();
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [dispatcherLat, setDispatcherLat] = useState<number | null>(null);
  const [dispatcherLng, setDispatcherLng] = useState<number | null>(null);
  const [alertEmergency, setAlertEmergency] = useState<Emergency | null>(null);
  const [activeDispatch, setActiveDispatch] = useState<ActiveDispatch | null>(null);
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState(DECLINE_REASONS[0]);
  const [declineNotes, setDeclineNotes] = useState("");

  // ── Auth ──────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  // ── GPS ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => { setDispatcherLat(p.coords.latitude); setDispatcherLng(p.coords.longitude); },
      undefined,
      { enableHighAccuracy: true, maximumAge: 8_000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // ── GPS broadcast to Supabase every 15 s ─────────────────────────
  useEffect(() => {
    if (!userId || dispatcherLat === null) return;
    const push = () => {
      supabase.from("dispatchers").update({
        location_lat: dispatcherLat, location_lng: dispatcherLng,
        heartbeat_at: new Date().toISOString(),
      }).eq("id", userId);
    };
    push();
    const t = setInterval(push, 15_000);
    return () => clearInterval(t);
  }, [userId, dispatcherLat, dispatcherLng]);

  // ── Active dispatch (already assigned to me) ──────────────────────
  const { data: myActive } = useQuery({
    queryKey: ["my-dispatch", userId],
    enabled: !!userId,
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("emergencies")
        .select("*, profiles!patient_id(full_name, phone)")
        .eq("dispatcher_id", userId!)
        .in("status", ["dispatched", "en_route", "arrived"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as ActiveDispatch | null;
    },
  });

  useEffect(() => { if (myActive !== undefined) setActiveDispatch(myActive); }, [myActive]);

  // ── Pending emergencies (no dispatcher yet) ───────────────────────
  const { data: pending } = useQuery({
    queryKey: ["pending-emergencies"],
    refetchInterval: 8_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("emergencies")
        .select("*, profiles!patient_id(full_name, phone)")
        .eq("status", "pending")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(20);
      return (data ?? []) as Emergency[];
    },
  });

  // ── Realtime: new pending emergency alert ─────────────────────────
  useEffect(() => {
    const chan = supabase
      .channel("new-emergencies")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "emergencies",
        filter: "status=eq.pending",
      }, async (payload) => {
        const em = payload.new as Emergency;
        // Realtime payload doesn't include joined profiles, fetch it
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("id", em.patient_id)
          .single();
        em.profiles = profile ?? null;
        setAlertEmergency(em);
        qc.invalidateQueries({ queryKey: ["pending-emergencies"] });
        toast.error(`🚨 New emergency: ${TYPE_LABELS[em.type] ?? em.type}`);
      })
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, []);

  // ── Accept dispatch ───────────────────────────────────────────────
  const acceptMutation = useMutation({
    mutationFn: async (emergencyId: string) => {
      if (!userId) throw new Error("Not authenticated");
      // Assign this dispatcher directly to the emergency
      const { error: emErr } = await supabase
        .from("emergencies")
        .update({
          dispatcher_id: userId,
          status: "en_route",
          dispatched_at: new Date().toISOString(),
          estimated_arrival_minutes: 10,
        })
        .eq("id", emergencyId)
        .in("status", ["pending", "dispatched"]);
      if (emErr) throw emErr;
      // Mark self as en_route
      await supabase.from("dispatchers").update({ status: "en_route" }).eq("id", userId);
    },
    onSuccess: () => {
      toast.success("Dispatch accepted. Navigate to patient.");
      setAlertEmergency(null);
      qc.invalidateQueries({ queryKey: ["my-dispatch", userId] });
      qc.invalidateQueries({ queryKey: ["pending-emergencies"] });
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Accept failed."),
  });

  // ── Update dispatch status ────────────────────────────────────────
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: Record<string, unknown> = { status };
      if (status === "arrived") updates.arrived_at = new Date().toISOString();
      if (status === "resolved") updates.resolved_at = new Date().toISOString();
      const { error } = await supabase.from("emergencies").update(updates).eq("id", id);
      if (error) throw error;
      if (status === "resolved") {
        await supabase.from("dispatchers").update({ status: "available" }).eq("id", userId!);
      }
    },
    onSuccess: (_data, variables) => {
      if (variables.status === "resolved") {
        setActiveDispatch(null);
      }
      qc.invalidateQueries({ queryKey: ["my-dispatch", userId] });
      qc.invalidateQueries({ queryKey: ["pending-emergencies"] });
      toast.success("Status updated.");
    },
  });

  const openNavigation = (lat: number, lng: number) => {
    window.open(`https://maps.google.com/maps?q=${lat},${lng}`, "_blank");
  };

  // ── Decline dispatch ──────────────────────────────────────────────
  const declineMutation = useMutation({
    mutationFn: async (emergencyId: string) => {
      // Reset to pending so system can reroute to next dispatcher
      const { error } = await supabase
        .from("emergencies")
        .update({
          status: "pending",
          dispatcher_id: null,
          resolution_notes: `Declined by dispatcher: ${declineReason}${declineNotes ? ` — ${declineNotes}` : ""}`,
        })
        .eq("id", emergencyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.info("Emergency declined. System will reroute to nearest available unit.");
      setAlertEmergency(null);
      setShowDecline(false);
      setDeclineReason(DECLINE_REASONS[0]);
      setDeclineNotes("");
      qc.invalidateQueries({ queryKey: ["pending-emergencies"] });
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Decline failed."),
  });

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">

      {/* ── MAP ───────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 relative">
        <DispatchMap
          dispatcherLat={dispatcherLat}
          dispatcherLng={dispatcherLng}
          emergencies={pending ?? []}
          activeDispatch={activeDispatch}
          onEmergencyClick={(em) => setAlertEmergency(em)}
        />

        {/* Pending count badge */}
        {(pending?.length ?? 0) > 0 && !activeDispatch && (
          <div className="absolute top-3 left-3 bg-red-600 text-white text-xs font-black px-3 py-1.5 rounded-full shadow-lg">
            {pending!.length} PENDING
          </div>
        )}
      </div>

      {/* ── BOTTOM PANEL ──────────────────────────────────────── */}
      <div className="bg-slate-800 border-t border-slate-700">

        {/* ACTIVE DISPATCH CARD */}
        {activeDispatch ? (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-black text-white text-sm">{activeDispatch.profiles?.full_name ?? "Patient"}</p>
                <p className="text-slate-400 text-xs">{activeDispatch.patient_address ?? `${activeDispatch.patient_lat.toFixed(4)}, ${activeDispatch.patient_lng.toFixed(4)}`}</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-bold text-white ${PRIORITY_COLOR[activeDispatch.priority] ?? "bg-red-500"}`}>
                P{activeDispatch.priority}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-300">
              <span>{TYPE_LABELS[activeDispatch.type] ?? activeDispatch.type}</span>
              {activeDispatch.estimated_arrival_minutes && (
                <span className="ml-auto text-amber-400 font-bold">ETA {activeDispatch.estimated_arrival_minutes} min</span>
              )}
            </div>

            {activeDispatch.profiles?.phone && (
              <a href={`tel:${activeDispatch.profiles.phone}`}
                className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300">
                📞 {activeDispatch.profiles.phone}
              </a>
            )}

            <div className="flex gap-2">
              <button onClick={() => openNavigation(activeDispatch.patient_lat, activeDispatch.patient_lng)}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl">
                Navigate
              </button>
              {activeDispatch.status !== "arrived" && (
                <button onClick={() => updateStatusMutation.mutate({ id: activeDispatch.id, status: "arrived" })}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl"
                  disabled={updateStatusMutation.isPending}>
                  Mark Arrived
                </button>
              )}
              {activeDispatch.status === "arrived" && (
                <button onClick={() => updateStatusMutation.mutate({ id: activeDispatch.id, status: "resolved" })}
                  className="flex-1 py-2.5 bg-slate-600 hover:bg-slate-500 text-white text-xs font-bold rounded-xl"
                  disabled={updateStatusMutation.isPending}>
                  Mark Resolved
                </button>
              )}
            </div>
          </div>
        ) : (
          /* PENDING LIST */
          <div className="max-h-52 overflow-y-auto divide-y divide-slate-700">
            {(pending ?? []).length === 0 ? (
              <div className="py-6 text-center text-slate-500 text-sm">No pending emergencies</div>
            ) : (
              (pending ?? []).map((em) => (
                <button key={em.id} onClick={() => setAlertEmergency(em)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-700 flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${PRIORITY_COLOR[em.priority] ?? "bg-red-500"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-bold truncate">{em.profiles?.full_name ?? "Unknown"}</p>
                    <p className="text-slate-400 text-xs">{TYPE_LABELS[em.type] ?? em.type}</p>
                  </div>
                  <span className="text-slate-500 text-xs">
                    {new Date(em.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── NEW EMERGENCY ALERT MODAL ──────────────────────────── */}
      {alertEmergency && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-3xl w-full max-w-sm border border-red-500/40 shadow-[0_0_60px_rgba(220,38,38,0.35)] overflow-hidden">

            {/* Top alert strip */}
            <div className="bg-red-600 px-5 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-lg flex-shrink-0">
                {TYPE_ICONS[alertEmergency.type] ?? "🚨"}
              </div>
              <div className="flex-1">
                <p className="font-black text-white text-sm uppercase tracking-wider">Incoming Emergency</p>
                <p className="text-red-200 text-xs">{TYPE_LABELS[alertEmergency.type] ?? alertEmergency.type}</p>
              </div>
              <div className={`px-2.5 py-1 rounded-full text-xs font-black text-white ${PRIORITY_COLOR[alertEmergency.priority] ?? "bg-red-800"}`}>
                P{alertEmergency.priority}
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Patient info */}
              <div className="bg-slate-800 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-slate-700 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                    {(alertEmergency.profiles?.full_name ?? "?").charAt(0)}
                  </div>
                  <div>
                    <p className="text-white text-sm font-bold">{alertEmergency.profiles?.full_name ?? "Unknown Patient"}</p>
                    {alertEmergency.profiles?.phone && (
                      <a href={`tel:${alertEmergency.profiles.phone}`} className="text-blue-400 text-xs hover:text-blue-300">
                        {alertEmergency.profiles.phone}
                      </a>
                    )}
                  </div>
                </div>
                <div className="h-px bg-slate-700" />
                <div className="flex items-start gap-2 text-xs text-slate-300">
                  <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                  <span className="break-words">{alertEmergency.patient_address ?? `${alertEmergency.patient_lat?.toFixed(5)}, ${alertEmergency.patient_lng?.toFixed(5)}`}</span>
                </div>
                <p className="text-xs text-slate-500">
                  Reported {new Date(alertEmergency.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>

              {/* Decline reason panel (shown when decline is clicked) */}
              {showDecline ? (
                <div className="space-y-2.5 animate-in slide-in-from-bottom-2 duration-200">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Reason for Declining</p>
                  <select
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500"
                  >
                    {DECLINE_REASONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <textarea
                    value={declineNotes}
                    onChange={(e) => setDeclineNotes(e.target.value)}
                    placeholder="Additional notes (optional)…"
                    rows={2}
                    className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-xl px-3 py-2 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDecline(false)}
                      className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => declineMutation.mutate(alertEmergency.id)}
                      disabled={declineMutation.isPending}
                      className="flex-1 py-2.5 bg-slate-600 hover:bg-slate-500 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
                    >
                      {declineMutation.isPending ? "Declining…" : "Confirm Decline"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDecline(true)}
                    className="flex-1 py-3.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-2xl transition-colors"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => acceptMutation.mutate(alertEmergency.id)}
                    disabled={acceptMutation.isPending || !!activeDispatch}
                    className="flex-[2] py-3.5 bg-red-600 hover:bg-red-500 active:scale-[0.97] text-white text-sm font-black rounded-2xl disabled:opacity-50 transition-all shadow-lg shadow-red-900"
                  >
                    {acceptMutation.isPending ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                        Accepting…
                      </span>
                    ) : "Accept & Respond"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
