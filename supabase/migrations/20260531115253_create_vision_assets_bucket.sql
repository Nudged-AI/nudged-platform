/*
  # Create vision-assets storage bucket

  Creates a public storage bucket for vision board images (JPG/PNG uploads).
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vision-assets',
  'vision-assets',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own images
CREATE POLICY "Authenticated users can upload vision images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'vision-assets' AND auth.uid()::text = (storage.foldername(name))[2]);

CREATE POLICY "Vision images are publicly readable"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'vision-assets');

CREATE POLICY "Users can update own vision images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'vision-assets' AND auth.uid()::text = (storage.foldername(name))[2]);

CREATE POLICY "Users can delete own vision images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'vision-assets' AND auth.uid()::text = (storage.foldername(name))[2]);
