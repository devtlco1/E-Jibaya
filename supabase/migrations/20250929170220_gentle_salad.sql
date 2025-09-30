/*
  # Disable RLS on collection_records table

  This migration disables Row Level Security on the collection_records table
  because the application uses a custom authentication system that doesn't
  integrate with Supabase's built-in auth.uid() system.

  The application handles authorization at the application level through
  session validation and role checking.

  ## Changes
  1. Disable RLS on collection_records table
  2. Remove existing RLS policies that are causing conflicts
*/

-- Disable RLS on collection_records table
ALTER TABLE collection_records DISABLE ROW LEVEL SECURITY;

-- Drop existing policies that are no longer needed
DROP POLICY IF EXISTS "Admins can manage all records" ON collection_records;
DROP POLICY IF EXISTS "Field agents can create records" ON collection_records;
DROP POLICY IF EXISTS "Field agents can read their own records" ON collection_records;
DROP POLICY IF EXISTS "Allow field agents to create their own records" ON collection_records;
DROP POLICY IF EXISTS "Allow field agents to read their own records" ON collection_records;
DROP POLICY IF EXISTS "Allow admins to manage all records" ON collection_records;