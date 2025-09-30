/*
  # Temporarily disable RLS on activity_logs to test data access

  This migration temporarily disables RLS to check if data can be accessed.
  This is for debugging purposes only.
*/

-- Temporarily disable RLS on activity_logs
ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;

-- Add some test data if table is empty
INSERT INTO activity_logs (user_id, action, target_type, target_name, details, created_at)
SELECT 
  u.id,
  'test_action',
  'system',
  'Test Entry',
  '{"test": true}'::jsonb,
  now()
FROM users u 
WHERE u.role = 'admin'
LIMIT 1
ON CONFLICT DO NOTHING;