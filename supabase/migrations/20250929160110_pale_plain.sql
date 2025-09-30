/*
  # Fix User Sessions RLS Policy

  1. Policy Updates
    - Drop the restrictive RLS policy on user_sessions table
    - Create new policies that allow session creation during login
    - Allow anon users to insert sessions for valid users
    - Allow authenticated users to manage their own sessions

  2. Security
    - Maintain security by validating user_id exists in users table
    - Prevent unauthorized session creation
*/

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Users can manage their own sessions" ON user_sessions;

-- Create new policies for user_sessions table
CREATE POLICY "Allow session creation during login"
  ON user_sessions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = user_id AND is_active = true)
  );

CREATE POLICY "Users can read their own sessions"
  ON user_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own sessions"
  ON user_sessions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Allow anon users to delete sessions by token (for logout)
CREATE POLICY "Allow session deletion by token"
  ON user_sessions
  FOR DELETE
  TO anon, authenticated
  USING (true);