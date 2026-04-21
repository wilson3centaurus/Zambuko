-- ============================================================
-- ZAMBUKO TELEHEALTH — FUNCTIONS, TRIGGERS & STORED PROCEDURES
-- Migration: 20260402000003_functions_triggers.sql
-- ============================================================

-- ============================================================
-- UTILITY: AUTO-UPDATE updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_doctors
  BEFORE UPDATE ON public.doctors
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_patients
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_dispatchers
  BEFORE UPDATE ON public.dispatchers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_pharmacies
  BEFORE UPDATE ON public.pharmacies
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_consultations
  BEFORE UPDATE ON public.consultations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_prescriptions
  BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_emergencies
  BEFORE UPDATE ON public.emergencies
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_payments
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_appointments
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- Called by: auth.users AFTER INSERT trigger
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
BEGIN
  -- Default to 'patient' if no role provided in metadata
  v_role := COALESCE(
    (NEW.raw_user_meta_data->>'role')::public.user_role,
    'patient'
  );

  -- Insert base profile
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone),
    v_role
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create role-specific child record
  IF v_role = 'patient' THEN
    INSERT INTO public.patients (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;

  ELSIF v_role = 'doctor' THEN
    INSERT INTO public.doctors (id, medical_license_number, specialty)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'license_number', 'PENDING-' || NEW.id),
      COALESCE(
        (NEW.raw_user_meta_data->>'specialty')::public.medical_specialty,
        'general_practice'
      )
    ) ON CONFLICT DO NOTHING;

  ELSIF v_role = 'dispatcher' THEN
    INSERT INTO public.dispatchers (id, vehicle_id, organization)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'vehicle_id', 'PENDING-' || NEW.id),
      COALESCE(NEW.raw_user_meta_data->>'organization', 'Unassigned')
    ) ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- CONSULTATION LIFECYCLE MANAGEMENT
-- Handles: queue, timestamps, doctor status
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_consultation_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Doctor accepts consultation: increment queue, set in_session
  IF NEW.status = 'accepted'
     AND OLD.status = 'pending'
     AND NEW.doctor_id IS NOT NULL THEN

    UPDATE public.doctors
    SET queue_length = queue_length + 1,
        status = 'in_session'
    WHERE id = NEW.doctor_id;
  END IF;

  -- Consultation goes active: record start time
  IF NEW.status = 'active' AND OLD.status = 'accepted' THEN
    NEW.started_at = NOW();
  END IF;

  -- Consultation ends: record end time, calculate duration, free doctor
  IF NEW.status IN ('completed','cancelled','no_show')
     AND OLD.status NOT IN ('completed','cancelled','no_show')
     AND NEW.doctor_id IS NOT NULL THEN

    NEW.ended_at = NOW();

    IF NEW.started_at IS NOT NULL THEN
      NEW.duration_minutes = GREATEST(
        1,
        ROUND(EXTRACT(EPOCH FROM (NOW() - NEW.started_at)) / 60)::INTEGER
      );
    END IF;

    -- Decrement doctor queue
    UPDATE public.doctors
    SET queue_length = GREATEST(0, queue_length - 1)
    WHERE id = NEW.doctor_id;

    -- Return doctor to available if queue is empty
    UPDATE public.doctors
    SET status = 'available'
    WHERE id = NEW.doctor_id
      AND queue_length = 0
      AND status = 'in_session';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_consultation_status_change
  BEFORE UPDATE OF status ON public.consultations
  FOR EACH ROW EXECUTE FUNCTION public.handle_consultation_status_change();

-- ============================================================
-- DOCTOR RATING AGGREGATION
-- Updates live rating average on each new rating insert
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_doctor_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.doctors
  SET
    rating       = ((rating * rating_count) + NEW.rating) / (rating_count + 1),
    rating_count = rating_count + 1
  WHERE id = NEW.doctor_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_doctor_rating_insert
  AFTER INSERT ON public.doctor_ratings
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_doctor_rating();

-- ============================================================
-- HEARTBEAT CLEANUP
-- Called periodically via Supabase Edge Function cron
-- ============================================================

-- Mark doctors offline if no heartbeat > 90 seconds
CREATE OR REPLACE FUNCTION public.mark_stale_doctors_offline()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.doctors
  SET status = 'offline'
  WHERE status != 'offline'
    AND heartbeat_at < NOW() - INTERVAL '90 seconds';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Mark dispatchers offline if no heartbeat > 120 seconds
CREATE OR REPLACE FUNCTION public.mark_stale_dispatchers_offline()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.dispatchers
  SET status = 'offline'
  WHERE status != 'offline'
    AND heartbeat_at < NOW() - INTERVAL '120 seconds';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================
-- DOCTOR MATCHING ALGORITHM
-- Returns ranked doctors using proximity + rating + queue
-- ============================================================

CREATE OR REPLACE FUNCTION public.match_doctors(
  p_lat        DECIMAL,
  p_lng        DECIMAL,
  p_specialty  public.medical_specialty DEFAULT 'general_practice',
  p_emergency  BOOLEAN DEFAULT FALSE,
  p_limit      INTEGER DEFAULT 20
)
RETURNS TABLE (
  doctor_id          UUID,
  full_name          TEXT,
  specialty          public.medical_specialty,
  status             public.doctor_status,
  rating             DECIMAL,
  rating_count       INTEGER,
  queue_length       INTEGER,
  distance_km        DECIMAL,
  match_score        DECIMAL,
  consultation_fee   DECIMAL,
  avatar_url         TEXT,
  bio                TEXT,
  location_name      TEXT,
  emergency_capable  BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Weights must sum to 1.0
  w_rating    DECIMAL := 0.45;
  w_proximity DECIMAL := 0.35;
  w_queue     DECIMAL := 0.20;
BEGIN
  RETURN QUERY
  WITH distances AS (
    SELECT
      d.id,
      -- Haversine formula for distance in km
      6371.0 * acos(
        LEAST(1.0,
          cos(radians(p_lat)) * cos(radians(d.location_lat))
          * cos(radians(d.location_lng) - radians(p_lng))
          + sin(radians(p_lat)) * sin(radians(d.location_lat))
        )
      ) AS dist_km
    FROM public.doctors d
    WHERE d.location_lat IS NOT NULL
      AND d.location_lng IS NOT NULL
  )
  SELECT
    d.id                                                          AS doctor_id,
    p.full_name,
    d.specialty,
    d.status,
    d.rating,
    d.rating_count,
    d.queue_length,
    ROUND(dist.dist_km::DECIMAL, 2)                              AS distance_km,
    ROUND((
      w_rating    * (d.rating / 5.0)
      + w_proximity * GREATEST(0.0, 1.0 - dist.dist_km / 200.0)
      + w_queue     * GREATEST(0.0, 1.0 - d.queue_length::DECIMAL / 10.0)
    )::DECIMAL, 4)                                               AS match_score,
    d.consultation_fee_usd                                       AS consultation_fee,
    p.avatar_url,
    d.bio,
    d.location_name,
    d.emergency_capable
  FROM public.doctors d
  JOIN public.profiles p ON p.id = d.id
  JOIN distances dist ON dist.id = d.id
  WHERE
    d.specialty = p_specialty
    AND p.is_active = TRUE
    AND (
      d.status = 'available'
      OR (p_emergency = TRUE AND d.emergency_capable = TRUE AND d.status = 'in_session')
    )
  ORDER BY match_score DESC
  LIMIT p_limit;
END;
$$;

-- ============================================================
-- EMERGENCY DISPATCH ALGORITHM
-- Finds nearest available dispatcher, assigns to emergency
-- ============================================================

CREATE OR REPLACE FUNCTION public.dispatch_nearest_responder(
  p_emergency_id UUID,
  p_patient_lat  DECIMAL,
  p_patient_lng  DECIMAL
)
RETURNS TABLE (
  dispatcher_id UUID,
  eta_minutes   INTEGER,
  success       BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dispatcher_id UUID;
  v_dist_km       DECIMAL;
  v_eta           INTEGER;
  v_avg_speed_kmh DECIMAL := 60.0;  -- average urban speed
BEGIN
  -- Find nearest available, live dispatcher
  SELECT
    disp.id,
    6371.0 * acos(
      LEAST(1.0,
        cos(radians(p_patient_lat)) * cos(radians(disp.location_lat))
        * cos(radians(disp.location_lng) - radians(p_patient_lng))
        + sin(radians(p_patient_lat)) * sin(radians(disp.location_lat))
      )
    )
  INTO v_dispatcher_id, v_dist_km
  FROM public.dispatchers disp
  WHERE disp.status = 'available'
    AND disp.heartbeat_at > NOW() - INTERVAL '2 minutes'
    AND disp.location_lat IS NOT NULL
  ORDER BY 2 ASC
  LIMIT 1;

  IF v_dispatcher_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::INTEGER, FALSE;
    RETURN;
  END IF;

  v_eta := GREATEST(1, ROUND((v_dist_km / v_avg_speed_kmh) * 60)::INTEGER);

  -- Assign dispatcher
  UPDATE public.emergencies
  SET
    dispatcher_id             = v_dispatcher_id,
    status                    = 'dispatched',
    estimated_arrival_minutes = v_eta,
    dispatched_at             = NOW()
  WHERE id = p_emergency_id
    AND status = 'pending';   -- prevent double-dispatch

  -- Mark dispatcher en route
  UPDATE public.dispatchers
  SET status = 'en_route'
  WHERE id = v_dispatcher_id;

  RETURN QUERY SELECT v_dispatcher_id, v_eta, TRUE;
END;
$$;

-- ============================================================
-- PAYMENT PROCESSING HELPERS
-- ============================================================

-- Calculate and store platform fee/doctor payout when payment succeeds
CREATE OR REPLACE FUNCTION public.handle_payment_success()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_platform_pct  DECIMAL := 0.10;  -- 10% platform fee
BEGIN
  IF NEW.status = 'success' AND OLD.status != 'success' THEN
    -- Calculate fee split
    NEW.platform_fee_usd  := ROUND(NEW.amount_usd * v_platform_pct, 2);
    NEW.doctor_payout_usd := ROUND(NEW.amount_usd * (1 - v_platform_pct), 2);
    NEW.paid_at           := NOW();

    -- Move consultation to accepted
    UPDATE public.consultations
    SET status = 'accepted'
    WHERE id = NEW.consultation_id
      AND status = 'pending';

    -- Notify doctor
    INSERT INTO public.notifications (user_id, type, title, body, data, action_url)
    SELECT
      c.doctor_id,
      'consultation_request',
      'New Consultation Request',
      'A patient is waiting for your consultation.',
      jsonb_build_object('consultation_id', c.id, 'payment_id', NEW.id),
      '/consultation/' || c.id
    FROM public.consultations c
    WHERE c.id = NEW.consultation_id
      AND c.doctor_id IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_payment_success
  BEFORE UPDATE OF status ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_payment_success();

-- ============================================================
-- REALTIME PUBLICATION SETUP
-- Exposes tables to Supabase Realtime channels
-- ============================================================

-- Drop default publication first to reconfigure
DROP PUBLICATION IF EXISTS supabase_realtime;

CREATE PUBLICATION supabase_realtime FOR TABLE
  public.consultations,
  public.messages,
  public.emergencies,
  public.doctors,
  public.dispatchers,
  public.notifications,
  public.payments;

-- ============================================================
-- SEED ADMIN USER HELPER
-- Usage: SELECT create_admin_user('admin@zambuko.co.zw')
-- ============================================================

CREATE OR REPLACE FUNCTION public.promote_to_admin(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET role = 'admin'
  WHERE id = p_user_id;
END;
$$;
