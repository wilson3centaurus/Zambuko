-- ============================================================
-- ZAMBUKO TELEHEALTH — INITIAL SCHEMA
-- Migration: 20260402000001_initial_schema.sql
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- fuzzy text search for doctor names

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE public.user_role AS ENUM (
  'patient', 'doctor', 'dispatcher', 'admin', 'pharmacy'
);

CREATE TYPE public.doctor_status AS ENUM (
  'available', 'in_session', 'offline', 'busy'
);

CREATE TYPE public.consultation_status AS ENUM (
  'pending', 'accepted', 'active', 'completed', 'cancelled', 'no_show'
);

CREATE TYPE public.consultation_type AS ENUM (
  'video', 'audio', 'chat'
);

CREATE TYPE public.triage_level AS ENUM (
  'low', 'moderate', 'high', 'emergency'
);

CREATE TYPE public.emergency_status AS ENUM (
  'pending', 'dispatched', 'en_route', 'arrived', 'resolved', 'cancelled'
);

CREATE TYPE public.emergency_type AS ENUM (
  'chest_pain', 'trauma', 'respiratory', 'stroke', 'maternity',
  'poisoning', 'burns', 'accident', 'other'
);

CREATE TYPE public.dispatcher_status AS ENUM (
  'available', 'en_route', 'on_scene', 'offline'
);

CREATE TYPE public.payment_status AS ENUM (
  'pending', 'success', 'failed', 'refunded', 'expired'
);

CREATE TYPE public.payment_provider AS ENUM (
  'ecocash', 'onemoney', 'telecash', 'visa', 'mastercard'
);

CREATE TYPE public.prescription_status AS ENUM (
  'issued', 'sent_to_pharmacy', 'dispensed', 'collected', 'cancelled', 'expired'
);

CREATE TYPE public.message_type AS ENUM (
  'text', 'image', 'file', 'system', 'prescription'
);

CREATE TYPE public.medical_specialty AS ENUM (
  'general_practice', 'emergency_medicine', 'pediatrics', 'obstetrics',
  'cardiology', 'dermatology', 'psychiatry', 'orthopedics',
  'ophthalmology', 'ent', 'dentistry', 'neurology', 'urology', 'other'
);

-- ============================================================
-- CORE TABLES
-- ============================================================

-- Profiles: extends Supabase auth.users; one row per user
CREATE TABLE public.profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role                public.user_role          NOT NULL DEFAULT 'patient',
  full_name           TEXT                      NOT NULL,
  phone               TEXT,
  avatar_url          TEXT,
  date_of_birth       DATE,
  gender              TEXT CHECK (gender IN ('male', 'female', 'other')),
  city                TEXT,
  province            TEXT,
  country             TEXT                      NOT NULL DEFAULT 'Zimbabwe',
  address             TEXT,
  fcm_token           TEXT,            -- Firebase Cloud Messaging for push notifications
  preferred_language  TEXT             NOT NULL DEFAULT 'en',
  low_bandwidth_mode  BOOLEAN          NOT NULL DEFAULT FALSE,
  is_active           BOOLEAN          NOT NULL DEFAULT TRUE,
  onboarding_complete BOOLEAN          NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- Doctors: one row per doctor (in addition to profiles row)
CREATE TABLE public.doctors (
  id                       UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  specialty                public.medical_specialty NOT NULL DEFAULT 'general_practice',
  medical_license_number   TEXT UNIQUE NOT NULL,
  license_verified         BOOLEAN     NOT NULL DEFAULT FALSE,
  license_document_url     TEXT,
  years_experience         INTEGER     NOT NULL DEFAULT 0,
  bio                      TEXT,
  consultation_fee_usd     DECIMAL(10,2) NOT NULL DEFAULT 5.00,
  status                   public.doctor_status NOT NULL DEFAULT 'offline',
  heartbeat_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rating                   DECIMAL(3,2) NOT NULL DEFAULT 5.00 CHECK (rating >= 0 AND rating <= 5),
  rating_count             INTEGER NOT NULL DEFAULT 0,
  queue_length             INTEGER NOT NULL DEFAULT 0 CHECK (queue_length >= 0),
  location_lat             DECIMAL(10,8),
  location_lng             DECIMAL(11,8),
  location_name            TEXT,
  emergency_capable        BOOLEAN NOT NULL DEFAULT FALSE,
  hospital_affiliation     TEXT,
  languages_spoken         TEXT[]  DEFAULT ARRAY['en'],
  available_days           TEXT[]  DEFAULT ARRAY['mon','tue','wed','thu','fri'],
  available_from           TIME,
  available_to             TIME,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Patients: one row per patient
CREATE TABLE public.patients (
  id                           UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  national_id                  TEXT UNIQUE,
  blood_type                   TEXT CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-','unknown')),
  height_cm                    INTEGER,
  weight_kg                    DECIMAL(5,1),
  allergies                    TEXT[]  DEFAULT ARRAY[]::TEXT[],
  chronic_conditions           TEXT[]  DEFAULT ARRAY[]::TEXT[],
  current_medications          TEXT[]  DEFAULT ARRAY[]::TEXT[],
  emergency_contact_name       TEXT,
  emergency_contact_phone      TEXT,
  emergency_contact_relation   TEXT,
  insurance_provider           TEXT,
  insurance_number             TEXT,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dispatchers: ambulance drivers / paramedics
CREATE TABLE public.dispatchers (
  id            UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_id    TEXT UNIQUE NOT NULL,
  vehicle_type  TEXT NOT NULL DEFAULT 'ambulance',
  license_plate TEXT,
  organization  TEXT NOT NULL,
  status        public.dispatcher_status NOT NULL DEFAULT 'offline',
  location_lat  DECIMAL(10,8),
  location_lng  DECIMAL(11,8),
  heading       DECIMAL(5,2),  -- degrees 0-360
  speed_kmh     DECIMAL(5,2),
  heartbeat_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pharmacies
CREATE TABLE public.pharmacies (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                 TEXT NOT NULL,
  address              TEXT NOT NULL,
  city                 TEXT NOT NULL,
  location_lat         DECIMAL(10,8),
  location_lng         DECIMAL(11,8),
  phone                TEXT,
  email                TEXT,
  operating_hours_from TIME,
  operating_hours_to   TIME,
  operating_days       TEXT[]  DEFAULT ARRAY['mon','tue','wed','thu','fri','sat'],
  delivery_available   BOOLEAN NOT NULL DEFAULT TRUE,
  delivery_radius_km   DECIMAL(5,2) DEFAULT 10.0,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Consultations
CREATE TABLE public.consultations (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id           UUID NOT NULL REFERENCES public.profiles(id),
  doctor_id            UUID REFERENCES public.profiles(id),
  triage_level         public.triage_level,
  triage_score         DECIMAL(5,2),
  triage_data          JSONB DEFAULT '{}',   -- full AI response
  type                 public.consultation_type NOT NULL DEFAULT 'chat',
  status               public.consultation_status NOT NULL DEFAULT 'pending',
  chief_complaint      TEXT NOT NULL,
  symptoms             TEXT[] DEFAULT ARRAY[]::TEXT[],
  doctor_notes         TEXT,
  diagnosis            TEXT,
  follow_up_date       DATE,
  video_room_name      TEXT,                 -- LiveKit room name
  video_room_expires_at TIMESTAMPTZ,
  started_at           TIMESTAMPTZ,
  ended_at             TIMESTAMPTZ,
  duration_minutes     INTEGER,
  patient_rating       INTEGER CHECK (patient_rating BETWEEN 1 AND 5),
  patient_review       TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages (real-time chat within a consultation)
CREATE TABLE public.messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consultation_id UUID NOT NULL REFERENCES public.consultations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES public.profiles(id),
  type            public.message_type NOT NULL DEFAULT 'text',
  content         TEXT,
  file_url        TEXT,
  file_name       TEXT,
  file_size_bytes INTEGER,
  file_mime_type  TEXT,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prescriptions
CREATE TABLE public.prescriptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consultation_id UUID NOT NULL REFERENCES public.consultations(id),
  patient_id      UUID NOT NULL REFERENCES public.profiles(id),
  doctor_id       UUID NOT NULL REFERENCES public.profiles(id),
  pharmacy_id     UUID REFERENCES public.pharmacies(id),
  -- medications JSON: [{name, dosage, frequency, duration_days, instructions, quantity}]
  medications     JSONB NOT NULL DEFAULT '[]',
  status          public.prescription_status NOT NULL DEFAULT 'issued',
  doctor_notes    TEXT,
  dispensing_notes TEXT,
  valid_until     DATE NOT NULL,
  dispensed_at    TIMESTAMPTZ,
  collected_at    TIMESTAMPTZ,
  pdf_url         TEXT,  -- Supabase Storage URL for PDF
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Emergencies
CREATE TABLE public.emergencies (
  id                         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id                 UUID NOT NULL REFERENCES public.profiles(id),
  dispatcher_id              UUID REFERENCES public.profiles(id),
  type                       public.emergency_type NOT NULL DEFAULT 'other',
  description                TEXT,
  status                     public.emergency_status NOT NULL DEFAULT 'pending',
  -- priority: 1=low, 2=medium, 3=high, 4=critical, 5=immediate (life-threatening)
  priority                   INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  patient_lat                DECIMAL(10,8) NOT NULL,
  patient_lng                DECIMAL(11,8) NOT NULL,
  patient_address            TEXT,
  dispatcher_lat             DECIMAL(10,8),
  dispatcher_lng             DECIMAL(11,8),
  estimated_arrival_minutes  INTEGER,
  actual_arrival_minutes     INTEGER,
  dispatched_at              TIMESTAMPTZ,
  arrived_at                 TIMESTAMPTZ,
  resolved_at                TIMESTAMPTZ,
  resolution_notes           TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payments
CREATE TABLE public.payments (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consultation_id      UUID NOT NULL REFERENCES public.consultations(id),
  patient_id           UUID NOT NULL REFERENCES public.profiles(id),
  doctor_id            UUID NOT NULL REFERENCES public.profiles(id),
  provider             public.payment_provider NOT NULL,
  amount_usd           DECIMAL(10,2) NOT NULL,
  amount_local         DECIMAL(15,2),
  currency_code        TEXT NOT NULL DEFAULT 'USD',
  status               public.payment_status NOT NULL DEFAULT 'pending',
  paynow_ref           TEXT,          -- Paynow Zimbabwe's reference
  paynow_poll_url      TEXT,          -- URL to poll for status
  phone_number         TEXT,          -- mobile money number
  failure_reason       TEXT,
  paid_at              TIMESTAMPTZ,
  platform_fee_usd     DECIMAL(10,2), -- Zambuko's 10% cut
  doctor_payout_usd    DECIMAL(10,2), -- 90% to doctor
  payout_processed     BOOLEAN NOT NULL DEFAULT FALSE,
  payout_processed_at  TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Doctor ratings (one per consultation)
CREATE TABLE public.doctor_ratings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id       UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES public.profiles(id),
  consultation_id UUID NOT NULL REFERENCES public.consultations(id),
  rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review          TEXT,
  is_anonymous    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(consultation_id) -- one rating per consultation
);

-- Appointments (scheduled future consultations)
CREATE TABLE public.appointments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id          UUID NOT NULL REFERENCES public.profiles(id),
  doctor_id           UUID NOT NULL REFERENCES public.profiles(id),
  consultation_id     UUID REFERENCES public.consultations(id),
  scheduled_at        TIMESTAMPTZ NOT NULL,
  duration_minutes    INTEGER NOT NULL DEFAULT 20,
  type                public.consultation_type NOT NULL DEFAULT 'video',
  status              TEXT NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled','confirmed','completed','cancelled','no_show')),
  patient_notes       TEXT,
  reminder_sent_at    TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE public.notifications (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  data         JSONB DEFAULT '{}',
  action_url   TEXT,
  is_read      BOOLEAN NOT NULL DEFAULT FALSE,
  read_at      TIMESTAMPTZ,
  push_sent    BOOLEAN NOT NULL DEFAULT FALSE,
  push_sent_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Offline sync queue (device-level operations queued when offline)
CREATE TABLE public.offline_sync_queue (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id   TEXT NOT NULL,
  user_id     UUID REFERENCES public.profiles(id),
  table_name  TEXT NOT NULL,
  operation   TEXT NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  record_id   UUID,
  payload     JSONB NOT NULL,
  synced      BOOLEAN NOT NULL DEFAULT FALSE,
  synced_at   TIMESTAMPTZ,
  error       TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log (immutable — no UPDATE/DELETE)
CREATE TABLE public.audit_logs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES public.profiles(id),
  action     TEXT NOT NULL,
  table_name TEXT,
  record_id  UUID,
  old_data   JSONB,
  new_data   JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_profiles_role          ON public.profiles(role);
CREATE INDEX idx_profiles_phone         ON public.profiles(phone);
CREATE INDEX idx_profiles_name_trgm     ON public.profiles USING gin(full_name gin_trgm_ops);

CREATE INDEX idx_doctors_status         ON public.doctors(status);
CREATE INDEX idx_doctors_specialty      ON public.doctors(specialty);
CREATE INDEX idx_doctors_heartbeat      ON public.doctors(heartbeat_at);
CREATE INDEX idx_doctors_location       ON public.doctors(location_lat, location_lng);
CREATE INDEX idx_doctors_emergency      ON public.doctors(emergency_capable) WHERE emergency_capable = TRUE;

CREATE INDEX idx_dispatchers_status     ON public.dispatchers(status);
CREATE INDEX idx_dispatchers_heartbeat  ON public.dispatchers(heartbeat_at);
CREATE INDEX idx_dispatchers_location   ON public.dispatchers(location_lat, location_lng);

CREATE INDEX idx_consultations_patient  ON public.consultations(patient_id);
CREATE INDEX idx_consultations_doctor   ON public.consultations(doctor_id);
CREATE INDEX idx_consultations_status   ON public.consultations(status);
CREATE INDEX idx_consultations_created  ON public.consultations(created_at DESC);
CREATE INDEX idx_consultations_pending  ON public.consultations(status, created_at) WHERE status = 'pending';

CREATE INDEX idx_messages_consultation  ON public.messages(consultation_id, created_at);
CREATE INDEX idx_messages_unread        ON public.messages(consultation_id) WHERE NOT is_read;

CREATE INDEX idx_prescriptions_patient  ON public.prescriptions(patient_id);
CREATE INDEX idx_prescriptions_doctor   ON public.prescriptions(doctor_id);
CREATE INDEX idx_prescriptions_status   ON public.prescriptions(status);

CREATE INDEX idx_emergencies_status     ON public.emergencies(status);
CREATE INDEX idx_emergencies_patient    ON public.emergencies(patient_id);
CREATE INDEX idx_emergencies_priority   ON public.emergencies(priority DESC, created_at) WHERE status = 'pending';

CREATE INDEX idx_payments_consultation  ON public.payments(consultation_id);
CREATE INDEX idx_payments_status        ON public.payments(status);
CREATE INDEX idx_payments_patient       ON public.payments(patient_id);

CREATE INDEX idx_notifications_user     ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread   ON public.notifications(user_id) WHERE NOT is_read;

CREATE INDEX idx_offline_queue_device   ON public.offline_sync_queue(device_id, created_at);
CREATE INDEX idx_offline_queue_unsynced ON public.offline_sync_queue(user_id) WHERE NOT synced;

CREATE INDEX idx_appointments_patient   ON public.appointments(patient_id, scheduled_at);
CREATE INDEX idx_appointments_doctor    ON public.appointments(doctor_id, scheduled_at);
CREATE INDEX idx_appointments_upcoming  ON public.appointments(scheduled_at) WHERE status IN ('scheduled','confirmed');
