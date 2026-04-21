// packages/database/src/queries/prescriptions.ts

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MedicationItem } from "../types";

export async function createPrescription(
  supabase: SupabaseClient,
  params: {
    consultationId: string;
    patientId: string;
    doctorId: string;
    medications: MedicationItem[];
    notes?: string;
    validDays?: number;
    pharmacyId?: string;
  }
) {
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + (params.validDays ?? 30));

  const { data, error } = await supabase
    .from("prescriptions")
    .insert({
      consultation_id: params.consultationId,
      patient_id: params.patientId,
      doctor_id: params.doctorId,
      medications: params.medications,
      doctor_notes: params.notes,
      pharmacy_id: params.pharmacyId,
      valid_until: validUntil.toISOString().split("T")[0],
      status: "issued",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function getPatientPrescriptions(supabase: SupabaseClient, patientId: string) {
  const { data, error } = await supabase
    .from("prescriptions")
    .select(`
      *,
      doctor:profiles!doctor_id(id, full_name, avatar_url),
      pharmacy:pharmacies(id, name, address, phone)
    `)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getDoctorPrescriptions(supabase: SupabaseClient, doctorId: string) {
  const { data, error } = await supabase
    .from("prescriptions")
    .select(`
      *,
      patient:profiles!patient_id(id, full_name, avatar_url, phone)
    `)
    .eq("doctor_id", doctorId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function updatePrescriptionStatus(
  supabase: SupabaseClient,
  prescriptionId: string,
  status: "sent_to_pharmacy" | "dispensed" | "collected" | "cancelled",
  pharmacyId?: string
) {
  const update: Record<string, unknown> = { status };
  if (pharmacyId) update.pharmacy_id = pharmacyId;
  if (status === "dispensed") update.dispensed_at = new Date().toISOString();
  if (status === "collected") update.collected_at = new Date().toISOString();

  const { error } = await supabase
    .from("prescriptions")
    .update(update)
    .eq("id", prescriptionId);
  if (error) throw error;
}
