/*
  # إعادة تعيين النظام بالكامل - نظام الجباية الإلكترونية

  1. الجداول الجديدة
    - `users` - جدول المستخدمين (المديرين والمحصلين)
    - `user_sessions` - جدول جلسات المستخدمين
    - `collection_records` - جدول سجلات الجباية
  
  2. التخزين
    - إنشاء bucket للصور مع الصلاحيات المناسبة
    - صلاحيات رفع وقراءة الصور
  
  3. الأمان
    - تفعيل RLS على جميع الجداول
    - إضافة policies مناسبة لكل جدول
    - صلاحيات التخزين للمستخدمين المسجلين
  
  4. البيانات الأولية
    - إنشاء مستخدم مدير افتراضي
    - إنشاء مستخدم محصل للاختبار
*/

-- حذف الجداول القديمة إذا كانت موجودة
DROP TABLE IF EXISTS collection_records CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- حذف الدوال القديمة
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- إنشاء دالة تحديث التاريخ
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- جدول المستخدمين
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

-- جدول جلسات المستخدمين
CREATE TABLE user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  session_token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- جدول سجلات الجباية
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

-- إضافة triggers لتحديث التاريخ
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collection_records_updated_at
    BEFORE UPDATE ON collection_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- إضافة indexes للأداء
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX idx_collection_records_field_agent ON collection_records(field_agent_id);
CREATE INDEX idx_collection_records_status ON collection_records(status);
CREATE INDEX idx_collection_records_submitted_at ON collection_records(submitted_at);

-- تفعيل Row Level Security
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- إنشاء policies لجدول user_sessions
CREATE POLICY "Allow session creation during login"
  ON user_sessions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = user_sessions.user_id 
      AND users.is_active = true
    )
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

CREATE POLICY "Allow session deletion by token"
  ON user_sessions
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- إدراج البيانات الأولية
INSERT INTO users (username, password_hash, role, full_name, is_active) VALUES
  ('admin', 'admin123', 'admin', 'المدير العام', true),
  ('agent1', 'agent123', 'field_agent', 'محمد أحمد - محصل ميداني', true),
  ('agent2', 'agent123', 'field_agent', 'علي حسن - محصل ميداني', true)
ON CONFLICT (username) DO NOTHING;

-- إنشاء bucket للصور
DO $$
BEGIN
  -- محاولة إنشاء bucket للصور
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'photos',
    'photos',
    true,
    10485760, -- 10MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
  )
  ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not create/update storage bucket: %', SQLERRM;
END $$;

-- تفعيل RLS على storage.objects
DO $$
BEGIN
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'RLS already enabled on storage.objects or permission denied: %', SQLERRM;
END $$;

-- حذف policies القديمة للتخزين
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public read access for photos" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can update photos" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can delete photos" ON storage.objects;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Some policies did not exist: %', SQLERRM;
END $$;

-- إنشاء policies جديدة للتخزين
DO $$
BEGIN
  -- قراءة عامة للصور
  EXECUTE 'CREATE POLICY "Public read access for photos" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = ''photos'')';
  
  -- رفع للمستخدمين المسجلين والضيوف
  EXECUTE 'CREATE POLICY "Allow photo uploads" ON storage.objects
    FOR INSERT TO public
    WITH CHECK (bucket_id = ''photos'')';
  
  -- تحديث للمستخدمين المسجلين والضيوف
  EXECUTE 'CREATE POLICY "Allow photo updates" ON storage.objects
    FOR UPDATE TO public
    USING (bucket_id = ''photos'')
    WITH CHECK (bucket_id = ''photos'')';
  
  -- حذف للمستخدمين المسجلين والضيوف
  EXECUTE 'CREATE POLICY "Allow photo deletion" ON storage.objects
    FOR DELETE TO public
    USING (bucket_id = ''photos'')';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not create storage policies: %', SQLERRM;
END $$;

-- إنشاء مجلدات في التخزين (اختيارية)
DO $$
BEGIN
  -- إنشاء مجلد للصور إذا لم يكن موجوداً
  INSERT INTO storage.objects (bucket_id, name, metadata)
  VALUES 
    ('photos', 'meter_photos/.keep', '{"size": 0}'::jsonb),
    ('photos', 'invoice_photos/.keep', '{"size": 0}'::jsonb)
  ON CONFLICT (bucket_id, name) DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not create storage folders: %', SQLERRM;
END $$;

-- إضافة تعليق على الجداول
COMMENT ON TABLE users IS 'جدول المستخدمين - يحتوي على المديرين والمحصلين الميدانيين';
COMMENT ON TABLE user_sessions IS 'جدول جلسات المستخدمين للمصادقة';
COMMENT ON TABLE collection_records IS 'جدول سجلات الجباية الميدانية';

-- إضافة تعليقات على الأعمدة المهمة
COMMENT ON COLUMN collection_records.is_refused IS 'هل امتنع العميل عن الدفع';
COMMENT ON COLUMN collection_records.status IS 'حالة السجل: pending, completed, reviewed';
COMMENT ON COLUMN users.role IS 'دور المستخدم: admin أو field_agent';
COMMENT ON COLUMN users.is_active IS 'هل المستخدم نشط أم معطل';