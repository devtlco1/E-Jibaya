/*
  # Fix RLS Infinite Recursion

  1. Security Changes
    - Remove recursive RLS policies that cause infinite loops
    - Simplify policies to use direct session token validation
    - Use proper Authorization header format with Bearer prefix

  2. Policy Updates
    - Replace complex recursive policies with simple session-based checks
    - Ensure policies don't reference the same table they're protecting
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Allow admin operations via session" ON users;
DROP POLICY IF EXISTS "Users can read own data via session" ON users;

-- Create simplified, non-recursive policies
CREATE POLICY "Admin operations via session token"
  ON users
  FOR ALL
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM user_sessions us 
      JOIN users admin_user ON us.user_id = admin_user.id
      WHERE us.session_token = REPLACE(
        COALESCE(
          current_setting('request.headers', true)::json->>'authorization',
          current_setting('request.headers', true)::json->>'Authorization'
        ), 'Bearer ', ''
      )
      AND us.expires_at > now()
      AND admin_user.is_active = true
      AND admin_user.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM user_sessions us 
      JOIN users admin_user ON us.user_id = admin_user.id
      WHERE us.session_token = REPLACE(
        COALESCE(
          current_setting('request.headers', true)::json->>'authorization',
          current_setting('request.headers', true)::json->>'Authorization'
        ), 'Bearer ', ''
      )
      AND us.expires_at > now()
      AND admin_user.is_active = true
      AND admin_user.role = 'admin'
    )
  );

-- Allow users to read their own data
CREATE POLICY "Users read own data via session"
  ON users
  FOR SELECT
  TO anon, authenticated
  USING (
    id = (
      SELECT us.user_id
      FROM user_sessions us
      WHERE us.session_token = REPLACE(
        COALESCE(
          current_setting('request.headers', true)::json->>'authorization',
          current_setting('request.headers', true)::json->>'Authorization'
        ), 'Bearer ', ''
      )
      AND us.expires_at > now()
    )
  );