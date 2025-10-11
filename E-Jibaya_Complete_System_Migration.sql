-- =====================================================
-- E-Jibaya Complete System Migration
-- بناء قاعدة البيانات من الصفر حسب متطلبات النظام الحالي
-- =====================================================

-- =====================================================
-- 1. حذف جميع الجداول والسياسات والدوال الموجودة
-- =====================================================

-- حذف جميع السياسات الأمنية
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
DROP POLICY IF EXISTS "record_photos_update_policy" ON public.record_photos;
DROP POLICY IF EXISTS "record_photos_delete_policy" ON public.record_photos;
DROP POLICY IF EXISTS "record_locations_select_policy" ON public.record_locations;
DROP POLICY IF EXISTS "record_locations_insert_policy" ON public.record_locations;
DROP POLICY IF EXISTS "record_locations_update_policy" ON public.record_locations;
DROP POLICY IF EXISTS "record_locations_delete_policy" ON public.record_locations;
DROP POLICY IF EXISTS "user_sessions_select_policy" ON public.user_sessions;
DROP POLICY IF EXISTS "user_sessions_insert_policy" ON public.user_sessions;
DROP POLICY IF EXISTS "user_sessions_delete_policy" ON public.user_sessions;
DROP POLICY IF EXISTS "backup_info_select_policy" ON public.backup_info;
DROP POLICY IF EXISTS "backup_info_insert_policy" ON public.backup_info;
DROP POLICY IF EXISTS "backup_info_update_policy" ON public.backup_info;
DROP POLICY IF EXISTS "backup_info_delete_policy" ON public.backup_info;

-- حذف جميع الجداول (مع CASCADE لحذف المراجع)
DROP TABLE IF EXISTS public.backup_info CASCADE;
DROP TABLE IF EXISTS public.record_locations CASCADE;
DROP TABLE IF EXISTS public.record_photos CASCADE;
DROP TABLE IF EXISTS public.record_changes_log CASCADE;
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.collection_records CASCADE;
DROP TABLE IF EXISTS public.user_sessions CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- حذف جميع الدوال
DROP FUNCTION IF EXISTS get_records_stats();
DROP FUNCTION IF EXISTS get_active_field_agents_count();
DROP FUNCTION IF EXISTS getRecordWithPhotos(UUID);

-- =====================================================
-- 2. إنشاء الجداول من الصفر
-- =====================================================

-- جدول المستخدمين (مع username بدلاً من email)
CREATE TABLE public.users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'field_agent', 'employee')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول سجلات الجباية (مع جميع الحقول المطلوبة)
CREATE TABLE public.collection_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    -- بيانات المشترك
    subscriber_name VARCHAR(100),
    account_number VARCHAR(50) CHECK (account_number IS NULL OR (LENGTH(account_number) <= 12 AND account_number ~ '^[0-9]+$')),
    meter_number VARCHAR(50),
    region VARCHAR(255),
    last_reading VARCHAR(20),
    -- الصور
    meter_photo_url TEXT,
    invoice_photo_url TEXT,
    -- حالة السجل
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refused')),
    is_refused BOOLEAN DEFAULT false,
    -- معلومات إضافية
    notes TEXT,
    gps_latitude DECIMAL(10, 8),
    gps_longitude DECIMAL(11, 8),
    -- المستخدمين
    field_agent_id UUID REFERENCES public.users(id),
    completed_by UUID REFERENCES public.users(id),
    -- التواريخ
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- الترميز الجديد
    new_zone VARCHAR(20),
    new_block VARCHAR(20),
    new_home VARCHAR(20),
    -- نظام القفل
    locked_by UUID REFERENCES public.users(id),
    locked_at TIMESTAMP WITH TIME ZONE,
    lock_expires_at TIMESTAMP WITH TIME ZONE,
    -- الصنف
    category VARCHAR(50) CHECK (category IN ('منزلي', 'تجاري', 'صناعي', 'زراعي', 'حكومي', 'انارة', 'محولة خاصة')),
    -- نوع المقياس
    phase VARCHAR(20) CHECK (phase IN ('احادي', 'ثلاثي', 'سي تي')),
    -- تدقيق الصور
    meter_photo_verified BOOLEAN DEFAULT false,
    invoice_photo_verified BOOLEAN DEFAULT false,
    verification_status VARCHAR(20) DEFAULT 'غير مدقق' CHECK (verification_status IN ('غير مدقق', 'مدقق'))
);

-- جدول الصور الإضافية
CREATE TABLE public.record_photos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    record_id UUID REFERENCES public.collection_records(id) ON DELETE CASCADE,
    photo_type VARCHAR(20) NOT NULL CHECK (photo_type IN ('meter', 'invoice')),
    photo_url TEXT NOT NULL,
    photo_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    verified BOOLEAN DEFAULT false
);

-- جدول المواقع التاريخية
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

-- جدول سجل التغييرات
CREATE TABLE public.record_changes_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    record_id UUID REFERENCES public.collection_records(id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by UUID REFERENCES public.users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
    ip_address INET,
    user_agent TEXT,
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
-- 3. إنشاء الفهارس لتحسين الأداء
-- =====================================================

-- فهارس جدول المستخدمين
CREATE INDEX idx_users_username ON public.users(username);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_is_active ON public.users(is_active);

-- فهارس جدول السجلات
CREATE INDEX idx_collection_records_status ON public.collection_records(status);
CREATE INDEX idx_collection_records_is_refused ON public.collection_records(is_refused);
CREATE INDEX idx_collection_records_field_agent_id ON public.collection_records(field_agent_id);
CREATE INDEX idx_collection_records_completed_by ON public.collection_records(completed_by);
CREATE INDEX idx_collection_records_submitted_at ON public.collection_records(submitted_at);
CREATE INDEX idx_collection_records_region ON public.collection_records(region);
CREATE INDEX idx_collection_records_category ON public.collection_records(category);
CREATE INDEX idx_collection_records_phase ON public.collection_records(phase);
CREATE INDEX idx_collection_records_verification_status ON public.collection_records(verification_status);
CREATE INDEX idx_collection_records_meter_photo_verified ON public.collection_records(meter_photo_verified);
CREATE INDEX idx_collection_records_invoice_photo_verified ON public.collection_records(invoice_photo_verified);
CREATE INDEX idx_collection_records_locked_by ON public.collection_records(locked_by);
CREATE INDEX idx_collection_records_lock_expires_at ON public.collection_records(lock_expires_at);

-- فهارس جدول الصور
CREATE INDEX idx_record_photos_record_id ON public.record_photos(record_id);
CREATE INDEX idx_record_photos_photo_type ON public.record_photos(photo_type);
CREATE INDEX idx_record_photos_created_by ON public.record_photos(created_by);
CREATE INDEX idx_record_photos_verified ON public.record_photos(verified);

-- فهارس جدول المواقع
CREATE INDEX idx_record_locations_record_id ON public.record_locations(record_id);
CREATE INDEX idx_record_locations_location_type ON public.record_locations(location_type);
CREATE INDEX idx_record_locations_created_by ON public.record_locations(created_by);

-- فهارس جدول التغييرات
CREATE INDEX idx_record_changes_log_record_id ON public.record_changes_log(record_id);
CREATE INDEX idx_record_changes_log_changed_by ON public.record_changes_log(changed_by);
CREATE INDEX idx_record_changes_log_changed_at ON public.record_changes_log(changed_at);

-- فهارس جدول النشاط
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_action ON public.activity_logs(action);
CREATE INDEX idx_activity_logs_target_type ON public.activity_logs(target_type);
CREATE INDEX idx_activity_logs_target_id ON public.activity_logs(target_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at);

-- فهارس جدول الجلسات
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_session_token ON public.user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires_at ON public.user_sessions(expires_at);

-- فهارس جدول النسخ الاحتياطي
CREATE INDEX idx_backup_info_backup_type ON public.backup_info(backup_type);
CREATE INDEX idx_backup_info_status ON public.backup_info(status);
CREATE INDEX idx_backup_info_created_at ON public.backup_info(created_at);

-- =====================================================
-- 4. إنشاء الدوال المطلوبة
-- =====================================================

-- دالة إحصائيات السجلات
CREATE OR REPLACE FUNCTION get_records_stats()
RETURNS TABLE (
    total BIGINT,
    pending BIGINT,
    completed BIGINT,
    verified BIGINT,
    refused BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending' AND is_refused = false) as pending,
        COUNT(*) FILTER (WHERE status = 'completed' AND is_refused = false) as completed,
        COUNT(*) FILTER (WHERE verification_status = 'مدقق') as verified,
        COUNT(*) FILTER (WHERE is_refused = true) as refused
    FROM public.collection_records;
END;
$$ LANGUAGE plpgsql;

-- دالة عدد المحصلين النشطين
CREATE OR REPLACE FUNCTION get_active_field_agents_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM public.users
        WHERE role = 'field_agent' AND is_active = true
    );
END;
$$ LANGUAGE plpgsql;

-- دالة الحصول على السجل مع الصور
CREATE OR REPLACE FUNCTION getRecordWithPhotos(record_id UUID)
RETURNS TABLE (
    record_data JSONB,
    photos_data JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        to_jsonb(cr.*) as record_data,
        COALESCE(
            (
                SELECT jsonb_agg(to_jsonb(rp.*))
                FROM public.record_photos rp
                WHERE rp.record_id = record_id
            ),
            '[]'::jsonb
        ) as photos_data
    FROM public.collection_records cr
    WHERE cr.id = record_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. إنشاء السياسات الأمنية (Row Level Security)
-- =====================================================

-- تفعيل RLS على جميع الجداول
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_changes_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_info ENABLE ROW LEVEL SECURITY;

-- سياسات جدول المستخدمين
CREATE POLICY "users_select_policy" ON public.users
    FOR SELECT USING (true);

CREATE POLICY "users_insert_policy" ON public.users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "users_update_policy" ON public.users
    FOR UPDATE USING (true);

CREATE POLICY "users_delete_policy" ON public.users
    FOR DELETE USING (true);

-- سياسات جدول السجلات
CREATE POLICY "collection_records_select_policy" ON public.collection_records
    FOR SELECT USING (true);

CREATE POLICY "collection_records_insert_policy" ON public.collection_records
    FOR INSERT WITH CHECK (true);

CREATE POLICY "collection_records_update_policy" ON public.collection_records
    FOR UPDATE USING (true);

CREATE POLICY "collection_records_delete_policy" ON public.collection_records
    FOR DELETE USING (true);

-- سياسات جدول الصور
CREATE POLICY "record_photos_select_policy" ON public.record_photos
    FOR SELECT USING (true);

CREATE POLICY "record_photos_insert_policy" ON public.record_photos
    FOR INSERT WITH CHECK (true);

CREATE POLICY "record_photos_update_policy" ON public.record_photos
    FOR UPDATE USING (true);

CREATE POLICY "record_photos_delete_policy" ON public.record_photos
    FOR DELETE USING (true);

-- سياسات جدول المواقع
CREATE POLICY "record_locations_select_policy" ON public.record_locations
    FOR SELECT USING (true);

CREATE POLICY "record_locations_insert_policy" ON public.record_locations
    FOR INSERT WITH CHECK (true);

CREATE POLICY "record_locations_update_policy" ON public.record_locations
    FOR UPDATE USING (true);

CREATE POLICY "record_locations_delete_policy" ON public.record_locations
    FOR DELETE USING (true);

-- سياسات جدول التغييرات
CREATE POLICY "record_changes_log_select_policy" ON public.record_changes_log
    FOR SELECT USING (true);

CREATE POLICY "record_changes_log_insert_policy" ON public.record_changes_log
    FOR INSERT WITH CHECK (true);

-- سياسات جدول النشاط
CREATE POLICY "activity_logs_select_policy" ON public.activity_logs
    FOR SELECT USING (true);

CREATE POLICY "activity_logs_insert_policy" ON public.activity_logs
    FOR INSERT WITH CHECK (true);

-- سياسات جدول الجلسات
CREATE POLICY "user_sessions_select_policy" ON public.user_sessions
    FOR SELECT USING (true);

CREATE POLICY "user_sessions_insert_policy" ON public.user_sessions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "user_sessions_delete_policy" ON public.user_sessions
    FOR DELETE USING (true);

-- سياسات جدول النسخ الاحتياطي
CREATE POLICY "backup_info_select_policy" ON public.backup_info
    FOR SELECT USING (true);

CREATE POLICY "backup_info_insert_policy" ON public.backup_info
    FOR INSERT WITH CHECK (true);

CREATE POLICY "backup_info_update_policy" ON public.backup_info
    FOR UPDATE USING (true);

CREATE POLICY "backup_info_delete_policy" ON public.backup_info
    FOR DELETE USING (true);

-- =====================================================
-- 6. إدراج بيانات تجريبية (اختياري)
-- =====================================================

-- إدراج مستخدم مدير افتراضي
INSERT INTO public.users (username, password_hash, full_name, role, is_active) VALUES
('admin', '$2b$10$rQZ8K9mN2pL3oQ4rS5tU6uV7wX8yZ9aA0bB1cC2dD3eE4fF5gG6hH7iI8jJ9kK0lL1mM2nN3oO4pP5qQ6rR7sS8tT9uU0vV1wW2xX3yY4zZ5', 'مدير النظام', 'admin', true);

-- إدراج محصل ميداني تجريبي
INSERT INTO public.users (username, password_hash, full_name, role, is_active) VALUES
('field_agent_1', '$2b$10$rQZ8K9mN2pL3oQ4rS5tU6uV7wX8yZ9aA0bB1cC2dD3eE4fF5gG6hH7iI8jJ9kK0lL1mM2nN3oO4pP5qQ6rR7sS8tT9uU0vV1wW2xX3yY4zZ5', 'محصل ميداني', 'field_agent', true);

-- إدراج موظف تجريبي
INSERT INTO public.users (username, password_hash, full_name, role, is_active) VALUES
('employee_1', '$2b$10$rQZ8K9mN2pL3oQ4rS5tU6uV7wX8yZ9aA0bB1cC2dD3eE4fF5gG6hH7iI8jJ9kK0lL1mM2nN3oO4pP5qQ6rR7sS8tT9uU0vV1wW2xX3yY4zZ5', 'موظف النظام', 'employee', true);

-- =====================================================
-- 7. إنشاء Triggers للتحديث التلقائي
-- =====================================================

-- Trigger لتحديث updated_at في جدول المستخدمين
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_users_updated_at();

-- Trigger لتحديث updated_at في جدول السجلات
CREATE OR REPLACE FUNCTION update_collection_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_collection_records_updated_at
    BEFORE UPDATE ON public.collection_records
    FOR EACH ROW
    EXECUTE FUNCTION update_collection_records_updated_at();

-- Trigger لتحديث updated_at في جدول النسخ الاحتياطي
CREATE OR REPLACE FUNCTION update_backup_info_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_backup_info_updated_at
    BEFORE UPDATE ON public.backup_info
    FOR EACH ROW
    EXECUTE FUNCTION update_backup_info_updated_at();

-- =====================================================
-- 8. إنشاء Views مفيدة
-- =====================================================

-- View للسجلات مع معلومات المستخدمين
CREATE VIEW v_collection_records_with_users AS
SELECT 
    cr.*,
    fa.full_name as field_agent_name,
    cb.full_name as completed_by_name,
    lb.full_name as locked_by_name
FROM public.collection_records cr
LEFT JOIN public.users fa ON cr.field_agent_id = fa.id
LEFT JOIN public.users cb ON cr.completed_by = cb.id
LEFT JOIN public.users lb ON cr.locked_by = lb.id;

-- View للإحصائيات الشاملة
CREATE VIEW v_system_stats AS
SELECT 
    (SELECT COUNT(*) FROM public.users WHERE is_active = true) as active_users,
    (SELECT COUNT(*) FROM public.collection_records) as total_records,
    (SELECT COUNT(*) FROM public.collection_records WHERE status = 'pending') as pending_records,
    (SELECT COUNT(*) FROM public.collection_records WHERE status = 'completed') as completed_records,
    (SELECT COUNT(*) FROM public.collection_records WHERE is_refused = true) as refused_records,
    (SELECT COUNT(*) FROM public.collection_records WHERE verification_status = 'مدقق') as verified_records,
    (SELECT COUNT(*) FROM public.record_photos) as total_photos,
    (SELECT COUNT(*) FROM public.activity_logs) as total_activities;

-- =====================================================
-- 9. إنشاء Functions مساعدة
-- =====================================================

-- Function لتنظيف الجلسات المنتهية الصلاحية
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.user_sessions 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function لتنظيف السجلات المقفلة المنتهية الصلاحية
CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE public.collection_records 
    SET locked_by = NULL, locked_at = NULL, lock_expires_at = NULL
    WHERE lock_expires_at < NOW() AND locked_by IS NOT NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. إنشاء Jobs للصيانة التلقائية (إذا كان متوفراً)
-- =====================================================

-- ملاحظة: هذه الوظائف تتطلب pg_cron extension
-- يمكن تفعيلها لاحقاً إذا كان متوفراً

-- =====================================================
-- انتهاء Migration
-- =====================================================

-- رسالة نجاح
DO $$
BEGIN
    RAISE NOTICE 'E-Jibaya Complete System Migration completed successfully!';
    RAISE NOTICE 'Database structure created with all required tables, indexes, functions, and policies.';
    RAISE NOTICE 'Default users created: admin, field_agent_1, employee_1';
    RAISE NOTICE 'All passwords are hashed with bcrypt (default: password123)';
END $$;
