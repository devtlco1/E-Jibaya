-- =====================================================
-- E-Jibaya Final Migration - ملف واحد شامل
-- =====================================================
-- هذا الملف يحتوي على جميع الإصلاحات في ملف واحد
-- نفذ هذا الملف مرة واحدة فقط في Supabase SQL Editor

-- =====================================================
-- 1. حذف جميع الجداول والسياسات الموجودة
-- =====================================================

-- حذف جميع السياسات أولاً
DROP POLICY IF EXISTS "backup_info_all_access" ON public.backup_info;
DROP POLICY IF EXISTS "Allow all operations on backup_info" ON public.backup_info;
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
DROP POLICY IF EXISTS "users_update_policy" ON public.users;
DROP POLICY IF EXISTS "users_delete_policy" ON public.users;
DROP POLICY IF EXISTS "collection_records_select_policy" ON public.collection_records;
DROP POLICY IF EXISTS "collection_records_insert_policy" ON public.collection_records;
DROP POLICY IF EXISTS "collection_records_update_policy" ON public.collection_records;
DROP POLICY IF EXISTS "collection_records_delete_policy" ON public.collection_records;
DROP POLICY IF EXISTS "activity_logs_select_policy" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs_insert_policy" ON public.activity_logs;
DROP POLICY IF EXISTS "record_photos_select_policy" ON public.record_photos;
DROP POLICY IF EXISTS "record_photos_insert_policy" ON public.record_photos;
DROP POLICY IF EXISTS "record_photos_delete_policy" ON public.record_photos;
DROP POLICY IF EXISTS "record_locations_select_policy" ON public.record_locations;
DROP POLICY IF EXISTS "record_locations_insert_policy" ON public.record_locations;
DROP POLICY IF EXISTS "record_locations_update_policy" ON public.record_locations;
DROP POLICY IF EXISTS "record_locations_delete_policy" ON public.record_locations;
DROP POLICY IF EXISTS "user_sessions_select_policy" ON public.user_sessions;
DROP POLICY IF EXISTS "user_sessions_insert_policy" ON public.user_sessions;
DROP POLICY IF EXISTS "user_sessions_delete_policy" ON public.user_sessions;

-- حذف جميع الجداول
DROP TABLE IF EXISTS public.backup_info CASCADE;
DROP TABLE IF EXISTS public.record_locations CASCADE;
DROP TABLE IF EXISTS public.record_photos CASCADE;
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.collection_records CASCADE;
DROP TABLE IF EXISTS public.user_sessions CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- حذف جميع الدوال
DROP FUNCTION IF EXISTS get_records_stats();
DROP FUNCTION IF EXISTS get_active_field_agents_count();

-- =====================================================
-- 2. إنشاء الجداول من الصفر
-- =====================================================

-- جدول المستخدمين
CREATE TABLE public.users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'field_agent')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول سجلات الجباية
CREATE TABLE public.collection_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subscriber_name VARCHAR(100),
    account_number VARCHAR(50),
    meter_number VARCHAR(50),
    address TEXT,
    last_reading VARCHAR(20),
    meter_photo_url TEXT,
    invoice_photo_url TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'reviewed')),
    is_refused BOOLEAN DEFAULT false,
    notes TEXT,
    gps_latitude DECIMAL(10, 8),
    gps_longitude DECIMAL(11, 8),
    field_agent_id UUID REFERENCES public.users(id),
    completed_by UUID REFERENCES public.users(id),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- الترميز الجديد
    new_zone VARCHAR(20),
    new_block VARCHAR(20),
    new_home VARCHAR(20)
);

-- جدول صور السجلات (مع جميع الأعمدة المطلوبة)
CREATE TABLE public.record_photos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    record_id UUID REFERENCES public.collection_records(id) ON DELETE CASCADE,
    photo_type VARCHAR(20) NOT NULL CHECK (photo_type IN ('meter', 'invoice')),
    photo_url TEXT NOT NULL,
    file_name VARCHAR(255),
    file_size INTEGER,
    created_by UUID REFERENCES public.users(id),
    notes TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول المواقع التاريخية للسجلات
CREATE TABLE public.record_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    record_id UUID REFERENCES public.collection_records(id) ON DELETE CASCADE,
    gps_latitude DECIMAL(10, 8) NOT NULL,
    gps_longitude DECIMAL(11, 8) NOT NULL,
    location_type VARCHAR(50) NOT NULL CHECK (location_type IN ('submission', 'update', 'photo_upload')),
    notes TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول سجل النشاط
CREATE TABLE public.activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id),
    action VARCHAR(50) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id UUID,
    target_name VARCHAR(255),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول جلسات المستخدمين
CREATE TABLE public.user_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول معلومات النسخ الاحتياطي
CREATE TABLE public.backup_info (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    backup_name VARCHAR(255) NOT NULL,
    backup_type VARCHAR(50) NOT NULL DEFAULT 'manual',
    file_name VARCHAR(255),
    file_size BIGINT,
    file_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'completed',
    description TEXT,
    backup_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_records INTEGER DEFAULT 0,
    total_photos INTEGER DEFAULT 0,
    total_users INTEGER DEFAULT 0
);

-- =====================================================
-- 3. إنشاء الدوال
-- =====================================================

-- دالة إحصائيات السجلات
CREATE OR REPLACE FUNCTION get_records_stats()
RETURNS TABLE(
    total BIGINT,
    pending BIGINT,
    completed BIGINT,
    refused BIGINT
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending' AND is_refused = false) as pending,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE is_refused = true) as refused
    FROM collection_records;
$$;

-- دالة عدد المحصلين النشطين
CREATE OR REPLACE FUNCTION get_active_field_agents_count()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COUNT(*)::INTEGER
    FROM users 
    WHERE role = 'field_agent' AND is_active = true;
$$;

-- =====================================================
-- 4. تفعيل Row Level Security
-- =====================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_info ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 5. إنشاء السياسات (مع إصلاح anon access)
-- =====================================================

-- سياسات جدول المستخدمين
CREATE POLICY "users_select_policy" ON public.users
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "users_insert_policy" ON public.users
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "users_update_policy" ON public.users
    FOR UPDATE TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "users_delete_policy" ON public.users
    FOR DELETE TO anon, authenticated
    USING (true);

-- سياسات جدول سجلات الجباية
CREATE POLICY "collection_records_select_policy" ON public.collection_records
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "collection_records_insert_policy" ON public.collection_records
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "collection_records_update_policy" ON public.collection_records
    FOR UPDATE TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "collection_records_delete_policy" ON public.collection_records
    FOR DELETE TO anon, authenticated
    USING (true);

-- سياسات جدول صور السجلات
CREATE POLICY "record_photos_select_policy" ON public.record_photos
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "record_photos_insert_policy" ON public.record_photos
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "record_photos_update_policy" ON public.record_photos
    FOR UPDATE TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "record_photos_delete_policy" ON public.record_photos
    FOR DELETE TO anon, authenticated
    USING (true);

-- سياسات جدول المواقع التاريخية
CREATE POLICY "record_locations_select_policy" ON public.record_locations
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "record_locations_insert_policy" ON public.record_locations
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "record_locations_update_policy" ON public.record_locations
    FOR UPDATE TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "record_locations_delete_policy" ON public.record_locations
    FOR DELETE TO anon, authenticated
    USING (true);

-- سياسات جدول سجل النشاط
CREATE POLICY "activity_logs_select_policy" ON public.activity_logs
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "activity_logs_insert_policy" ON public.activity_logs
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

-- سياسات جدول جلسات المستخدمين
CREATE POLICY "user_sessions_select_policy" ON public.user_sessions
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "user_sessions_insert_policy" ON public.user_sessions
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "user_sessions_delete_policy" ON public.user_sessions
    FOR DELETE TO anon, authenticated
    USING (true);

-- سياسات جدول النسخ الاحتياطي
CREATE POLICY "backup_info_all_access" ON public.backup_info
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- 6. إدراج البيانات الأساسية (مع كلمات مرور صحيحة)
-- =====================================================

-- إدراج المستخدم الإدمن بكلمة مرور صحيحة
-- كلمة المرور: admin123 (مشفرة بـ bcrypt saltRounds=12)
INSERT INTO public.users (id, username, password_hash, full_name, role, is_active) VALUES
('ba7a2d56-daa7-44d5-9b90-80a9843be1c1', 'admin', '$2b$12$FeKHxDzVWSOg8Io8wNo36e60s.4sPZJwhTInRjnmqV7TmhvYDs7KW', 'مدير النظام', 'admin', true);

-- إدراج محصل تجريبي بكلمة مرور صحيحة
-- كلمة المرور: agent123 (مشفرة بـ bcrypt saltRounds=12)
INSERT INTO public.users (username, password_hash, full_name, role, is_active) VALUES
('agent1', '$2b$12$Cu5p19pLu6AyDOCXRtNKv.aYN3n5YhO20Dz8gGgXxkGZGwVHIZx4G', 'محصل تجريبي', 'field_agent', true);

-- =====================================================
-- 7. إنشاء الفهارس لتحسين الأداء
-- =====================================================

CREATE INDEX idx_collection_records_field_agent ON public.collection_records(field_agent_id);
CREATE INDEX idx_collection_records_status ON public.collection_records(status);
CREATE INDEX idx_collection_records_submitted_at ON public.collection_records(submitted_at);
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at);
CREATE INDEX idx_record_photos_record_id ON public.record_photos(record_id);
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON public.user_sessions(expires_at);

-- =====================================================
-- 8. إنشاء Triggers للتحديث التلقائي
-- =====================================================

-- دالة تحديث updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- تطبيق trigger على الجداول
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_collection_records_updated_at BEFORE UPDATE ON public.collection_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_record_photos_updated_at BEFORE UPDATE ON public.record_photos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_backup_info_updated_at BEFORE UPDATE ON public.backup_info FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 9. رسالة النجاح
-- =====================================================

SELECT '🎉 تم إنشاء نظام E-Jibaya بالكامل بنجاح!' as result,
       '✅ جميع الجداول والسياسات والدوال تم إنشاؤها' as status,
       '✅ المستخدم الإدمن: admin (كلمة المرور: admin123)' as admin_info,
       '✅ المحصل التجريبي: agent1 (كلمة المرور: agent123)' as agent_info,
       '✅ النظام جاهز للاستخدام' as ready_status;
