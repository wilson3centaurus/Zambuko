// packages/database/src/queries/consultations.ts

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConsultationStatus, ConsultationType, TriageLevel, TriageResult } from "../types";

export async function createConsultation(
  supabase: SupabaseClient,
  params: {
    patientId: string;
    chiefComplaint: string;
    symptoms: string[];
    type: ConsultationType;
    triageLevel?: TriageLevel;
    triageScore?: number;
    triageData?: TriageResult;
  }
) {
  const { data, error } = await supabase
    .from("consultations")
    .insert({
      patient_id: params.patientId,
      chief_complaint: params.chiefComplaint,
      symptoms: params.symptoms,
      type: params.type,
      triage_level: params.triageLevel,
      triage_score: params.triageScore,
      triage_data: params.triageData ?? {},
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function getConsultationById(supabase: SupabaseClient, consultationId: string) {
  const { data, error } = await supabase
    .from("consultations")
    .select(`
      *,
      patient:profiles!patient_id(id, full_name, avatar_url, phone),
      doctor:profiles!doctor_id(id, full_name, avatar_url)
    `)
    .eq("id", consultationId)
    .single();
  if (error) throw error;
  return data;
}

export async function getPatientConsultations(supabase: SupabaseClient, patientId: string) {
  const { data, error } = await supabase
    .from("consultations")
    .select(`
      id, status, type, triage_level, chief_complaint,
      started_at, ended_at, duration_minutes, created_at,
      doctor:profiles!doctor_id(id, full_name, avatar_url)
    `)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function getDoctorConsultations(
  supabase: SupabaseClient,
  doctorId: string,
  status?: ConsultationStatus | ConsultationStatus[]
) {
  let query = supabase
    .from("consultations")
    .select(`
      id, status, type, triage_level, chief_complaint,
      started_at, ended_at, duration_minutes, created_at,
      patient:profiles!patient_id(id, full_name, avatar_url)
    `)
    .eq("doctor_id", doctorId);

  if (status) {
    const statuses = Array.isArray(status) ? status : [status];
    query = query.in("status", statuses);
  } else {
    query = query.in("status", ["accepted", "active", "completed"]);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function updateConsultationStatus(
  supabase: SupabaseClient,
  consultationId: string,
  status: ConsultationStatus,
  extra?: { doctorId?: string; notes?: string; diagnosis?: string }
) {
  const update: Record<string, unknown> = { status };
  if (extra?.doctorId) update.doctor_id = extra.doctorId;
  if (extra?.notes !== undefined) update.doctor_notes = extra.notes;
  if (extra?.diagnosis !== undefined) update.diagnosis = extra.diagnosis;

  const { error } = await supabase
    .from("consultations")
    .update(update)
    .eq("id", consultationId);
  if (error) throw error;
}

export async function sendMessage(
  supabase: SupabaseClient,
  params: {
    consultationId: string;
    senderId: string;
    content: string;
    type?: "text" | "image" | "file";
    fileUrl?: string;
    fileName?: string;
  }
) {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      consultation_id: params.consultationId,
      sender_id: params.senderId,
      type: params.type ?? "text",
      content: params.content,
      file_url: params.fileUrl,
      file_name: params.fileName,
    })
    .select("id, created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function getMessages(supabase: SupabaseClient, consultationId: string) {
  const { data, error } = await supabase
    .from("messages")
    .select(`
      id, type, content, file_url, file_name, is_read, created_at,
      sender:profiles!sender_id(id, full_name, avatar_url)
    `)
    .eq("consultation_id", consultationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function rateConsultation(
  supabase: SupabaseClient,
  params: {
    consultationId: string;
    doctorId: string;
    patientId: string;
    rating: 1 | 2 | 3 | 4 | 5;
    review?: string;
  }
) {
  // Update consultation rating
  await supabase
    .from("consultations")
    .update({ patient_rating: params.rating, patient_review: params.review })
    .eq("id", params.consultationId);

  // Insert detailed rating record
  const { error } = await supabase.from("doctor_ratings").insert({
    consultation_id: params.consultationId,
    doctor_id: params.doctorId,
    patient_id: params.patientId,
    rating: params.rating,
    review: params.review,
  });
  if (error && !error.message.includes("unique")) throw error; // ignore duplicate
}
