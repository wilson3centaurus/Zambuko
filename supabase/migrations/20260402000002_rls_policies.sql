-- ============================================================
-- ZAMBUKO TELEHEALTH — ROW LEVEL SECURITY POLICIES
-- Migration: 20260402000002_rls_policies.sql
-- ============================================================

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatchers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergencies        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_ratings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offline_sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs         ENABLE ROW LEVEL SECURITY;
-- pharmacies readable; audit_logs admin-only via helper

-- ============================================================
-- SECURITY HELPER FUNCTIONS
-- ============================================================

-- Get the current user's role from profiles
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE
  );
$$;

-- Check if current user is a doctor
CREATE OR REPLACE FUNCTION public.is_doctor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'doctor' AND is_active = TRUE
  );
$$;

-- Check if current user is a dispatcher
CREATE OR REPLACE FUNCTION public.is_dispatcher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'dispatcher' AND is_active = TRUE
  );
$$;

-- ============================================================
-- PROFILES POLICIES
-- ============================================================

-- Own profile: full access
CREATE POLICY "profiles_own_all"
  ON public.profiles FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Doctors are publicly readable to all authenticated users (for booking)
CREATE POLICY "profiles_doctors_readable"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (role = 'doctor' AND is_active = TRUE);

-- Dispatchers readable to authenticated (for emergency map)
CREATE POLICY "profiles_dispatchers_readable"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (role = 'dispatcher');

-- Admins can read and modify all profiles
CREATE POLICY "profiles_admin_all"
  ON public.profiles FOR ALL
  USING (public.is_admin());

-- ============================================================
-- DOCTORS POLICIES
-- ============================================================

-- All authenticated users can view doctors (needed for booking)
CREATE POLICY "doctors_readable_authenticated"
  ON public.doctors FOR SELECT
  TO authenticated
  USING (TRUE);

-- Doctors manage their own record
CREATE POLICY "doctors_manage_own"
  ON public.doctors FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admin full access
CREATE POLICY "doctors_admin_all"
  ON public.doctors FOR ALL
  USING (public.is_admin());

-- ============================================================
-- PATIENTS POLICIES
-- ============================================================

-- Patients manage their own record
CREATE POLICY "patients_own_all"
  ON public.patients FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Doctors can view patients they've consulted
CREATE POLICY "patients_readable_by_treating_doctor"
  ON public.patients FOR SELECT
  USING (
    public.is_doctor()
    AND EXISTS (
      SELECT 1 FROM public.consultations c
      WHERE c.patient_id = id
        AND c.doctor_id = auth.uid()
        AND c.status IN ('accepted','active','completed')
    )
  );

-- Admin full access
CREATE POLICY "patients_admin_all"
  ON public.patients FOR ALL
  USING (public.is_admin());

-- ============================================================
-- DISPATCHERS POLICIES
-- ============================================================

-- All authenticated users can view dispatcher locations (for emergency tracking)
CREATE POLICY "dispatchers_readable_authenticated"
  ON public.dispatchers FOR SELECT
  TO authenticated
  USING (TRUE);

-- Dispatchers manage their own record
CREATE POLICY "dispatchers_manage_own"
  ON public.dispatchers FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admin full access
CREATE POLICY "dispatchers_admin_all"
  ON public.dispatchers FOR ALL
  USING (public.is_admin());

-- ============================================================
-- PHARMACIES POLICIES
-- ============================================================

-- Active pharmacies are readable to all authenticated users
CREATE POLICY "pharmacies_readable"
  ON public.pharmacies FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

-- Admins manage pharmacies
CREATE POLICY "pharmacies_admin_all"
  ON public.pharmacies FOR ALL
  USING (public.is_admin());

-- ============================================================
-- CONSULTATIONS POLICIES
-- ============================================================

-- Patients see their own consultations
CREATE POLICY "consultations_patient_own"
  ON public.consultations FOR SELECT
  USING (auth.uid() = patient_id);

-- Patients can create consultations as themselves
CREATE POLICY "consultations_patient_insert"
  ON public.consultations FOR INSERT
  WITH CHECK (auth.uid() = patient_id);

-- Patients can update their own (for rating)
CREATE POLICY "consultations_patient_update"
  ON public.consultations FOR UPDATE
  USING (auth.uid() = patient_id)
  WITH CHECK (auth.uid() = patient_id);

-- Doctors see consultations assigned to them
CREATE POLICY "consultations_doctor_assigned"
  ON public.consultations FOR SELECT
  USING (auth.uid() = doctor_id);

-- Doctors can update consultations assigned to them (notes, diagnosis)
CREATE POLICY "consultations_doctor_update"
  ON public.consultations FOR UPDATE
  USING (auth.uid() = doctor_id)
  WITH CHECK (auth.uid() = doctor_id);

-- Doctors can accept pending consultations (set doctor_id to self)
CREATE POLICY "consultations_doctor_accept"
  ON public.consultations FOR UPDATE
  USING (
    public.is_doctor()
    AND status = 'pending'
    AND doctor_id IS NULL
  );

-- Admin full access
CREATE POLICY "consultations_admin_all"
  ON public.consultations FOR ALL
  USING (public.is_admin());

-- ============================================================
-- MESSAGES POLICIES
-- ============================================================

-- Participants in a consultation can read messages
CREATE POLICY "messages_participant_select"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.consultations c
      WHERE c.id = consultation_id
        AND (c.patient_id = auth.uid() OR c.doctor_id = auth.uid())
    )
    OR public.is_admin()
  );

-- Participants can send messages in active consultations
CREATE POLICY "messages_participant_insert"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.consultations c
      WHERE c.id = consultation_id
        AND (c.patient_id = auth.uid() OR c.doctor_id = auth.uid())
        AND c.status IN ('accepted','active')
    )
  );

-- Mark messages as read
CREATE POLICY "messages_mark_read"
  ON public.messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.consultations c
      WHERE c.id = consultation_id
        AND (c.patient_id = auth.uid() OR c.doctor_id = auth.uid())
    )
  )
  WITH CHECK (TRUE);

-- ============================================================
-- PRESCRIPTIONS POLICIES
-- ============================================================

-- Patients see their own prescriptions
CREATE POLICY "prescriptions_patient_own"
  ON public.prescriptions FOR SELECT
  USING (auth.uid() = patient_id);

-- Doctors see prescriptions they issued
CREATE POLICY "prescriptions_doctor_issued"
  ON public.prescriptions FOR SELECT
  USING (auth.uid() = doctor_id);

-- Doctors can create prescriptions
CREATE POLICY "prescriptions_doctor_insert"
  ON public.prescriptions FOR INSERT
  WITH CHECK (auth.uid() = doctor_id AND public.is_doctor());

-- Doctors can update their prescriptions (pharmacy assignment)
CREATE POLICY "prescriptions_doctor_update"
  ON public.prescriptions FOR UPDATE
  USING (auth.uid() = doctor_id);

-- Pharmacy users can update dispensing info
CREATE POLICY "prescriptions_pharmacy_update"
  ON public.prescriptions FOR UPDATE
  USING (public.get_user_role() = 'pharmacy');

-- Admin full access
CREATE POLICY "prescriptions_admin_all"
  ON public.prescriptions FOR ALL
  USING (public.is_admin());

-- ============================================================
-- EMERGENCIES POLICIES
-- ============================================================

-- Patients see their own emergencies
CREATE POLICY "emergencies_patient_own"
  ON public.emergencies FOR SELECT
  USING (auth.uid() = patient_id);

-- Patients can create emergencies
CREATE POLICY "emergencies_patient_insert"
  ON public.emergencies FOR INSERT
  WITH CHECK (auth.uid() = patient_id);

-- All dispatchers can see all pending emergencies
CREATE POLICY "emergencies_dispatcher_view_pending"
  ON public.emergencies FOR SELECT
  USING (
    public.is_dispatcher()
    AND status IN ('pending','dispatched','en_route')
  );

-- Assigned dispatcher can see and update their emergency
CREATE POLICY "emergencies_dispatcher_own"
  ON public.emergencies FOR ALL
  USING (auth.uid() = dispatcher_id);

-- Admin full access
CREATE POLICY "emergencies_admin_all"
  ON public.emergencies FOR ALL
  USING (public.is_admin());

-- ============================================================
-- PAYMENTS POLICIES
-- ============================================================

-- Patients see payments they made
CREATE POLICY "payments_patient_own"
  ON public.payments FOR SELECT
  USING (auth.uid() = patient_id);

-- Patients can initiate payments
CREATE POLICY "payments_patient_insert"
  ON public.payments FOR INSERT
  WITH CHECK (auth.uid() = patient_id);

-- Doctors see their earnings
CREATE POLICY "payments_doctor_own"
  ON public.payments FOR SELECT
  USING (auth.uid() = doctor_id);

-- Admin full access
CREATE POLICY "payments_admin_all"
  ON public.payments FOR ALL
  USING (public.is_admin());

-- ============================================================
-- DOCTOR RATINGS POLICIES
-- ============================================================

-- Ratings are publicly readable (for trust/transparency)
CREATE POLICY "ratings_readable"
  ON public.doctor_ratings FOR SELECT
  TO authenticated
  USING (TRUE);

-- Patients can submit ratings for their own completed consultations
CREATE POLICY "ratings_patient_insert"
  ON public.doctor_ratings FOR INSERT
  WITH CHECK (
    auth.uid() = patient_id
    AND public.get_user_role() = 'patient'
    AND EXISTS (
      SELECT 1 FROM public.consultations c
      WHERE c.id = consultation_id
        AND c.patient_id = auth.uid()
        AND c.status = 'completed'
    )
  );

-- ============================================================
-- APPOINTMENTS POLICIES
-- ============================================================

-- Patients and doctors see their own appointments
CREATE POLICY "appointments_participant_select"
  ON public.appointments FOR SELECT
  USING (auth.uid() = patient_id OR auth.uid() = doctor_id OR public.is_admin());

-- Patients book appointments
CREATE POLICY "appointments_patient_insert"
  ON public.appointments FOR INSERT
  WITH CHECK (auth.uid() = patient_id);

-- Participants can update appointments (cancel, confirm)
CREATE POLICY "appointments_participant_update"
  ON public.appointments FOR UPDATE
  USING (auth.uid() = patient_id OR auth.uid() = doctor_id OR public.is_admin());

-- ============================================================
-- NOTIFICATIONS POLICIES
-- ============================================================

-- Users see only their own notifications
CREATE POLICY "notifications_own"
  ON public.notifications FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- OFFLINE SYNC QUEUE POLICIES
-- ============================================================

-- Users manage their own queue entries
CREATE POLICY "offline_queue_own"
  ON public.offline_sync_queue FOR ALL
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- AUDIT LOGS POLICIES
-- ============================================================

-- Only admins can read audit logs; no one can write (service role only)
CREATE POLICY "audit_logs_admin_select"
  ON public.audit_logs FOR SELECT
  USING (public.is_admin());
