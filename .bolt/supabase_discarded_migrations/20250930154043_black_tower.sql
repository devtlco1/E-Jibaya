/*
  # إنشاء جدول سجل الحركات

  1. جدول جديد
    - `activity_logs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `action` (text) - نوع العملية
      - `target_type` (text) - نوع الهدف (user, record, system)
      - `target_id` (uuid) - معرف الهدف
      - `target_name` (text) - اسم الهدف
      - `details` (jsonb) - تفاصيل إضافية
      - `ip_address` (text) - عنوان IP
      - `user_agent` (text) - معلومات المتصفح
      - `created_at` (timestamp)

  2. الأمان
    - تفعيل RLS
    - سياسات للقراءة للمديرين فقط
    - سياسة للإنشاء للمستخدمين المصادق عليهم

  3. فهارس للأداء
    - فهرس على user_id
    - فهرس على action
    - فهرس على target_type
    - فهرس على created_at
*/

-- إنشاء جدول سجل الحركات
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  target_name text,
  details jsonb DEFAULT '{}',
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- سياسة للقراءة - المديرين فقط
CREATE POLICY "Admins can read all activity logs"
  ON activity_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin' 
      AND users.is_active = true
    )
  );

-- سياسة للإنشاء - المستخدمين المصادق عليهم
CREATE POLICY "Authenticated users can create activity logs"
  ON activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.is_active = true
    )
  );

-- إنشاء فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_target_type ON activity_logs(target_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_target_id ON activity_logs(target_id);

-- تعليق على الجدول
COMMENT ON TABLE activity_logs IS 'جدول سجل الحركات - يحتوي على جميع العمليات التي تتم في النظام';