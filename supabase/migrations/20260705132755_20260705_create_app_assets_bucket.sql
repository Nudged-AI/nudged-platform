/*
# Create app-assets Storage Bucket

Creates a public storage bucket called `app-assets` for hosting
app-level media files (e.g. intro video, branding assets).

- Bucket is public: files can be read by anyone with the URL.
- No per-user scoping — these are global app assets managed by admins.
- Storage policies allow public read; restrict write to authenticated users only.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'app-assets',
  'app-assets',
  true,
  104857600, -- 100 MB limit
  ARRAY['video/mp4','video/webm','video/ogg','image/png','image/jpeg','image/gif','image/webp','image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Public read
DROP POLICY IF EXISTS "app_assets_public_read" ON storage.objects;
CREATE POLICY "app_assets_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'app-assets');

-- Authenticated upload
DROP POLICY IF EXISTS "app_assets_auth_insert" ON storage.objects;
CREATE POLICY "app_assets_auth_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'app-assets');

-- Authenticated update
DROP POLICY IF EXISTS "app_assets_auth_update" ON storage.objects;
CREATE POLICY "app_assets_auth_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'app-assets');

-- Authenticated delete
DROP POLICY IF EXISTS "app_assets_auth_delete" ON storage.objects;
CREATE POLICY "app_assets_auth_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'app-assets');
