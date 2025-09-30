/*
  # Fix collection_records RLS policies for Supabase auth

  1. Security Changes
    - Drop existing policies that reference custom auth system
    - Create new policies that work with Supabase auth JWT tokens
    - Map Supabase auth users to custom users table via email/username
    - Allow field agents to create records and admins to manage all records

  2. Policy Structure
    - INSERT: Field agents can create records assigned to themselves
    - SELECT: Field agents see their own records, admins see all
    - UPDATE: Admins can update all records
    - DELETE: Admins can delete records
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Field agents can create records" ON collection_records;
DROP POLICY IF EXISTS "Field agents can read their own records" ON collection_records;
DROP POLICY IF EXISTS "Admins can read all records" ON collection_records;
DROP POLICY IF EXISTS "Admins can update all records" ON collection_records;
DROP POLICY IF EXISTS "Admins can delete records" ON collection_records;

-- Create new policies that work with Supabase auth
CREATE POLICY "Field agents can create records"
  ON collection_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    field_agent_id IN (
      SELECT u.id 
      FROM users u 
      WHERE u.username = split_part(auth.email(), '@', 1)
      AND u.role = 'field_agent'
      AND u.is_active = true
    )
  );

CREATE POLICY "Field agents can read their own records"
  ON collection_records
  FOR SELECT
  TO authenticated
  USING (
    field_agent_id IN (
      SELECT u.id 
      FROM users u 
      WHERE u.username = split_part(auth.email(), '@', 1)
      AND u.role = 'field_agent'
      AND u.is_active = true
    )
    OR
    EXISTS (
      SELECT 1 
      FROM users u 
      WHERE u.username = split_part(auth.email(), '@', 1)
      AND u.role = 'admin'
      AND u.is_active = true
    )
  );

CREATE POLICY "Admins can manage all records"
  ON collection_records
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM users u 
      WHERE u.username = split_part(auth.email(), '@', 1)
      AND u.role = 'admin'
      AND u.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM users u 
      WHERE u.username = split_part(auth.email(), '@', 1)
      AND u.role = 'admin'
      AND u.is_active = true
    )
  );