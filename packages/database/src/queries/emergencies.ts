// packages/database/src/queries/emergencies.ts

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmergencyType, EmergencyStatus } from "../types";

export async function createEmergency(
  supabase: SupabaseClient,
  params: {
    patientId: string;
    type: EmergencyType;
    description?: string;
    lat: number;
    lng: number;
    address?: string;
    priority?: 1 | 2 | 3 | 4 | 5;
  }
) {
  const { data, error } = await supabase
    .from("emergencies")
    .insert({
      patient_id: params.patientId,
      type: params.type,
      description: params.description,
      patient_lat: params.lat,
      patient_lng: params.lng,
      patient_address: params.address,
      priority: params.priority ?? 4, // default critical
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function dispatchNearestResponder(
  supabase: SupabaseClient,
  emergencyId: string,
  patientLat: number,
  patientLng: number
) {
  const { data, error } = await supabase.rpc("dispatch_nearest_responder", {
    p_emergency_id: emergencyId,
    p_patient_lat: patientLat,
    p_patient_lng: patientLng,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function getEmergencyById(supabase: SupabaseClient, emergencyId: string) {
  const { data, error } = await supabase
    .from("emergencies")
    .select(`
      *,
      patient:profiles!patient_id(id, full_name, phone, avatar_url),
      dispatcher:profiles!dispatcher_id(id, full_name, phone)
    `)
    .eq("id", emergencyId)
    .single();
  if (error) throw error;
  return data;
}

export async function getActiveEmergencies(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("emergencies")
    .select(`
      id, type, status, priority, patient_lat, patient_lng,
      patient_address, created_at, dispatched_at, estimated_arrival_minutes,
      patient:profiles!patient_id(id, full_name, phone)
    `)
    .in("status", ["pending", "dispatched", "en_route"])
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function updateEmergencyStatus(
  supabase: SupabaseClient,
  emergencyId: string,
  status: EmergencyStatus,
  extra?: { dispatcherLat?: number; dispatcherLng?: number; notes?: string }
) {
  const update: Record<string, unknown> = { status };
  if (extra?.dispatcherLat) update.dispatcher_lat = extra.dispatcherLat;
  if (extra?.dispatcherLng) update.dispatcher_lng = extra.dispatcherLng;
  if (extra?.notes) update.resolution_notes = extra.notes;
  if (status === "arrived") update.arrived_at = new Date().toISOString();
  if (status === "resolved") update.resolved_at = new Date().toISOString();

  const { error } = await supabase
    .from("emergencies")
    .update(update)
    .eq("id", emergencyId);
  if (error) throw error;
}

export async function getPatientEmergencies(supabase: SupabaseClient, patientId: string) {
  const { data, error } = await supabase
    .from("emergencies")
    .select("id, type, status, priority, created_at, resolved_at, estimated_arrival_minutes")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}
