-- =============================================================
-- supabase/seed.sql
-- Sample data for local development and testing
-- Run: supabase db seed  OR  supabase db reset (which runs migrations + seed)
-- =============================================================

-- NOTE: These UUIDs are fixed so you can reference them across tables.
-- Corresponding auth.users must be created via supabase auth admin or during test setup.
-- For local testing, run `supabase auth create-user` or use the dashboard.

-- ─────────────────────────────────────────────
-- 1. PHARMACIES
-- ─────────────────────────────────────────────
INSERT INTO public.pharmacies (id, name, address, city, location_lat, location_lng, phone, email,
  operating_hours_from, operating_hours_to, delivery_available, delivery_radius_km)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'City Health Pharmacy',   '73 Samora Machel Ave, Harare',  'Harare', -17.8252, 31.0522, '+263242731234', 'cityhealthrx@gmail.com',  '08:00', '20:00', TRUE, 15),
  ('a1000000-0000-0000-0000-000000000002', 'OK Pharmacy Bulawayo',   '89 Jason Moyo St, Bulawayo',   'Bulawayo', -20.1500, 28.5800, '+263292888123', 'okrxbyo@gmail.com',       '07:30', '19:00', TRUE, 20),
  ('a1000000-0000-0000-0000-000000000003', 'Westgate Pharmacy',      'Shop 12, Westgate Mall, Harare','Harare', -17.7910, 30.9880, '+263242444567', 'westgaterx@zambuko.co.zw','08:00', '21:00', FALSE, 0),
  ('a1000000-0000-0000-0000-000000000004', 'Avenues Pharmacy',       '16 Baines Ave, Harare',        'Harare', -17.8190, 31.0490, '+263242707888', NULL,                      '08:30', '18:00', TRUE, 10);

-- ─────────────────────────────────────────────
-- 2. AUTH.USERS (insert before profiles — FK constraint requires this)
-- ─────────────────────────────────────────────
-- Admin — email + password login (admin@zambuko.co.zw / Admin1234!)
INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'admin@zambuko.co.zw',
  crypt('Admin1234!', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}', '{"role":"admin"}',
  FALSE, NOW(), NOW(), '', '', '', ''
) ON CONFLICT (id) DO NOTHING;

-- Doctors — email + password login (password: Doctor1234!)
INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES
  ('b0000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated',
   'doctor.takudzwa@zambuko.co.zw', crypt('Doctor1234!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}', '{"role":"doctor"}',
   FALSE, NOW(), NOW(), '', '', '', ''),
  ('b0000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated',
   'doctor.rudo@zambuko.co.zw', crypt('Doctor1234!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}', '{"role":"doctor"}',
   FALSE, NOW(), NOW(), '', '', '', ''),
  ('b0000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated',
   'doctor.farai@zambuko.co.zw', crypt('Doctor1234!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}', '{"role":"doctor"}',
   FALSE, NOW(), NOW(), '', '', '', ''),
  ('b0000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated',
   'doctor.priscilla@zambuko.co.zw', crypt('Doctor1234!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}', '{"role":"doctor"}',
   FALSE, NOW(), NOW(), '', '', '', ''),
  ('b0000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated',
   'doctor.blessing@zambuko.co.zw', crypt('Doctor1234!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}', '{"role":"doctor"}',
   FALSE, NOW(), NOW(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- Patients — email + password login (password: Patient1234!)
INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES
  ('b0000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated',
   'patient.chiedza@zambuko.co.zw', crypt('Patient1234!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}', '{"role":"patient"}',
   FALSE, NOW(), NOW(), '', '', '', ''),
  ('b0000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated',
   'patient.tendai@zambuko.co.zw', crypt('Patient1234!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}', '{"role":"patient"}',
   FALSE, NOW(), NOW(), '', '', '', ''),
  ('b0000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated',
   'patient.nyasha@zambuko.co.zw', crypt('Patient1234!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}', '{"role":"patient"}',
   FALSE, NOW(), NOW(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- Dispatchers — email + password login (password: Dispatch1234!)
INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES
  ('b0000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated',
   'dispatch.simba@zambuko.co.zw', crypt('Dispatch1234!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}', '{"role":"dispatcher"}',
   FALSE, NOW(), NOW(), '', '', '', ''),
  ('b0000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated',
   'dispatch.tatenda@zambuko.co.zw', crypt('Dispatch1234!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}', '{"role":"dispatcher"}',
   FALSE, NOW(), NOW(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- Auth identities (required for login to work)
INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at)
VALUES
  -- Admin
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001',
   '{"sub":"b0000000-0000-0000-0000-000000000001","email":"admin@zambuko.co.zw"}',
   'email', 'admin@zambuko.co.zw', NOW(), NOW(), NOW()),
  -- Doctors
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000011',
   '{"sub":"b0000000-0000-0000-0000-000000000011","email":"doctor.takudzwa@zambuko.co.zw"}',
   'email', 'doctor.takudzwa@zambuko.co.zw', NOW(), NOW(), NOW()),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000012',
   '{"sub":"b0000000-0000-0000-0000-000000000012","email":"doctor.rudo@zambuko.co.zw"}',
   'email', 'doctor.rudo@zambuko.co.zw', NOW(), NOW(), NOW()),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000013',
   '{"sub":"b0000000-0000-0000-0000-000000000013","email":"doctor.farai@zambuko.co.zw"}',
   'email', 'doctor.farai@zambuko.co.zw', NOW(), NOW(), NOW()),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000014',
   '{"sub":"b0000000-0000-0000-0000-000000000014","email":"doctor.priscilla@zambuko.co.zw"}',
   'email', 'doctor.priscilla@zambuko.co.zw', NOW(), NOW(), NOW()),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000015',
   '{"sub":"b0000000-0000-0000-0000-000000000015","email":"doctor.blessing@zambuko.co.zw"}',
   'email', 'doctor.blessing@zambuko.co.zw', NOW(), NOW(), NOW()),
  -- Patients
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000021',
   '{"sub":"b0000000-0000-0000-0000-000000000021","email":"patient.chiedza@zambuko.co.zw"}',
   'email', 'patient.chiedza@zambuko.co.zw', NOW(), NOW(), NOW()),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000022',
   '{"sub":"b0000000-0000-0000-0000-000000000022","email":"patient.tendai@zambuko.co.zw"}',
   'email', 'patient.tendai@zambuko.co.zw', NOW(), NOW(), NOW()),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000023',
   '{"sub":"b0000000-0000-0000-0000-000000000023","email":"patient.nyasha@zambuko.co.zw"}',
   'email', 'patient.nyasha@zambuko.co.zw', NOW(), NOW(), NOW()),
  -- Dispatchers
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000031',
   '{"sub":"b0000000-0000-0000-0000-000000000031","email":"dispatch.simba@zambuko.co.zw"}',
   'email', 'dispatch.simba@zambuko.co.zw', NOW(), NOW(), NOW()),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000032',
   '{"sub":"b0000000-0000-0000-0000-000000000032","email":"dispatch.tatenda@zambuko.co.zw"}',
   'email', 'dispatch.tatenda@zambuko.co.zw', NOW(), NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- 3. PROFILES (test users)
-- ─────────────────────────────────────────────

-- Admin
INSERT INTO public.profiles (id, role, full_name, phone, city, province, is_active)
VALUES ('b0000000-0000-0000-0000-000000000001', 'admin', 'System Admin', '+263771000001', 'Harare', 'Harare', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Doctors
INSERT INTO public.profiles (id, role, full_name, phone, city, province, avatar_url, is_active)
VALUES
  ('b0000000-0000-0000-0000-000000000011', 'doctor', 'Dr. Takudzwa Moyo',  '+263771000011', 'Harare',   'Harare',          'https://api.dicebear.com/8.x/initials/svg?seed=TM', TRUE),
  ('b0000000-0000-0000-0000-000000000012', 'doctor', 'Dr. Rudo Ncube',     '+263772000012', 'Bulawayo', 'Matabeleland North','https://api.dicebear.com/8.x/initials/svg?seed=RN', TRUE),
  ('b0000000-0000-0000-0000-000000000013', 'doctor', 'Dr. Farai Chikwanda','+263773000013', 'Harare',   'Harare',          'https://api.dicebear.com/8.x/initials/svg?seed=FC', TRUE),
  ('b0000000-0000-0000-0000-000000000014', 'doctor', 'Dr. Priscilla Dube', '+263774000014', 'Mutare',   'Manicaland',      'https://api.dicebear.com/8.x/initials/svg?seed=PD', TRUE),
  ('b0000000-0000-0000-0000-000000000015', 'doctor', 'Dr. Blessing Sithole','+263775000015','Gweru',   'Midlands',        'https://api.dicebear.com/8.x/initials/svg?seed=BS', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Patients
INSERT INTO public.profiles (id, role, full_name, phone, city, province, is_active)
VALUES
  ('b0000000-0000-0000-0000-000000000021', 'patient', 'Chiedza Mapfumo',  '+263771111021', 'Harare',   'Harare',           TRUE),
  ('b0000000-0000-0000-0000-000000000022', 'patient', 'Tendai Zvobgo',    '+263772222022', 'Bulawayo', 'Matabeleland North',TRUE),
  ('b0000000-0000-0000-0000-000000000023', 'patient', 'Nyasha Mubvumbi',  '+263773333023', 'Harare',   'Harare',           TRUE)
ON CONFLICT (id) DO NOTHING;

-- Dispatchers
INSERT INTO public.profiles (id, role, full_name, phone, city, province, is_active)
VALUES
  ('b0000000-0000-0000-0000-000000000031', 'dispatcher', 'Simba Chirwo',    '+263771000031', 'Harare',   'Harare',           TRUE),
  ('b0000000-0000-0000-0000-000000000032', 'dispatcher', 'Tatenda Mutasa',  '+263772000032', 'Bulawayo', 'Matabeleland North',TRUE)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
-- 3. DOCTORS (role-specific table)
-- ─────────────────────────────────────────────
INSERT INTO public.doctors (id, specialty, medical_license_number, license_verified, years_experience, bio,
  consultation_fee_usd, status, rating, rating_count, location_lat, location_lng, location_name,
  emergency_capable, hospital_affiliation)
VALUES
  ('b0000000-0000-0000-0000-000000000011', 'general_practice',    'ZW-GP-2019-001', TRUE, 6,
   'Experienced GP based in Harare with a focus on chronic disease management and preventive healthcare.',
   5.00, 'available', 4.8, 124, -17.8320, 31.0450, 'Avenues Clinic, Harare', FALSE, 'Avenues Clinic'),

  ('b0000000-0000-0000-0000-000000000012', 'pediatrics',          'ZW-PD-2017-042', TRUE, 9,
   'Paediatrician with special interest in neonatal care and childhood immunisation programs.',
   7.50, 'available', 4.9, 203, -20.1520, 28.5830, 'Mater Dei Hospital, Bulawayo', FALSE, 'Mater Dei Hospital'),

  ('b0000000-0000-0000-0000-000000000013', 'emergency_medicine',  'ZW-EM-2020-015', TRUE, 4,
   'Emergency medicine specialist. Available for urgent cases and triage support.',
   8.00, 'offline', 4.7, 87, -17.8290, 31.0520, 'Parirenyatwa Group of Hospitals', TRUE, 'Parirenyatwa Hospital'),

  ('b0000000-0000-0000-0000-000000000014', 'obstetrics',          'ZW-OB-2016-008', TRUE, 10,
   'Specialist in maternal and foetal medicine. Serving Manicaland province.',
   9.00, 'busy', 4.6, 178, -18.9760, 32.6730, 'Mutare Provincial Hospital', FALSE, 'Mutare Provincial Hospital'),

  ('b0000000-0000-0000-0000-000000000015', 'general_practice',    'ZW-GP-2021-033', FALSE, 2,
   'Junior GP completing verification. Supervised by senior doctors.',
   3.00, 'offline', 5.0, 5, -19.4560, 29.8170, 'Gweru City Council Clinic', FALSE, NULL)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
-- 4. PATIENTS (role-specific table)
-- ─────────────────────────────────────────────
INSERT INTO public.patients (id, blood_type, height_cm, weight_kg, allergies, chronic_conditions,
  emergency_contact_name, emergency_contact_phone, emergency_contact_relation)
VALUES
  ('b0000000-0000-0000-0000-000000000021', 'O+', 162, 58.5, ARRAY['penicillin'], ARRAY['hypertension'],
   'Joseph Mapfumo', '+263771111099', 'Spouse'),
  ('b0000000-0000-0000-0000-000000000022', 'B+', 175, 72.0, ARRAY[]::TEXT[], ARRAY['diabetes_type2'],
   'Mary Zvobgo', '+263772222099', 'Mother'),
  ('b0000000-0000-0000-0000-000000000023', 'A-', 168, 65.0, ARRAY['sulfonamides', 'ibuprofen'], ARRAY[]::TEXT[],
   'Peter Mubvumbi', '+263773333099', 'Father')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
-- 5. DISPATCHERS (role-specific table)
-- ─────────────────────────────────────────────
INSERT INTO public.dispatchers (id, vehicle_id, vehicle_type, license_plate, organization, status,
  location_lat, location_lng)
VALUES
  ('b0000000-0000-0000-0000-000000000031', 'AMB-HRE-001', 'ambulance', 'ABD 1234', 'ZESA Medical Services',   'available', -17.8100, 31.0400),
  ('b0000000-0000-0000-0000-000000000032', 'AMB-BYO-001', 'ambulance', 'XYZ 5678', 'City Rescue Bulawayo',   'offline',   -20.1550, 28.5790)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
-- 6. SAMPLE CONSULTATIONS
-- ─────────────────────────────────────────────
INSERT INTO public.consultations (id, patient_id, doctor_id, triage_level, triage_score,
  type, status, chief_complaint, symptoms, started_at, ended_at, duration_minutes, patient_rating, created_at)
VALUES
  ('c0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000021',
   'b0000000-0000-0000-0000-000000000011',
   'moderate', 55, 'chat', 'completed',
   'Persistent headache and dizziness for 3 days',
   ARRAY['headache', 'dizziness', 'fatigue'],
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '25 minutes', 25,
   5, NOW() - INTERVAL '2 days'),

  ('c0000000-0000-0000-0000-000000000002',
   'b0000000-0000-0000-0000-000000000022',
   'b0000000-0000-0000-0000-000000000012',
   'low', 20, 'video', 'completed',
   'Child has fever and runny nose',
   ARRAY['fever', 'runny_nose', 'cough'],
   NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '18 minutes', 18,
   4, NOW() - INTERVAL '5 days'),

  ('c0000000-0000-0000-0000-000000000003',
   'b0000000-0000-0000-0000-000000000021',
   NULL,
   'moderate', 48, 'chat', 'pending',
   'Chest tightness after exercise',
   ARRAY['chest_pain', 'shortness_of_breath'],
   NULL, NULL, NULL, NULL, NOW() - INTERVAL '30 minutes')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
-- 7. SAMPLE PRESCRIPTIONS
-- ─────────────────────────────────────────────
INSERT INTO public.prescriptions (id, consultation_id, patient_id, doctor_id, pharmacy_id,
  medications, status, valid_until, created_at)
VALUES
  ('d0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000021',
   'b0000000-0000-0000-0000-000000000011',
   'a1000000-0000-0000-0000-000000000001',
   '[
     {"name":"Paracetamol 500mg","dosage":"500mg","frequency":"Three times daily","duration_days":5,"instructions":"Take with food","quantity":15},
     {"name":"Diclofenac 50mg","dosage":"50mg","frequency":"Twice daily","duration_days":3,"instructions":"After meals only","quantity":6}
   ]'::jsonb,
   'issued',
   (NOW() + INTERVAL '28 days')::DATE,
   NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
-- 8. SAMPLE DOCTOR RATINGS
-- ─────────────────────────────────────────────
INSERT INTO public.doctor_ratings (consultation_id, doctor_id, patient_id, rating, review, is_anonymous)
VALUES
  ('c0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000011',
   'b0000000-0000-0000-0000-000000000021',
   5, 'Dr. Moyo was excellent! Very thorough and explained everything clearly.', FALSE),
  ('c0000000-0000-0000-0000-000000000002',
   'b0000000-0000-0000-0000-000000000012',
   'b0000000-0000-0000-0000-000000000022',
   4, 'Good consultation. Quick and professional.', FALSE)
ON CONFLICT (consultation_id) DO NOTHING;

-- ─────────────────────────────────────────────
-- 9. SAMPLE MESSAGES (for completed consultation)
-- ─────────────────────────────────────────────
INSERT INTO public.messages (consultation_id, sender_id, type, content, is_read, created_at)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000021', 'text',
   'Hello Doctor, I have had a headache for 3 days now.', TRUE, NOW() - INTERVAL '2 days' + INTERVAL '1 minute'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000011', 'text',
   'Hello Chiedza. Can you describe where the pain is and if it affects one side or both?', TRUE, NOW() - INTERVAL '2 days' + INTERVAL '3 minutes'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000021', 'text',
   'It is on both sides, like pressure. I also feel dizzy when I stand up quickly.', TRUE, NOW() - INTERVAL '2 days' + INTERVAL '5 minutes'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000011', 'text',
   'That sounds like a tension headache possibly combined with mild dehydration. I will prescribe paracetamol. Please drink at least 2L of water daily.', TRUE, NOW() - INTERVAL '2 days' + INTERVAL '10 minutes');

-- ─────────────────────────────────────────────
-- NOTE FOR DEVELOPERS
-- ─────────────────────────────────────────────
-- To log in as these test users, you need to create corresponding auth.users.
-- Using Supabase CLI:
--   supabase auth admin create-user --email admin@zambuko.co.zw --password Admin123! --role authenticated
-- Or use the Auth section of the Supabase dashboard.
-- After creating auth users, update their IDs to match the UUIDs above, OR
-- update the UUIDs in this seed to match the auth user IDs.
--
-- For testing phone OTP locally, disable phone confirmation in:
--   supabase/config.toml → [auth] → enable_confirmations = false
