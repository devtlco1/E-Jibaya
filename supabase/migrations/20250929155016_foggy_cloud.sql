/*
  # Fix Sample Users for Login

  1. New Tables
    - Ensures sample users exist with correct credentials
  2. Security
    - Maintains RLS policies
  3. Changes
    - Adds/updates sample users if they don't exist
    - Ensures passwords match expected values
*/

-- First, let's check if users exist and add them if they don't
DO $$
BEGIN
  -- Insert admin user if not exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin') THEN
    INSERT INTO users (username, password_hash, role, full_name, is_active) 
    VALUES ('admin', 'admin123', 'admin', 'مدير النظام', true);
  ELSE
    -- Update existing admin user to ensure correct password
    UPDATE users 
    SET password_hash = 'admin123', is_active = true 
    WHERE username = 'admin';
  END IF;

  -- Insert agent1 user if not exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'agent1') THEN
    INSERT INTO users (username, password_hash, role, full_name, is_active) 
    VALUES ('agent1', 'agent123', 'field_agent', 'محصل ميداني 1', true);
  ELSE
    -- Update existing agent1 user to ensure correct password
    UPDATE users 
    SET password_hash = 'agent123', is_active = true 
    WHERE username = 'agent1';
  END IF;

  -- Insert agent2 user if not exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'agent2') THEN
    INSERT INTO users (username, password_hash, role, full_name, is_active) 
    VALUES ('agent2', 'agent123', 'field_agent', 'محصل ميداني 2', true);
  ELSE
    -- Update existing agent2 user to ensure correct password
    UPDATE users 
    SET password_hash = 'agent123', is_active = true 
    WHERE username = 'agent2';
  END IF;
END $$;