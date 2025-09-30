/*
  # Update Authentication Function to Handle Session Creation

  1. Security
    - Move session creation to server-side to bypass RLS
    - Function runs with SECURITY DEFINER privileges
    - Validates user credentials before creating session

  2. Changes
    - Generate session token and expiry in RPC function
    - Insert session record within the function
    - Return user data along with session token
*/

-- Drop existing function
DROP FUNCTION IF EXISTS authenticate_user(text, text);

-- Create updated authentication function that handles session creation
CREATE OR REPLACE FUNCTION authenticate_user(
  input_username text,
  input_password text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record users%ROWTYPE;
  session_token text;
  expires_at timestamptz;
  result json;
BEGIN
  -- Find user with matching credentials
  SELECT * INTO user_record
  FROM users
  WHERE username = input_username 
    AND password_hash = input_password 
    AND is_active = true;

  -- Return null if user not found or credentials don't match
  IF user_record.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Generate session token and expiry
  session_token := gen_random_uuid()::text;
  expires_at := now() + interval '24 hours';

  -- Create session record
  INSERT INTO user_sessions (user_id, session_token, expires_at)
  VALUES (user_record.id, session_token, expires_at);

  -- Build result with user data and session token
  result := json_build_object(
    'id', user_record.id,
    'username', user_record.username,
    'role', user_record.role,
    'full_name', user_record.full_name,
    'is_active', user_record.is_active,
    'created_at', user_record.created_at,
    'updated_at', user_record.updated_at,
    'session_token', session_token
  );

  RETURN result;
END;
$$;