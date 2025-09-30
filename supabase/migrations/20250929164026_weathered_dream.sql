/*
  # Fix RLS Policies for Custom Authentication System

  1. Problem
    - Current RLS policies use auth.uid() which doesn't work with custom authentication
    - JWT token doesn't contain user role information
    - Need to check user role from database instead of JWT

  2. Solution
    - Update RLS policies to use session-based authentication
    - Check user role by joining with users table via session token
    - Allow operations based on database user role, not JWT claims

  3. Security
    - Maintains security by validating session tokens
    - Ensures only active admin users can perform admin operations
    - Session tokens are validated against database
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can create users" ON users;
DROP POLICY IF EXISTS "Admins can delete users" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can update users" ON users;
DROP POLICY IF EXISTS "Users can read their own data" ON users;

-- Create new policies that work with session-based authentication
CREATE POLICY "Allow admin operations via session" ON users
  FOR ALL
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_sessions us
      JOIN users u ON us.user_id = u.id
      WHERE us.session_token = current_setting('request.headers')::json->>'authorization'
        AND us.expires_at > now()
        AND u.is_active = true
        AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_sessions us
      JOIN users u ON us.user_id = u.id
      WHERE us.session_token = current_setting('request.headers')::json->>'authorization'
        AND us.expires_at > now()
        AND u.is_active = true
        AND u.role = 'admin'
    )
  );

-- Allow users to read their own data via session
CREATE POLICY "Users can read own data via session" ON users
  FOR SELECT
  TO anon, authenticated
  USING (
    id = (
      SELECT us.user_id FROM user_sessions us
      WHERE us.session_token = current_setting('request.headers')::json->>'authorization'
        AND us.expires_at > now()
    )
  );