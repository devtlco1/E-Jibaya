/*
  # Disable RLS for custom authentication system

  This migration disables Row Level Security on the users table because:
  1. The application uses a custom session-based authentication system
  2. Supabase RLS policies expect auth.uid() and auth.role() which don't work with custom auth
  3. Application-level authorization is handled in the frontend/backend code
  4. Basic security is maintained through application logic and session validation

  ## Changes
  - Disable RLS on users table
  - Remove all existing policies that cause conflicts
*/

-- Disable RLS on users table
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies to prevent conflicts
DROP POLICY IF EXISTS "Allow anon select for auth" ON users;
DROP POLICY IF EXISTS "Allow authenticated delete" ON users;
DROP POLICY IF EXISTS "Allow authenticated insert" ON users;
DROP POLICY IF EXISTS "Allow authenticated select" ON users;
DROP POLICY IF EXISTS "Allow authenticated update" ON users;
DROP POLICY IF EXISTS "Allow authenticated users full access" ON users;
DROP POLICY IF EXISTS "Allow anon read for auth" ON users;