/*
  # Initialize E-Jibaya Database

  1. New Tables
    - `users` - System users (admins and field agents)
    - `collection_records` - Collection data from field agents
    - `user_sessions` - User session management

  2. Security
    - Enable RLS on all tables
    - Add policies for proper access control

  3. Sample Data
    - Create admin and field agent users for testing
*/

-- Create users table
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

-- Create collection_records table
CREATE TABLE IF NOT EXISTS collection_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_agent_id uuid REFERENCES users(id) ON DELETE SET NULL,
  gps_latitude numeric(10,8),
  gps_longitude numeric(11,8),
  meter_photo_url text,
  invoice_photo_url text,
  notes text,
  is_refused boolean DEFAULT false,
  subscriber_name text,
  account_number text,
  meter_number text,
  address text,
  last_reading text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'reviewed')),
  submitted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- Create user_sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  session_token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add update triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_collection_records_updated_at ON collection_records;
CREATE TRIGGER update_collection_records_updated_at
  BEFORE UPDATE ON collection_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Users policies
DROP POLICY IF EXISTS "Users can read their own data" ON users;
CREATE POLICY "Users can read their own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Admins can read all users" ON users;
CREATE POLICY "Admins can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() AND u.role = 'admin'
  ));

DROP POLICY IF EXISTS "Admins can manage users" ON users;
CREATE POLICY "Admins can manage users"
  ON users
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() AND u.role = 'admin'
  ));

-- Collection records policies
DROP POLICY IF EXISTS "Field agents can read their own records" ON collection_records;
CREATE POLICY "Field agents can read their own records"
  ON collection_records
  FOR SELECT
  TO authenticated
  USING (field_agent_id = auth.uid() OR EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() AND u.role = 'admin'
  ));

DROP POLICY IF EXISTS "Admins can read all records" ON collection_records;
CREATE POLICY "Admins can read all records"
  ON collection_records
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() AND u.role = 'admin'
  ));

DROP POLICY IF EXISTS "Field agents can create records" ON collection_records;
CREATE POLICY "Field agents can create records"
  ON collection_records
  FOR INSERT
  TO authenticated
  WITH CHECK (field_agent_id = auth.uid() AND EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() AND u.role = 'field_agent'
  ));

DROP POLICY IF EXISTS "Admins can update all records" ON collection_records;
CREATE POLICY "Admins can update all records"
  ON collection_records
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() AND u.role = 'admin'
  ));

DROP POLICY IF EXISTS "Admins can delete records" ON collection_records;
CREATE POLICY "Admins can delete records"
  ON collection_records
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() AND u.role = 'admin'
  ));

-- User sessions policies
DROP POLICY IF EXISTS "Users can manage their own sessions" ON user_sessions;
CREATE POLICY "Users can manage their own sessions"
  ON user_sessions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_collection_records_field_agent ON collection_records(field_agent_id);
CREATE INDEX IF NOT EXISTS idx_collection_records_status ON collection_records(status);
CREATE INDEX IF NOT EXISTS idx_collection_records_submitted_at ON collection_records(submitted_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- Insert sample users (clear existing first)
DELETE FROM users WHERE username IN ('admin', 'agent1', 'agent2');

INSERT INTO users (username, password_hash, role, full_name, is_active) VALUES
  ('admin', 'admin123', 'admin', 'مدير النظام', true),
  ('agent1', 'agent123', 'field_agent', 'محصل ميداني 1', true),
  ('agent2', 'agent123', 'field_agent', 'محصل ميداني 2', true);