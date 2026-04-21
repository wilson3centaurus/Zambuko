"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useRoomContext,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { createClient } from "@zambuko/database/client";
import { getConsultationById, getMessages, sendMessage } from "@zambuko/database";
import { Button } from "@zambuko/ui";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";

type Tab = "chat" | "video";

export default function ConsultationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("chat");
  const [messageText, setMessageText] = useState("");
  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const { data: consultation, isLoading } = useQuery({
    queryKey: ["consultation", id],
    queryFn: () => getConsultationById(supabase, id),
    refetchInterval: 5000,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", id],
    queryFn: () => getMessages(supabase, id),
    refetchInterval: false,
  });

  // Subscribe to real-time messages
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`consultation:${id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `consultation_id=eq.${id}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ["messages", id] });
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "consultations",
        filter: `id=eq.${id}`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }, (payload: any) => {
        if (payload.new?.status === "accepted") {
          toast.success("Your doctor has accepted your consultation! You can now start chatting.");
        } else if (payload.new?.status === "active") {
          toast.success("Your consultation is now active!");
        }
        qc.invalidateQueries({ queryKey: ["consultation", id] });
      })
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [id, supabase, qc]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      return sendMessage(supabase, {
        consultationId: id,
        senderId: user.id,
        type: "text",
        content: text,
      });
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
      body: { consultation_id: id, user_id: user.id, is_doctor: false },
    });
    if (error || !data?.token) {
      toast.error("Could not start video call. Try again.");
      return;
    }
    setLivekitToken(data.token);
    setTab("video");
  }

  async function endConsultation() {
    if (!confirm("End this consultation?")) return;
    await supabase
      .from("consultations")
      .update({ status: "completed" })
      .eq("id", id);
    toast.success("Consultation ended.");
    router.push("/dashboard");
  }

  async function cancelConsultation() {
    if (!confirm("Cancel this appointment? This cannot be undone.")) return;
    const { error } = await supabase
      .from("consultations")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) { toast.error("Could not cancel. Please try again."); return; }
    toast.success("Appointment cancelled.");
    router.push("/dashboard");
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading consultation…</p>
        </div>
      </div>
    );
  }

  if (!consultation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Consultation not found.</p>
          <Button variant="ghost" className="mt-3" onClick={() => router.push("/dashboard")}>Go Home</Button>
        </div>
      </div>
    );
  }

  const isPending = consultation.status === "pending";
  const isAccepted = consultation.status === "accepted";
  const isActive = consultation.status === "active";
  const isCompleted = ["completed", "cancelled", "no_show"].includes(consultation.status);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push("/dashboard")} className="p-1.5 rounded-xl text-gray-400 hover:bg-gray-800">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(consultation as any).doctor?.full_name ? `Dr. ${(consultation as any).doctor.full_name}` : "Awaiting Doctor"}
          </p>
          <p className="text-xs text-gray-400 capitalize">{consultation.status.replace("_", " ")}</p>
        </div>
        {!isCompleted && (
          <div className="flex gap-2">
            {(isAccepted || isActive) && !livekitToken && (
              <button onClick={fetchLivekitToken}
                className="p-2 rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            )}
            {isPending ? (
              <button onClick={cancelConsultation}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-900/50 text-red-400 hover:bg-red-900 transition-colors text-xs font-semibold">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </button>
            ) : (
              <button onClick={endConsultation}
                className="p-2 rounded-xl bg-red-900/50 text-red-400 hover:bg-red-900 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="bg-gray-900 px-4 pb-2 flex gap-2">
        <button onClick={() => setTab("chat")}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${tab === "chat" ? "bg-brand-600 text-white" : "text-gray-400 hover:text-white"}`}>
          💬 Chat
        </button>
        {livekitToken && (
          <button onClick={() => setTab("video")}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${tab === "video" ? "bg-brand-600 text-white" : "text-gray-400 hover:text-white"}`}>
            📹 Video
          </button>
        )}
      </div>

      {/* Status banner */}
      {isPending && (
        <div className="bg-amber-900/40 border-b border-amber-700/50 px-4 py-3 flex items-center gap-2">
          <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
          <p className="text-amber-300 text-sm">Waiting for a doctor to accept your consultation…</p>
        </div>
      )}
      {isAccepted && (
        <div className="bg-teal-900/40 border-b border-teal-700/50 px-4 py-3 flex items-center gap-2">
          <div className="w-2 h-2 bg-teal-400 rounded-full" />
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <p className="text-teal-300 text-sm">✅ {(consultation as any).doctor?.full_name ? `Dr. ${(consultation as any).doctor.full_name} has accepted` : "Doctor accepted"} — you can start chatting!</p>
        </div>
      )}
      {isCompleted && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 text-center">
          <p className="text-gray-400 text-sm">This consultation has ended.</p>
          {!consultation.patient_rating && (
            <button onClick={() => router.push(`/consultation/${id}/rate`)}
              className="text-brand-400 text-sm font-semibold mt-1 hover:underline">
              Rate your doctor →
            </button>
          )}
        </div>
      )}

      {/* Video tab */}
      {tab === "video" && livekitToken && (
        <div className="flex-1 relative">
          <LiveKitRoom
            token={livekitToken}
            serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
            video={true}
            audio={true}
            connect={true}
            onDisconnected={() => { setLivekitToken(null); setTab("chat"); }}
          >
            <VideoConference />
            <RoomAudioRenderer />
          </LiveKitRoom>
        </div>
      )}

      {/* Chat tab */}
      {tab === "chat" && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 text-sm py-8">
                Start the conversation. The doctor can see everything you send.
              </div>
            )}
            {messages.map((msg) => {
              const isOwn = msg.sender?.[0]?.id === consultation.patient_id;
              return (
                <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${isOwn ? "bg-brand-600 text-white rounded-br-md" : "bg-gray-800 text-gray-100 rounded-bl-md"}`}>
                    {msg.type === "system" ? (
                      <p className="text-xs text-gray-400 italic text-center">{msg.content}</p>
                    ) : (
                      <>
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                        <p className={`text-xs mt-1 ${isOwn ? "text-brand-200" : "text-gray-500"}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {!isCompleted && (
            <div className="bg-gray-900 border-t border-gray-800 px-4 py-3 pb-safe">
              <div className="flex gap-2 items-end">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && messageText.trim()) {
                      e.preventDefault();
                      sendMutation.mutate(messageText.trim());
                    }
                  }}
                  placeholder={isPending ? "Doctor not yet assigned…" : "Type a message…"}
                  disabled={isPending || sendMutation.isPending}
                  className="flex-1 bg-gray-800 text-white placeholder-gray-500 rounded-2xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm resize-none"
                />
                <button
                  disabled={!messageText.trim() || sendMutation.isPending || isPending}
                  onClick={() => sendMutation.mutate(messageText.trim())}
                  className="flex-shrink-0 w-10 h-10 bg-brand-600 disabled:bg-gray-700 rounded-2xl flex items-center justify-center transition-colors">
                  {sendMutation.isPending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
