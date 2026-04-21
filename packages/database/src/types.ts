// packages/database/src/types.ts
// Database type definitions — regenerate with: pnpm db:types
// These mirror the Supabase PostgreSQL schema exactly

export type UserRole = "patient" | "doctor" | "dispatcher" | "admin" | "pharmacy";
export type DoctorStatus = "available" | "in_session" | "offline" | "busy";
export type ConsultationStatus = "pending" | "accepted" | "active" | "completed" | "cancelled" | "no_show";
export type ConsultationType = "video" | "audio" | "chat" | "in_person";
export type TriageLevel = "low" | "moderate" | "high" | "emergency";
export type EmergencyStatus = "pending" | "dispatched" | "en_route" | "arrived" | "resolved" | "cancelled";
export type EmergencyType = "chest_pain" | "trauma" | "respiratory" | "stroke" | "maternity" | "poisoning" | "burns" | "accident" | "other";
export type DispatcherStatus = "available" | "en_route" | "on_scene" | "offline";
export type PaymentStatus = "pending" | "success" | "failed" | "refunded" | "expired";
export type PaymentProvider = "ecocash" | "onemoney" | "telecash" | "visa" | "mastercard" | "cash";
export type PrescriptionStatus = "issued" | "sent_to_pharmacy" | "dispensed" | "collected" | "cancelled" | "expired";
export type MessageType = "text" | "image" | "file" | "system" | "prescription";
export type MedicalSpecialty =
  | "general_practice" | "emergency_medicine" | "pediatrics" | "obstetrics"
  | "cardiology" | "dermatology" | "psychiatry" | "orthopedics"
  | "ophthalmology" | "ent" | "dentistry" | "neurology" | "urology" | "other";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  gender: "male" | "female" | "other" | null;
  city: string | null;
  province: string | null;
  country: string;
  address: string | null;
  fcm_token: string | null;
  preferred_language: string;
  low_bandwidth_mode: boolean;
  is_active: boolean;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface Doctor {
  id: string;
  specialty: MedicalSpecialty;
  medical_license_number: string;
  license_verified: boolean;
  license_document_url: string | null;
  years_experience: number;
  bio: string | null;
  consultation_fee_usd: number;
  status: DoctorStatus;
  heartbeat_at: string;
  rating: number;
  rating_count: number;
  queue_length: number;
  location_lat: number | null;
  location_lng: number | null;
  location_name: string | null;
  emergency_capable: boolean;
  hospital_affiliation: string | null;
  languages_spoken: string[];
  available_days: string[];
  available_from: string | null;
  available_to: string | null;
  created_at: string;
  updated_at: string;
}

// Doctor with profile joined (most common usage)
export interface DoctorWithProfile extends Doctor {
  profiles: Profile;
}

// Doctor match result from RPC
export interface DoctorMatch {
  doctor_id: string;
  full_name: string;
  specialty: MedicalSpecialty;
  status: DoctorStatus;
  rating: number;
  rating_count: number;
  queue_length: number;
  distance_km: number;
  match_score: number;
  consultation_fee: number;
  avatar_url: string | null;
  bio: string | null;
  location_name: string | null;
  emergency_capable: boolean;
}

export interface Patient {
  id: string;
  national_id: string | null;
  blood_type: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  allergies: string[];
  chronic_conditions: string[];
  current_medications: string[];
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  insurance_provider: string | null;
  insurance_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface Dispatcher {
  id: string;
  vehicle_id: string;
  vehicle_type: string;
  license_plate: string | null;
  organization: string;
  status: DispatcherStatus;
  location_lat: number | null;
  location_lng: number | null;
  heading: number | null;
  speed_kmh: number | null;
  heartbeat_at: string;
  created_at: string;
  updated_at: string;
}

export interface Pharmacy {
  id: string;
  name: string;
  address: string;
  city: string;
  location_lat: number | null;
  location_lng: number | null;
  phone: string | null;
  email: string | null;
  operating_hours_from: string | null;
  operating_hours_to: string | null;
  operating_days: string[];
  delivery_available: boolean;
  delivery_radius_km: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Consultation {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  triage_level: TriageLevel | null;
  triage_score: number | null;
  triage_data: Record<string, unknown>;
  type: ConsultationType;
  status: ConsultationStatus;
  chief_complaint: string;
  symptoms: string[];
  doctor_notes: string | null;
  diagnosis: string | null;
  follow_up_date: string | null;
  video_room_name: string | null;
  video_room_expires_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  patient_rating: number | null;
  patient_review: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  consultation_id: string;
  sender_id: string;
  type: MessageType;
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  file_mime_type: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface MedicationItem {
  name: string;
  dosage: string;
  frequency: string;
  duration_days: number;
  instructions: string;
  quantity: number;
}

export interface Prescription {
  id: string;
  consultation_id: string;
  patient_id: string;
  doctor_id: string;
  pharmacy_id: string | null;
  medications: MedicationItem[];
  status: PrescriptionStatus;
  doctor_notes: string | null;
  dispensing_notes: string | null;
  valid_until: string;
  dispensed_at: string | null;
  collected_at: string | null;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Emergency {
  id: string;
  patient_id: string;
  dispatcher_id: string | null;
  type: EmergencyType;
  description: string | null;
  status: EmergencyStatus;
  priority: 1 | 2 | 3 | 4 | 5;
  patient_lat: number;
  patient_lng: number;
  patient_address: string | null;
  dispatcher_lat: number | null;
  dispatcher_lng: number | null;
  estimated_arrival_minutes: number | null;
  actual_arrival_minutes: number | null;
  dispatched_at: string | null;
  arrived_at: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  consultation_id: string;
  patient_id: string;
  doctor_id: string;
  provider: PaymentProvider;
  amount_usd: number;
  amount_local: number | null;
  currency_code: string;
  status: PaymentStatus;
  paynow_ref: string | null;
  paynow_poll_url: string | null;
  phone_number: string | null;
  failure_reason: string | null;
  paid_at: string | null;
  platform_fee_usd: number | null;
  doctor_payout_usd: number | null;
  payout_processed: boolean;
  payout_processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  consultation_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  type: ConsultationType;
  status: "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";
  patient_notes: string | null;
  reminder_sent_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  push_sent: boolean;
  push_sent_at: string | null;
  created_at: string;
}

// Triage API response
export interface TriageResult {
  level: TriageLevel;
  score: number;
  reasoning: string;
  recommendation: string;
  recommended_specialties: MedicalSpecialty[];
  red_flags: string[];
  estimated_wait_ok_hours?: number | null;
}
