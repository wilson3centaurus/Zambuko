"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LiveKitRoom, VideoConference, RoomAudioRenderer } from "@livekit/components-react";
import "@livekit/components-styles";
import { createClient } from "@zambuko/database/client";
import { getMessages, sendMessage } from "@zambuko/database";
import { Button, Card, CardBody } from "@zambuko/ui";
import { toast } from "sonner";

type Tab = "chat" | "video" | "notes";

export default function DoctorConsultationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("chat");
  const [messageText, setMessageText] = useState("");
  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const [doctorNotes, setDoctorNotes] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: consultation, isLoading } = useQuery({
    queryKey: ["consultation", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("consultations")
        .select("*, profiles!consultations_patient_id_fkey(full_name, avatar_url), patients!inner(*)")
        .eq("id", id)
        .single();
      return data;
    },
    refetchInterval: 10_000,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", id],
    queryFn: () => getMessages(supabase, id),
  });

  // Realtime subscription
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`doctor-consultation:${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `consultation_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["messages", id] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, supabase, qc]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Pre-populate notes from consultation
  useEffect(() => {
    if (consultation) {
      setDoctorNotes(consultation.doctor_notes ?? "");
      setDiagnosis(consultation.diagnosis ?? "");
    }
  }, [consultation?.id]);

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error();
      return sendMessage(supabase, { consultationId: id, senderId: user.id, type: "text", content: text });
    },
    onSuccess: () => {
      setMessageText("");
      qc.invalidateQueries({ queryKey: ["messages", id] });
    },
    onError: () => toast.error("Could not send message."),
  });

  async function fetchLivekitToken() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.functions.invoke("livekit-token", {
      body: { consultation_id: id, user_id: user.id, is_doctor: true },
    });
    if (error || !data?.token) { toast.error("Could not start video call."); return; }
    setLivekitToken(data.token);
    setTab("video");
  }

  async function saveNotes() {
    setSavingNotes(true);
    const { error } = await supabase
      .from("consultations")
      .update({ doctor_notes: doctorNotes, diagnosis })
      .eq("id", id);
    if (error) toast.error("Could not save notes.");
    else toast.success("Notes saved.");
    setSavingNotes(false);
  }

  async function endConsultation() {
    if (!confirm("Complete this consultation and send a prescription if needed?")) return;
    await supabase.from("consultations").update({ status: "completed" }).eq("id", id);
    toast.success("Consultation completed.");
    router.push("/dashboard");
  }

  if (isLoading) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
    </div>;
  }

  const patientName = (consultation as any)?.profiles?.full_name ?? "Patient";
  const isCompleted = ["completed", "cancelled"].includes(consultation?.status ?? "");
  const patient = (consultation as any)?.patients;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push("/dashboard")} className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-800">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">{patientName}</p>
          <p className="text-xs text-slate-400">{consultation?.chief_complaint}</p>
        </div>
        <div className="flex gap-2">
          {!isCompleted && !livekitToken && (
            <button onClick={fetchLivekitToken} className="p-2 rounded-xl bg-sky-700 text-white hover:bg-sky-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          )}
          {!isCompleted && (
            <button onClick={endConsultation} className="p-2 rounded-xl bg-green-800 text-green-300 hover:bg-green-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Patient info banner */}
      {patient && (
        <div className="bg-slate-800 px-4 py-2 flex gap-4 flex-wrap text-xs text-slate-400 border-b border-slate-700">
          {patient.blood_type && <span>🩸 {patient.blood_type}</span>}
          {patient.allergies?.length > 0 && <span>⚠️ Allergic: {patient.allergies.slice(0, 2).join(", ")}</span>}
          {patient.chronic_conditions?.length > 0 && <span>📋 {patient.chronic_conditions.slice(0, 2).join(", ")}</span>}
        </div>
      )}

      {/* Tab bar */}
      <div className="bg-slate-900 px-4 py-2 flex gap-2 border-b border-slate-800">
        {(["chat", ...(livekitToken ? ["video"] : []), "notes"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t as Tab)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold capitalize transition-all ${tab === t ? "bg-sky-600 text-white" : "text-slate-400 hover:text-white"}`}>
            {t === "chat" ? "💬 Chat" : t === "video" ? "📹 Video" : "📝 Notes"}
          </button>
        ))}
      </div>

      {/* Video */}
      {tab === "video" && livekitToken && (
        <div className="flex-1 relative">
          <LiveKitRoom token={livekitToken} serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL} video audio connect
            onDisconnected={() => { setLivekitToken(null); setTab("chat"); }}>
            <VideoConference />
            <RoomAudioRenderer />
          </LiveKitRoom>
        </div>
      )}

      {/* Chat */}
      {tab === "chat" && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((msg) => {
              const isDoctor = msg.sender?.[0]?.id !== consultation?.patient_id;
              return (
                <div key={msg.id} className={`flex ${isDoctor ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${isDoctor ? "bg-sky-600 text-white rounded-br-md" : "bg-slate-800 text-slate-100 rounded-bl-md"}`}>
                    <p className="text-sm">{msg.content}</p>
                    <p className={`text-xs mt-1 ${isDoctor ? "text-sky-200" : "text-slate-500"}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          {!isCompleted && (
            <div className="bg-slate-900 border-t border-slate-800 px-4 py-3 pb-safe flex gap-2">
              <input type="text" value={messageText} onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && messageText.trim()) { e.preventDefault(); sendMutation.mutate(messageText.trim()); } }}
                placeholder="Message patient…"
                className="flex-1 bg-slate-800 text-white placeholder-slate-500 rounded-2xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" />
              <button disabled={!messageText.trim() || sendMutation.isPending} onClick={() => sendMutation.mutate(messageText.trim())}
                className="w-10 h-10 bg-sky-600 disabled:bg-slate-700 rounded-2xl flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}

      {/* Notes */}
      {tab === "notes" && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-safe">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-2">Diagnosis</label>
            <input type="text" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="e.g. Viral upper respiratory tract infection"
              disabled={isCompleted}
              className="w-full bg-slate-800 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-2">Clinical Notes</label>
            <textarea value={doctorNotes} onChange={(e) => setDoctorNotes(e.target.value)}
              placeholder="Observations, examination findings, plan of care…"
              rows={8}
              disabled={isCompleted}
              className="w-full bg-slate-800 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm resize-none" />
          </div>
          {!isCompleted && (
            <div className="flex gap-2">
              <Button className="flex-1" loading={savingNotes} onClick={saveNotes}>
                Save Notes
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => router.push(`/prescriptions/new?consultation=${id}`)}>
                Write Prescription
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
