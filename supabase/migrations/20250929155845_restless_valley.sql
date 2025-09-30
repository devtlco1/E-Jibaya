/*
  # Add Authentication Function

  1. New Functions
    - `authenticate_user` - Secure function to authenticate users bypassing RLS
  
  2. Security
    - Function runs with SECURITY DEFINER to bypass RLS
    - Only returns user data if credentials match
    - Prevents unauthorized access to user table
*/

-- Create authentication function that bypasses RLS
CREATE OR REPLACE FUNCTION authenticate_user(input_username TEXT, input_password TEXT)
RETURNS TABLE(
  id UUID,
  username TEXT,
  password_hash TEXT,
  role TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.username,
    u.password_hash,
    u.role,
    u.full_name,
    u.created_at,
    u.updated_at,
    u.is_active
  FROM users u
  WHERE u.username = input_username 
    AND u.password_hash = input_password 
    AND u.is_active = true;
END;
$$;

-- Grant execute permission to anon role
GRANT EXECUTE ON FUNCTION authenticate_user(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION authenticate_user(TEXT, TEXT) TO authenticated;