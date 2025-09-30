/*
  # Enable photo uploads for authenticated users

  1. Security
    - Allow authenticated users to upload photos to the photos bucket
    - Allow public read access to photos (since bucket is public)
*/

-- Enable RLS on storage.objects if not already enabled
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'photos_upload_policy'
  ) THEN
    -- Create policy for uploading photos
    EXECUTE 'CREATE POLICY photos_upload_policy ON storage.objects 
      FOR INSERT 
      TO authenticated 
      WITH CHECK (bucket_id = ''photos'')';
  END IF;
END $$;

-- Create policy for reading photos (public access)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'photos_read_policy'
  ) THEN
    EXECUTE 'CREATE POLICY photos_read_policy ON storage.objects 
      FOR SELECT 
      TO public 
      USING (bucket_id = ''photos'')';
  END IF;
END $$;

-- Create policy for updating photos
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'photos_update_policy'
  ) THEN
    EXECUTE 'CREATE POLICY photos_update_policy ON storage.objects 
      FOR UPDATE 
      TO authenticated 
      USING (bucket_id = ''photos'')';
  END IF;
END $$;

-- Create policy for deleting photos
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'photos_delete_policy'
  ) THEN
    EXECUTE 'CREATE POLICY photos_delete_policy ON storage.objects 
      FOR DELETE 
      TO authenticated 
      USING (bucket_id = ''photos'')';
  END IF;
END $$;