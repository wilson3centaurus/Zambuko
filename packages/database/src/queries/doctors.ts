// packages/database/src/queries/doctors.ts
// Doctor-related database queries

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DoctorMatch, DoctorStatus, MedicalSpecialty } from "../types";

export async function matchDoctors(
  supabase: SupabaseClient,
  params: {
    lat: number;
    lng: number;
    specialty?: MedicalSpecialty;
    isEmergency?: boolean;
    limit?: number;
  }
): Promise<DoctorMatch[]> {
  const { data, error } = await supabase.rpc("match_doctors", {
    p_lat: params.lat,
    p_lng: params.lng,
    p_specialty: params.specialty ?? "general_practice",
    p_emergency: params.isEmergency ?? false,
    p_limit: params.limit ?? 20,
  });
  if (error) throw error;
  return (data as DoctorMatch[]) ?? [];
}

export async function getDoctorById(supabase: SupabaseClient, doctorId: string) {
  const { data, error } = await supabase
    .from("doctors")
    .select(`
      *,
      profiles!inner(id, full_name, avatar_url, city, country)
    `)
    .eq("id", doctorId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateDoctorHeartbeat(
  supabase: SupabaseClient,
  doctorId: string,
  location?: { lat: number; lng: number }
) {
  const update: Record<string, unknown> = { heartbeat_at: new Date().toISOString() };
  if (location) {
    update.location_lat = location.lat;
    update.location_lng = location.lng;
  }
  const { error } = await supabase
    .from("doctors")
    .update(update)
    .eq("id", doctorId);
  if (error) throw error;
}

export async function setDoctorStatus(
  supabase: SupabaseClient,
  doctorId: string,
  status: DoctorStatus
) {
  const { error } = await supabase
    .from("doctors")
    .update({ status, heartbeat_at: new Date().toISOString() })
    .eq("id", doctorId);
  if (error) throw error;
}

export async function getPendingConsultationsForDoctor(
  supabase: SupabaseClient,
  specialty: MedicalSpecialty
) {
  const { data, error } = await supabase
    .from("consultations")
    .select(`
      id, chief_complaint, symptoms, triage_level, triage_score,
      type, created_at,
      profiles!patient_id(id, full_name, avatar_url)
    `)
    .eq("status", "pending")
    .order("triage_score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}
