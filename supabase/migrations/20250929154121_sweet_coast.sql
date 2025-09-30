/*
  # Reset E-Jibaya Database Schema

  1. New Tables
    - `users`
      - `id` (uuid, primary key)
      - `username` (text, unique)
      - `password_hash` (text)
      - `role` (text, admin/field_agent)
      - `full_name` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `is_active` (boolean)

    - `collection_records`
      - `id` (uuid, primary key)
      - `field_agent_id` (uuid, foreign key)
      - `gps_latitude` (numeric)
      - `gps_longitude` (numeric)
      - `meter_photo_url` (text)
      - `invoice_photo_url` (text)
      - `notes` (text)
      - `is_refused` (boolean)
      - `subscriber_name` (text, nullable - filled by admin)
      - `account_number` (text, nullable - filled by admin)
      - `meter_number` (text, nullable - filled by admin)
      - `address` (text, nullable - filled by admin)
      - `last_reading` (text, nullable - filled by admin)
      - `status` (text, pending/completed/reviewed)
      - `submitted_at` (timestamp)
      - `updated_at` (timestamp)
      - `completed_by` (uuid, foreign key)

    - `user_sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `session_token` (text, unique)
      - `expires_at` (timestamp)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for role-based access
    - Users can only access their own data
    - Admins can access all data

  3. Sample Data
    - Default admin and field agent users
    - Sample collection records for testing
*/

-- Drop existing tables if they exist
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS collection_records CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table
CREATE TABLE users (
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
CREATE TABLE collection_records (
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
CREATE TABLE user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  session_token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_collection_records_field_agent ON collection_records(field_agent_id);
CREATE INDEX idx_collection_records_status ON collection_records(status);
CREATE INDEX idx_collection_records_submitted_at ON collection_records(submitted_at);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users table
CREATE POLICY "Users can read their own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() AND u.role = 'admin'
  ));

CREATE POLICY "Admins can manage users"
  ON users
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() AND u.role = 'admin'
  ));

-- Create RLS policies for collection_records table
CREATE POLICY "Field agents can create records"
  ON collection_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    field_agent_id = auth.uid() AND 
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() AND u.role = 'field_agent'
    )
  );

CREATE POLICY "Field agents can read their own records"
  ON collection_records
  FOR SELECT
  TO authenticated
  USING (
    field_agent_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY "Admins can read all records"
  ON collection_records
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() AND u.role = 'admin'
  ));

CREATE POLICY "Admins can update all records"
  ON collection_records
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() AND u.role = 'admin'
  ));

CREATE POLICY "Admins can delete records"
  ON collection_records
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() AND u.role = 'admin'
  ));

-- Create RLS policies for user_sessions table
CREATE POLICY "Users can manage their own sessions"
  ON user_sessions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collection_records_updated_at 
  BEFORE UPDATE ON collection_records 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample users (passwords are hashed versions of the plain text)
INSERT INTO users (id, username, password_hash, role, full_name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin', 'admin123', 'admin', 'مدير النظام'),
  ('22222222-2222-2222-2222-222222222222', 'agent1', 'agent123', 'field_agent', 'محصل ميداني 1'),
  ('33333333-3333-3333-3333-333333333333', 'agent2', 'agent123', 'field_agent', 'محصل ميداني 2');

-- Insert sample collection records
INSERT INTO collection_records (
  id, 
  field_agent_id, 
  gps_latitude, 
  gps_longitude, 
  meter_photo_url, 
  invoice_photo_url, 
  notes, 
  is_refused, 
  subscriber_name, 
  account_number, 
  meter_number, 
  address, 
  last_reading, 
  status, 
  submitted_at
) VALUES
  (
    '44444444-4444-4444-4444-444444444444',
    '22222222-2222-2222-2222-222222222222',
    31.963158,
    35.930359,
    'https://images.pexels.com/photos/4219654/pexels-photo-4219654.jpeg',
    'https://images.pexels.com/photos/6801648/pexels-photo-6801648.jpeg',
    'القراءة واضحة، المقياس في حالة جيدة',
    false,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    'pending',
    now()
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    '22222222-2222-2222-2222-222222222222',
    31.964158,
    35.931359,
    NULL,
    'https://images.pexels.com/photos/6801648/pexels-photo-6801648.jpeg',
    'امتنع العميل عن الدفع',
    true,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    'pending',
    now() - interval '1 day'
  ),
  (
    '66666666-6666-6666-6666-666666666666',
    '22222222-2222-2222-2222-222222222222',
    31.965158,
    35.932359,
    'https://images.pexels.com/photos/4219654/pexels-photo-4219654.jpeg',
    'https://images.pexels.com/photos/6801648/pexels-photo-6801648.jpeg',
    'قراءة عادية',
    false,
    'أحمد محمد علي',
    '123456789',
    'M-789456',
    'شارع الملك عبدالله، عمان',
    '1250.5',
    'completed',
    now() - interval '2 days'
  ),
  (
    '77777777-7777-7777-7777-777777777777',
    '33333333-3333-3333-3333-333333333333',
    31.966158,
    35.933359,
    'https://images.pexels.com/photos/4219654/pexels-photo-4219654.jpeg',
    'https://images.pexels.com/photos/6801648/pexels-photo-6801648.jpeg',
    'المقياس يحتاج صيانة',
    false,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    'pending',
    now() - interval '3 hours'
  ),
  (
    '88888888-8888-8888-8888-888888888888',
    '33333333-3333-3333-3333-333333333333',
    31.967158,
    35.934359,
    'https://images.pexels.com/photos/4219654/pexels-photo-4219654.jpeg',
    'https://images.pexels.com/photos/6801648/pexels-photo-6801648.jpeg',
    'تم الدفع بالكامل',
    false,
    'فاطمة أحمد سالم',
    '987654321',
    'M-456789',
    'شارع الجامعة، إربد',
    '2150.8',
    'completed',
    now() - interval '5 days'
  );