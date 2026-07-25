-- Profile media, dispatcher branding, and explicit patient consent records.
-- Identity documents are private; only the owner and platform admins may access them.

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS legal_full_name TEXT,
  ADD COLUMN IF NOT EXISTS national_id_document_path TEXT,
  ADD COLUMN IF NOT EXISTS consent_version TEXT,
  ADD COLUMN IF NOT EXISTS consent_given_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_ip INET;

ALTER TABLE public.dispatchers
  ADD COLUMN IF NOT EXISTS organization_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS service_photo_url TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', TRUE, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
  ('service-media', 'service-media', TRUE, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
  ('identity-documents', 'identity-documents', FALSE, 8388608, ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "avatar_owner_insert" ON storage.objects;
CREATE POLICY "avatar_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatar_owner_update" ON storage.objects;
CREATE POLICY "avatar_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatar_public_read" ON storage.objects;
CREATE POLICY "avatar_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "service_media_owner_write" ON storage.objects;
CREATE POLICY "service_media_owner_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'service-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.is_dispatcher()
  );

DROP POLICY IF EXISTS "service_media_owner_update" ON storage.objects;
CREATE POLICY "service_media_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'service-media' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'service-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "service_media_public_read" ON storage.objects;
CREATE POLICY "service_media_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'service-media');

DROP POLICY IF EXISTS "identity_owner_write" ON storage.objects;
CREATE POLICY "identity_owner_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'identity-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "identity_owner_read" ON storage.objects;
CREATE POLICY "identity_owner_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'identity-documents'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

DROP POLICY IF EXISTS "identity_owner_update" ON storage.objects;
CREATE POLICY "identity_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'identity-documents' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'identity-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

