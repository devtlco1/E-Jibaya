/*
  # Create Sample Users for E-Jibaya System

  1. Sample Users
    - Admin user: admin / admin123
    - Field agent 1: agent1 / agent123  
    - Field agent 2: agent2 / agent123

  2. Security
    - All users are active by default
    - Proper role assignments
*/

-- First, clear any existing sample users to avoid conflicts
DELETE FROM users WHERE username IN ('admin', 'agent1', 'agent2');

-- Insert sample users with proper data
INSERT INTO users (username, password_hash, role, full_name, is_active) VALUES
('admin', 'admin123', 'admin', 'مدير النظام', true),
('agent1', 'agent123', 'field_agent', 'محصل ميداني 1', true),
('agent2', 'agent123', 'field_agent', 'محصل ميداني 2', true);