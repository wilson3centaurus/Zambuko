// packages/offline/src/schema.ts
// Dexie.js local database schema — mirrors Supabase tables for offline-first access
// Pattern: network-first with local fallback; write to local first, sync to server

import Dexie, { type EntityTable } from "dexie";

// ─── Local table shapes (subset of server schema) ───────────────────────────

interface LocalProfile {
  id: string;
  role: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  low_bandwidth_mode: boolean;
  updated_at: string;
}

interface LocalDoctor {
  id: string;
  full_name: string;
  specialty: string;
  status: string;
  rating: number;
  queue_length: number;
  location_lat: number | null;
  location_lng: number | null;
  consultation_fee_usd: number;
  avatar_url: string | null;
  bio: string | null;
  heartbeat_at: string;
  updated_at: string;
}

interface LocalConsultation {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  status: string;
  type: string;
  triage_level: string | null;
  chief_complaint: string;
  symptoms: string[];
  doctor_notes: string | null;
  diagnosis: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
  // Local-only fields
  _is_dirty: boolean;        // has unsynced changes
  _sync_error: string | null;
}

interface LocalMessage {
  id: string;
  consultation_id: string;
  sender_id: string;
  type: string;
  content: string | null;
  file_url: string | null;
  is_read: boolean;
  created_at: string;
  // Local-only
  _is_pending: boolean;     // not yet sent to server
  _temp_id?: string;        // used before server assigns real UUID
}

interface LocalPrescription {
  id: string;
  consultation_id: string;
  patient_id: string;
  doctor_id: string;
  medications: unknown[];
  status: string;
  valid_until: string;
  created_at: string;
  updated_at: string;
}

interface LocalEmergency {
  id: string;
  patient_id: string;
  type: string;
  status: string;
  priority: number;
  patient_lat: number;
  patient_lng: number;
  dispatcher_id: string | null;
  estimated_arrival_minutes: number | null;
  created_at: string;
  updated_at: string;
  _is_dirty: boolean;
}

interface SyncQueueEntry {
  id?: number;              // auto-increment local PK
  operation: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record_id: string;
  payload: Record<string, unknown>;
  created_at: string;
  retry_count: number;
  last_error: string | null;
}

// ─── Zambuko Local Database ──────────────────────────────────────────────────

class ZambukoLocalDB extends Dexie {
  profiles!:      EntityTable<LocalProfile,      "id">;
  doctors!:       EntityTable<LocalDoctor,        "id">;
  consultations!: EntityTable<LocalConsultation,  "id">;
  messages!:      EntityTable<LocalMessage,        "id">;
  prescriptions!: EntityTable<LocalPrescription,  "id">;
  emergencies!:   EntityTable<LocalEmergency,     "id">;
  sync_queue!:    EntityTable<SyncQueueEntry,      "id">;

  constructor() {
    super("zambuko-v1");

    this.version(1).stores({
      profiles:      "id, role, updated_at",
      doctors:       "id, status, specialty, updated_at",
      consultations: "id, patient_id, doctor_id, status, created_at, _is_dirty",
      messages:      "id, consultation_id, created_at, _is_pending",
      prescriptions: "id, patient_id, consultation_id, status, updated_at",
      emergencies:   "id, patient_id, status, priority, created_at, _is_dirty",
      sync_queue:    "++id, table, record_id, created_at",
    });
  }
}

// Singleton instance — safe to call in SSR (returns null on server)
let _db: ZambukoLocalDB | null = null;

export function getLocalDB(): ZambukoLocalDB | null {
  if (typeof window === "undefined") return null;
  if (!_db) _db = new ZambukoLocalDB();
  return _db;
}

export type {
  LocalProfile,
  LocalDoctor,
  LocalConsultation,
  LocalMessage,
  LocalPrescription,
  LocalEmergency,
  SyncQueueEntry,
};
