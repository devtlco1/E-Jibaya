/*
  # E-Jibaya Electronic Collection System Database Schema

  1. New Tables
    - `users` - User authentication and role management
    - `collection_records` - Main data collection records from field agents
    - `user_sessions` - Session management for authentication

  2. Security
    - Enable RLS on all tables
    - Add policies for role-based access control
    - Secure data access based on user roles

  3. Features
    - Support for Admin and Field Agent roles
    - GPS coordinates storage
    - Photo URL storage for meter and invoice images
    - Refused status tracking
    - Comprehensive Arabic field names
*/

-- Create users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'field_agent')),
  full_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

-- Create collection records table
CREATE TABLE IF NOT EXISTS collection_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_agent_id uuid REFERENCES users(id) ON DELETE SET NULL,
  
  -- GPS and Photos (submitted by field agent)
  gps_latitude decimal(10, 8),
  gps_longitude decimal(11, 8),
  meter_photo_url text,
  invoice_photo_url text,
  notes text,
  is_refused boolean DEFAULT false,
  
  -- Administrative data (filled by admin based on photos)
  subscriber_name text,
  account_number text,
  meter_number text,
  address text,
  last_reading text,
  
  -- Status and timestamps
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'reviewed')),
  submitted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- Create user sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  session_token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Admins can read all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY "Users can read their own data"
  ON users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can manage users"
  ON users FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- Collection records policies
CREATE POLICY "Admins can read all records"
  ON collection_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY "Field agents can read their own records"
  ON collection_records FOR SELECT
  TO authenticated
  USING (
    field_agent_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY "Field agents can create records"
  ON collection_records FOR INSERT
  TO authenticated
  WITH CHECK (
    field_agent_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() AND u.role = 'field_agent'
    )
  );

CREATE POLICY "Admins can update all records"
  ON collection_records FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete records"
  ON collection_records FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- Session policies
CREATE POLICY "Users can manage their own sessions"
  ON user_sessions FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Insert default admin user
INSERT INTO users (username, password_hash, role, full_name) 
VALUES (
  'admin',
  '$2b$10$rQJ0K5PzN5zJ5K5PzN5zJ5K5PzN5zJ5K5PzN5zJ5K5PzN5zJ5K5Pz', -- 'admin123'
  'admin',
  'مدير النظام'
) ON CONFLICT (username) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_collection_records_field_agent ON collection_records(field_agent_id);
CREATE INDEX IF NOT EXISTS idx_collection_records_status ON collection_records(status);
CREATE INDEX IF NOT EXISTS idx_collection_records_submitted_at ON collection_records(submitted_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);