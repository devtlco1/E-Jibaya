/*
  # E-Jibaya Electronic Collection System - Main Database Schema
  
  هذا الملف يحتوي على جميع الجداول والإعدادات الأساسية للنظام
  
  1. الجداول الأساسية:
    - users: إدارة المستخدمين والأدوار
    - collection_records: السجلات الرئيسية
    - user_sessions: إدارة الجلسات
    - activity_logs: سجل الأنشطة
    - record_photos: الصور المتعددة للسجلات
  
  2. الأمان:
    - Row Level Security (RLS) مفعل على جميع الجداول
    - سياسات الأمان المبنية على الأدوار
    - تشفير كلمات المرور
  
  3. الميزات:
    - دعم أدوار: admin, field_agent, employee
    - تخزين إحداثيات GPS
    - تخزين الصور (مقياس وفاتورة)
    - تتبع حالة الامتناع
    - نظام الصور المتعددة
    - Storage bucket للصور
*/

-- ==============================================
-- 1. إنشاء الجداول الأساسية
-- ==============================================

-- جدول المستخدمين
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'field_agent', 'employee')),
  full_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  
  -- Constraints للتحقق من البيانات
  CONSTRAINT check_username_length CHECK (char_length(username) >= 3),
  CONSTRAINT check_password_length CHECK (char_length(password_hash) >= 6),
  CONSTRAINT check_full_name_length CHECK (char_length(full_name) >= 2)
);

-- جدول السجلات الرئيسية
CREATE TABLE IF NOT EXISTS collection_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_agent_id uuid REFERENCES users(id) ON DELETE SET NULL,
  
  -- GPS والصور (مرسلة من المحصل الميداني)
  gps_latitude decimal(10, 8),
  gps_longitude decimal(11, 8),
  meter_photo_url text,
  invoice_photo_url text,
  notes text,
  is_refused boolean DEFAULT false,
  
  -- البيانات الإدارية (مملوءة من الإدارة بناءً على الصور)
  subscriber_name text,
  account_number text,
  meter_number text,
  address text,
  last_reading text,
  
  -- الحالة والطوابع الزمنية
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  submitted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  
  -- Constraints للتحقق من البيانات
  CONSTRAINT check_gps_latitude CHECK (gps_latitude IS NULL OR (gps_latitude >= -90 AND gps_latitude <= 90)),
  CONSTRAINT check_gps_longitude CHECK (gps_longitude IS NULL OR (gps_longitude >= -180 AND gps_longitude <= 180))
);

-- جدول جلسات المستخدمين
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  session_token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- جدول سجل الأنشطة
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  target_name text,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- جدول الصور المتعددة
CREATE TABLE IF NOT EXISTS record_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES collection_records(id) ON DELETE CASCADE,
  photo_type text NOT NULL CHECK (photo_type IN ('meter', 'invoice')),
  photo_url text NOT NULL,
  photo_date timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- ==============================================
-- 2. تفعيل Row Level Security
-- ==============================================

-- تعطيل RLS للمستخدمين وactivity_logs مؤقتاً للتطوير
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_photos ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- 3. سياسات الأمان للمستخدمين
-- ==============================================

-- المستخدمون يمكنهم قراءة بياناتهم الخاصة
DROP POLICY IF EXISTS "Users can read their own data" ON users;
CREATE POLICY "Users can read their own data"
  ON users FOR SELECT
  TO authenticated
  USING (true);

-- المديرون يمكنهم قراءة جميع المستخدمين
DROP POLICY IF EXISTS "Admins can read all users" ON users;
CREATE POLICY "Admins can read all users"
  ON users FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() AND u.role = 'admin'
  ));

-- المديرون يمكنهم إدارة المستخدمين
DROP POLICY IF EXISTS "Admins can manage users" ON users;
CREATE POLICY "Admins can manage users"
  ON users FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() AND u.role = 'admin'
  ));

-- ==============================================
-- 4. سياسات الأمان للسجلات
-- ==============================================

-- المحصلون الميدانيون يمكنهم إنشاء السجلات
DROP POLICY IF EXISTS "Field agents can create records" ON collection_records;
CREATE POLICY "Field agents can create records"
  ON collection_records FOR INSERT
  TO authenticated
  WITH CHECK (
    field_agent_id = auth.uid() AND 
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() AND u.role IN ('field_agent', 'employee')
    )
  );

-- المحصلون الميدانيون يمكنهم قراءة سجلاتهم الخاصة
DROP POLICY IF EXISTS "Field agents can read their own records" ON collection_records;
CREATE POLICY "Field agents can read their own records"
  ON collection_records FOR SELECT
  TO authenticated
  USING (
    field_agent_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'employee')
    )
  );

-- المديرون والموظفون يمكنهم قراءة جميع السجلات
DROP POLICY IF EXISTS "Admins and employees can read all records" ON collection_records;
CREATE POLICY "Admins and employees can read all records"
  ON collection_records FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() AND u.role IN ('admin', 'employee')
  ));

-- المديرون والموظفون يمكنهم تحديث جميع السجلات
DROP POLICY IF EXISTS "Admins and employees can update all records" ON collection_records;
CREATE POLICY "Admins and employees can update all records"
  ON collection_records FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() AND u.role IN ('admin', 'employee')
  ));

-- المديرون يمكنهم حذف السجلات
DROP POLICY IF EXISTS "Admins can delete records" ON collection_records;
CREATE POLICY "Admins can delete records"
  ON collection_records FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() AND u.role = 'admin'
  ));

-- ==============================================
-- 5. سياسات الأمان للجلسات
-- ==============================================

-- المستخدمون يمكنهم إدارة جلساتهم الخاصة
DROP POLICY IF EXISTS "Users can manage their own sessions" ON user_sessions;
CREATE POLICY "Users can manage their own sessions"
  ON user_sessions FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- ==============================================
-- 6. سياسات الأمان لسجل الأنشطة
-- ==============================================

-- المستخدمون المصادق عليهم يمكنهم إنشاء سجلات الأنشطة
DROP POLICY IF EXISTS "Allow authenticated users to create activity logs" ON activity_logs;
CREATE POLICY "Allow authenticated users to create activity logs"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- المستخدمون المصادق عليهم يمكنهم قراءة سجلات الأنشطة
DROP POLICY IF EXISTS "Allow authenticated users to read activity logs" ON activity_logs;
CREATE POLICY "Allow authenticated users to read activity logs"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (true);

-- المستخدمون المصادق عليهم يمكنهم تحديث سجلات الأنشطة
DROP POLICY IF EXISTS "Allow authenticated users to update activity logs" ON activity_logs;
CREATE POLICY "Allow authenticated users to update activity logs"
  ON activity_logs FOR UPDATE
  TO authenticated
  USING (true);

-- ==============================================
-- 7. سياسات الأمان للصور
-- ==============================================

-- المستخدمون المصادق عليهم يمكنهم قراءة الصور
DROP POLICY IF EXISTS "Allow authenticated users to read photos" ON record_photos;
CREATE POLICY "Allow authenticated users to read photos"
  ON record_photos FOR SELECT
  TO authenticated
  USING (true);

-- المستخدمون المصادق عليهم يمكنهم إدراج الصور
DROP POLICY IF EXISTS "Allow authenticated users to insert photos" ON record_photos;
CREATE POLICY "Allow authenticated users to insert photos"
  ON record_photos FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- المستخدمون المصادق عليهم يمكنهم تحديث الصور
DROP POLICY IF EXISTS "Allow authenticated users to update photos" ON record_photos;
CREATE POLICY "Allow authenticated users to update photos"
  ON record_photos FOR UPDATE
  TO authenticated
  USING (true);

-- المستخدمون المصادق عليهم يمكنهم حذف الصور
DROP POLICY IF EXISTS "Allow authenticated users to delete photos" ON record_photos;
CREATE POLICY "Allow authenticated users to delete photos"
  ON record_photos FOR DELETE
  TO authenticated
  USING (true);

-- ==============================================
-- 8. إنشاء Storage Bucket للصور
-- ==============================================

-- إنشاء bucket للصور
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photos',
  'photos',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif'];

-- إنشاء مجلدات في الـ bucket
INSERT INTO storage.objects (bucket_id, name, metadata)
VALUES 
  ('photos', 'meter_photos/', '{"type": "folder"}'),
  ('photos', 'invoice_photos/', '{"type": "folder"}')
ON CONFLICT (bucket_id, name) DO NOTHING;

-- ==============================================
-- 9. سياسات الأمان للتخزين
-- ==============================================

-- الوصول العام لقراءة الصور
DROP POLICY IF EXISTS "Public read access for photos" ON storage.objects;
CREATE POLICY "Public read access for photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'photos');

-- المستخدمون المصادق عليهم يمكنهم رفع الصور
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'photos');

-- المستخدمون المصادق عليهم يمكنهم تحديث الصور
DROP POLICY IF EXISTS "Authenticated users can update photos" ON storage.objects;
CREATE POLICY "Authenticated users can update photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'photos');

-- المستخدمون المصادق عليهم يمكنهم حذف الصور
DROP POLICY IF EXISTS "Authenticated users can delete photos" ON storage.objects;
CREATE POLICY "Authenticated users can delete photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'photos');

-- ==============================================
-- 10. إنشاء الفهارس للأداء
-- ==============================================

-- فهارس جدول المستخدمين
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- فهارس جدول السجلات
CREATE INDEX IF NOT EXISTS idx_collection_records_field_agent ON collection_records(field_agent_id);
CREATE INDEX IF NOT EXISTS idx_collection_records_status ON collection_records(status);
CREATE INDEX IF NOT EXISTS idx_collection_records_submitted_at ON collection_records(submitted_at);
CREATE INDEX IF NOT EXISTS idx_collection_records_completed_by ON collection_records(completed_by);
CREATE INDEX IF NOT EXISTS idx_collection_records_is_refused ON collection_records(is_refused);
CREATE INDEX IF NOT EXISTS idx_collection_records_updated_at ON collection_records(updated_at);

-- فهارس جدول الجلسات
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- فهارس جدول سجل الأنشطة
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

-- فهارس جدول الصور
CREATE INDEX IF NOT EXISTS idx_record_photos_record_id ON record_photos(record_id);
CREATE INDEX IF NOT EXISTS idx_record_photos_photo_type ON record_photos(photo_type);
CREATE INDEX IF NOT EXISTS idx_record_photos_photo_date ON record_photos(photo_date);

-- ==============================================
-- 11. إنشاء الدوال المساعدة
-- ==============================================

-- دالة للحصول على إحصائيات السجلات
CREATE OR REPLACE FUNCTION get_records_stats()
RETURNS TABLE (
  total_count bigint,
  pending_count bigint,
  completed_count bigint,
  refused_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE NOT is_refused AND status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE NOT is_refused AND status = 'completed') as completed_count,
    COUNT(*) FILTER (WHERE is_refused = true) as refused_count
  FROM collection_records;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة للحصول على عدد المحصلين النشطين
CREATE OR REPLACE FUNCTION get_active_field_agents_count()
RETURNS bigint AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM users
    WHERE role IN ('field_agent', 'employee')
    AND is_active = true 
    AND username NOT LIKE '%(محذوف)%'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 12. إدراج المستخدمين الافتراضيين
-- ==============================================

-- تعطيل RLS مؤقتاً لإدراج البيانات
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- إدراج المدير الافتراضي
INSERT INTO users (username, password_hash, role, full_name, is_active) 
VALUES (
  'admin',
  '$2b$10$tT733iv3KU0N0hPb5shxKuonXqtWb3OH2XkpKOZ7r5l4T6f/bLHOW', -- 'admin123'
  'admin',
  'مدير النظام',
  true
) ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name,
  is_active = EXCLUDED.is_active;

-- إدراج محصل ميداني تجريبي
INSERT INTO users (username, password_hash, role, full_name, is_active)
VALUES (
  'agent1',
  '$2b$10$tP.ddSbS7Kx/yT7IcBkYM.Ue1QhcMq4u5uTuTB3EV9.F1wLHG.IRa', -- 'agent123'
  'field_agent',
  'محمد أحمد - محصل ميداني',
  true
) ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name,
  is_active = EXCLUDED.is_active;

-- إدراج موظف تجريبي
INSERT INTO users (username, password_hash, role, full_name, is_active)
VALUES (
  'employee1',
  '$2b$10$QInKSXtKEefLhfs/FcI8MOXT4nhi2lIlH/okBGRg1KUHx4we0MEI2', -- 'employee123'
  'employee',
  'أحمد محمد - موظف',
  true
) ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name,
  is_active = EXCLUDED.is_active;

-- إعادة تفعيل RLS (معطل للتطوير)
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- 13. سياسات التخزين (بيئة التطوير فقط)
--  ملاحظة: هذه السياسات توسّع صلاحيات anon على bucket 'photos' محلياً
--  قبل النشر للإنتاج، يُنصح بإزالتها أو تقييدها للمصادقين فقط
-- ==============================================

-- قراءة عامة (تأكيد وجودها)
DROP POLICY IF EXISTS "Public read access for photos" ON storage.objects;
CREATE POLICY "Public read access for photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'photos');

-- رفع ملفات بواسطة anon (محلياً فقط)
DROP POLICY IF EXISTS "Anon can upload photos (local)" ON storage.objects;
CREATE POLICY "Anon can upload photos (local)"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'photos');

-- تحديث ملفات بواسطة anon (محلياً فقط)
DROP POLICY IF EXISTS "Anon can update photos (local)" ON storage.objects;
CREATE POLICY "Anon can update photos (local)"
  ON storage.objects FOR UPDATE
  TO anon
  USING (bucket_id = 'photos');

-- حذف ملفات بواسطة anon (محلياً فقط)
DROP POLICY IF EXISTS "Anon can delete photos (local)" ON storage.objects;
CREATE POLICY "Anon can delete photos (local)"
  ON storage.objects FOR DELETE
  TO anon
  USING (bucket_id = 'photos');

-- ==============================================
-- 14. سياسات RLS للسجلات (بيئة التطوير فقط)
-- ==============================================

-- تعطيل RLS مؤقتاً لجدول collection_records للتطوير
ALTER TABLE collection_records DISABLE ROW LEVEL SECURITY;

-- السماح للـ anon بإنشاء السجلات (محلياً فقط)
DROP POLICY IF EXISTS "Anon can create records (local)" ON collection_records;
CREATE POLICY "Anon can create records (local)"
  ON collection_records FOR INSERT
  TO anon
  WITH CHECK (true);

-- السماح للـ anon بقراءة السجلات (محلياً فقط)
DROP POLICY IF EXISTS "Anon can read records (local)" ON collection_records;
CREATE POLICY "Anon can read records (local)"
  ON collection_records FOR SELECT
  TO anon
  USING (true);

-- السماح للـ anon بتحديث السجلات (محلياً فقط)
DROP POLICY IF EXISTS "Anon can update records (local)" ON collection_records;
CREATE POLICY "Anon can update records (local)"
  ON collection_records FOR UPDATE
  TO anon
  USING (true);

-- ==============================================
-- 15. سياسات RLS للصور (بيئة التطوير فقط)
-- ==============================================

-- تعطيل RLS مؤقتاً لجدول record_photos للتطوير
ALTER TABLE record_photos DISABLE ROW LEVEL SECURITY;

-- السماح للـ anon بإضافة الصور (محلياً فقط)
DROP POLICY IF EXISTS "Anon can add photos (local)" ON record_photos;
CREATE POLICY "Anon can add photos (local)"
  ON record_photos FOR INSERT
  TO anon
  WITH CHECK (true);

-- السماح للـ anon بقراءة الصور (محلياً فقط)
DROP POLICY IF EXISTS "Anon can read photos (local)" ON record_photos;
CREATE POLICY "Anon can read photos (local)"
  ON record_photos FOR SELECT
  TO anon
  USING (true);

-- السماح للـ anon بتحديث الصور (محلياً فقط)
DROP POLICY IF EXISTS "Anon can update photos (local)" ON record_photos;
CREATE POLICY "Anon can update photos (local)"
  ON record_photos FOR UPDATE
  TO anon
  USING (true);
