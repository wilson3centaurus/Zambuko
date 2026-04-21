// supabase/functions/livekit-token/index.ts
// Generates LiveKit room tokens for video/audio consultations
// Called when a consultation moves to 'active' status

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AccessToken } from "https://esm.sh/livekit-server-sdk@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { consultation_id } = await req.json();
    if (!consultation_id) {
      return new Response(JSON.stringify({ error: "consultation_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is a participant in this consultation using service role
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: consultation, error: consultError } = await adminClient
      .from("consultations")
      .select("id, patient_id, doctor_id, status, type, video_room_name")
      .eq("id", consultation_id)
      .single();

    if (consultError || !consultation) {
      return new Response(JSON.stringify({ error: "Consultation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isParticipant =
      consultation.patient_id === user.id || consultation.doctor_id === user.id;

    if (!isParticipant) {
      return new Response(JSON.stringify({ error: "Not a participant in this consultation" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["accepted", "active"].includes(consultation.status)) {
      return new Response(JSON.stringify({ error: "Consultation is not active" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["video", "audio"].includes(consultation.type)) {
      return new Response(JSON.stringify({ error: "Not a video/audio consultation" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isDoctor = consultation.doctor_id === user.id;
    const roomName = `consultation-${consultation_id}`;

    const at = new AccessToken(
      Deno.env.get("LIVEKIT_API_KEY")!,
      Deno.env.get("LIVEKIT_API_SECRET")!,
      {
        identity: user.id,
        name: isDoctor ? "Doctor" : "Patient",
        ttl: "2h",
      }
    );

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,            // both can publish audio/video
      canSubscribe: true,          // both can receive
      canPublishData: true,        // for chat overlay
      roomAdmin: isDoctor,         // doctor can mute/remove
    });

    const token = await at.toJwt();

    // Update consultation with room name if not already set
    if (!consultation.video_room_name) {
      await adminClient
        .from("consultations")
        .update({
          video_room_name: roomName,
          video_room_expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          status: "active",
          started_at: new Date().toISOString(),
        })
        .eq("id", consultation_id);
    }

    return new Response(
      JSON.stringify({
        token,
        room: roomName,
        livekit_url: Deno.env.get("LIVEKIT_URL"),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("LiveKit token error:", error);
    return new Response(JSON.stringify({ error: "Failed to generate video token" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
