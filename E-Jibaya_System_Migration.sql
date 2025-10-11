-- =====================================================
-- E-Jibaya System Database Migration
-- ملف التحديث الشامل لقاعدة البيانات مطابق للنظام
-- =====================================================

-- 1. حذف جميع الجداول الموجودة
-- =====================================================

DROP TABLE IF EXISTS public.user_sessions CASCADE;
DROP TABLE IF EXISTS public.record_locations CASCADE;
DROP TABLE IF EXISTS public.record_photos CASCADE;
DROP TABLE IF EXISTS public.record_changes_log CASCADE;
DROP TABLE IF EXISTS public.collection_records CASCADE;
DROP TABLE IF EXISTS public.backup_logs CASCADE;
DROP TABLE IF EXISTS public.backup_info CASCADE;
DROP TABLE IF EXISTS public.backups CASCADE;
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- 2. إنشاء الجداول الأساسية
-- =====================================================

-- جدول المستخدمين
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR NOT NULL,
    email VARCHAR NOT NULL UNIQUE,
    password_hash VARCHAR NOT NULL,
    role VARCHAR NOT NULL CHECK (role IN ('admin', 'field_agent')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول سجلات الجباية
CREATE TABLE public.collection_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_name VARCHAR,
    account_number VARCHAR CHECK (account_number IS NULL OR (LENGTH(account_number) <= 12 AND account_number ~ '^[0-9]+$')),
    meter_number VARCHAR,
    last_reading VARCHAR,
    region VARCHAR,
    gps_latitude NUMERIC,
    gps_longitude NUMERIC,
    meter_photo_url TEXT,
    invoice_photo_url TEXT,
    status VARCHAR DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refused')),
    is_refused BOOLEAN DEFAULT FALSE,
    field_agent_id UUID REFERENCES public.users(id),
    completed_by UUID REFERENCES public.users(id),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    locked_by UUID REFERENCES public.users(id),
    locked_at TIMESTAMP WITH TIME ZONE,
    lock_expires_at TIMESTAMP WITH TIME ZONE,
    category VARCHAR CHECK (category IN ('منزلي', 'تجاري', 'صناعي', 'زراعي', 'حكومي', 'انارة', 'محولة خاصة')),
    phase VARCHAR CHECK (phase IN ('احادي', 'ثلاثي', 'سي تي')),
    new_zone VARCHAR,
    new_block VARCHAR,
    new_home VARCHAR,
    meter_photo_verified BOOLEAN DEFAULT FALSE,
    invoice_photo_verified BOOLEAN DEFAULT FALSE,
    verification_status VARCHAR DEFAULT 'غير مدقق' CHECK (verification_status IN ('غير مدقق', 'مدقق'))
);

-- جدول سجلات التغييرات
CREATE TABLE public.record_changes_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES public.collection_records(id),
    field_name VARCHAR NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by UUID REFERENCES public.users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول سجل النشاط
CREATE TABLE public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id),
    action VARCHAR NOT NULL,
    target_type VARCHAR,
    target_id UUID,
    target_name VARCHAR,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول الصور الإضافية
CREATE TABLE public.record_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES public.collection_records(id),
    photo_type VARCHAR NOT NULL CHECK (photo_type IN ('meter', 'invoice')),
    photo_url TEXT NOT NULL,
    photo_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    verified BOOLEAN DEFAULT FALSE
);

-- جدول المواقع الجغرافية
CREATE TABLE public.record_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID,
    gps_latitude NUMERIC NOT NULL,
    gps_longitude NUMERIC NOT NULL,
    location_type VARCHAR NOT NULL CHECK (location_type IN ('submission', 'update', 'photo_upload')),
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول النسخ الاحتياطية
CREATE TABLE public.backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_name VARCHAR NOT NULL,
    backup_type VARCHAR NOT NULL CHECK (backup_type IN ('full', 'incremental', 'manual')),
    file_path TEXT NOT NULL,
    file_size BIGINT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed'))
);

-- جدول معلومات النسخ الاحتياطية
CREATE TABLE public.backup_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_name VARCHAR NOT NULL,
    backup_type VARCHAR NOT NULL DEFAULT 'manual',
    file_name VARCHAR,
    file_size BIGINT,
    file_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR DEFAULT 'completed',
    description TEXT,
    backup_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_records INTEGER DEFAULT 0,
    total_photos INTEGER DEFAULT 0,
    total_users INTEGER DEFAULT 0
);

-- جدول سجلات النسخ الاحتياطية
CREATE TABLE public.backup_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_type VARCHAR NOT NULL,
    backup_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    records_count INTEGER,
    file_size BIGINT,
    status VARCHAR DEFAULT 'completed',
    created_by UUID
);

-- جدول جلسات المستخدمين
CREATE TABLE public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    session_token VARCHAR NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. إنشاء الفهارس لتحسين الأداء
-- =====================================================

-- فهارس جدول المستخدمين
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_active ON public.users(is_active);

-- فهارس جدول سجلات الجباية
CREATE INDEX idx_collection_records_status ON public.collection_records(status);
CREATE INDEX idx_collection_records_field_agent ON public.collection_records(field_agent_id);
CREATE INDEX idx_collection_records_completed_by ON public.collection_records(completed_by);
CREATE INDEX idx_collection_records_submitted_at ON public.collection_records(submitted_at);
CREATE INDEX idx_collection_records_region ON public.collection_records(region);
CREATE INDEX idx_collection_records_category ON public.collection_records(category);
CREATE INDEX idx_collection_records_phase ON public.collection_records(phase);
CREATE INDEX idx_collection_records_verification_status ON public.collection_records(verification_status);
CREATE INDEX idx_collection_records_locked_by ON public.collection_records(locked_by);
CREATE INDEX idx_collection_records_lock_expires ON public.collection_records(lock_expires_at);

-- فهارس جدول سجلات التغييرات
CREATE INDEX idx_record_changes_log_record_id ON public.record_changes_log(record_id);
CREATE INDEX idx_record_changes_log_changed_by ON public.record_changes_log(changed_by);
CREATE INDEX idx_record_changes_log_changed_at ON public.record_changes_log(changed_at);

-- فهارس جدول سجل النشاط
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_action ON public.activity_logs(action);
CREATE INDEX idx_activity_logs_target_type ON public.activity_logs(target_type);
CREATE INDEX idx_activity_logs_target_id ON public.activity_logs(target_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at);

-- فهارس جدول الصور الإضافية
CREATE INDEX idx_record_photos_record_id ON public.record_photos(record_id);
CREATE INDEX idx_record_photos_type ON public.record_photos(photo_type);
CREATE INDEX idx_record_photos_created_by ON public.record_photos(created_by);
CREATE INDEX idx_record_photos_verified ON public.record_photos(verified);
CREATE INDEX idx_record_photos_record_id_verified ON public.record_photos(record_id, verified);

-- فهارس جدول المواقع الجغرافية
CREATE INDEX idx_record_locations_record_id ON public.record_locations(record_id);
CREATE INDEX idx_record_locations_type ON public.record_locations(location_type);
CREATE INDEX idx_record_locations_created_by ON public.record_locations(created_by);

-- فهارس جدول النسخ الاحتياطية
CREATE INDEX idx_backups_type ON public.backups(backup_type);
CREATE INDEX idx_backups_created_by ON public.backups(created_by);
CREATE INDEX idx_backups_created_at ON public.backups(created_at);

-- فهارس جدول معلومات النسخ الاحتياطية
CREATE INDEX idx_backup_info_type ON public.backup_info(backup_type);
CREATE INDEX idx_backup_info_status ON public.backup_info(status);
CREATE INDEX idx_backup_info_created_at ON public.backup_info(created_at);

-- فهارس جدول سجلات النسخ الاحتياطية
CREATE INDEX idx_backup_logs_type ON public.backup_logs(backup_type);
CREATE INDEX idx_backup_logs_status ON public.backup_logs(status);
CREATE INDEX idx_backup_logs_date ON public.backup_logs(backup_date);

-- فهارس جدول جلسات المستخدمين
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON public.user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires ON public.user_sessions(expires_at);

-- 4. إنشاء الدوال المطلوبة
-- =====================================================

-- دالة إحصائيات السجلات
DROP FUNCTION IF EXISTS get_records_stats();
CREATE FUNCTION get_records_stats()
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
        COUNT(*) FILTER (WHERE status = 'pending' AND is_refused = FALSE) as pending,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE verification_status = 'مدقق') as verified,
        COUNT(*) FILTER (WHERE is_refused = TRUE OR status = 'refused') as refused
    FROM public.collection_records;
END;
$$ LANGUAGE plpgsql;

-- دالة تحديث timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. إنشاء Triggers
-- =====================================================

-- Trigger لتحديث updated_at في جدول المستخدمين
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger لتحديث updated_at في جدول سجلات الجباية
DROP TRIGGER IF EXISTS update_collection_records_updated_at ON public.collection_records;
CREATE TRIGGER update_collection_records_updated_at
    BEFORE UPDATE ON public.collection_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 6. إدراج البيانات الافتراضية
-- =====================================================

-- إدراج مستخدم إداري افتراضي
INSERT INTO public.users (id, full_name, email, password_hash, role, is_active)
VALUES (
    'ba7a2d56-daa7-44d5-9b90-80a9843be1c1',
    'مدير النظام',
    'admin@ejibaya.com',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password
    'admin',
    TRUE
) ON CONFLICT (id) DO NOTHING;

-- إدراج محصل ميداني افتراضي
INSERT INTO public.users (id, full_name, email, password_hash, role, is_active)
VALUES (
    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    'محصل ميداني',
    'field@ejibaya.com',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password
    'field_agent',
    TRUE
) ON CONFLICT (id) DO NOTHING;

-- 7. إعدادات الأمان والصلاحيات
-- =====================================================

-- تفعيل Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_changes_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان للمستخدمين
CREATE POLICY "Users can view all users" ON public.users
    FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- سياسات الأمان لسجلات الجباية
CREATE POLICY "Users can view all collection records" ON public.collection_records
    FOR SELECT USING (true);

CREATE POLICY "Field agents can insert collection records" ON public.collection_records
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update collection records" ON public.collection_records
    FOR UPDATE USING (true);

CREATE POLICY "Admins can delete collection records" ON public.collection_records
    FOR DELETE USING (true);

-- سياسات الأمان لسجلات التغييرات
CREATE POLICY "Users can view record changes" ON public.record_changes_log
    FOR SELECT USING (true);

CREATE POLICY "Users can insert record changes" ON public.record_changes_log
    FOR INSERT WITH CHECK (true);

-- سياسات الأمان لسجل النشاط
CREATE POLICY "Users can view activity logs" ON public.activity_logs
    FOR SELECT USING (true);

CREATE POLICY "Users can insert activity logs" ON public.activity_logs
    FOR INSERT WITH CHECK (true);

-- سياسات الأمان للصور الإضافية
CREATE POLICY "Users can view record photos" ON public.record_photos
    FOR SELECT USING (true);

CREATE POLICY "Users can insert record photos" ON public.record_photos
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update record photos" ON public.record_photos
    FOR UPDATE USING (true);

CREATE POLICY "Users can delete record photos" ON public.record_photos
    FOR DELETE USING (true);

-- سياسات الأمان للمواقع الجغرافية
CREATE POLICY "Users can view record locations" ON public.record_locations
    FOR SELECT USING (true);

CREATE POLICY "Users can insert record locations" ON public.record_locations
    FOR INSERT WITH CHECK (true);

-- سياسات الأمان للنسخ الاحتياطية
CREATE POLICY "Admins can view backups" ON public.backups
    FOR SELECT USING (true);

CREATE POLICY "Admins can insert backups" ON public.backups
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view backup info" ON public.backup_info
    FOR SELECT USING (true);

CREATE POLICY "Admins can insert backup info" ON public.backup_info
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view backup logs" ON public.backup_logs
    FOR SELECT USING (true);

CREATE POLICY "Admins can insert backup logs" ON public.backup_logs
    FOR INSERT WITH CHECK (true);

-- سياسات الأمان لجلسات المستخدمين
CREATE POLICY "Users can view their own sessions" ON public.user_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert sessions" ON public.user_sessions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can delete their own sessions" ON public.user_sessions
    FOR DELETE USING (auth.uid() = user_id);

-- 8. تنظيف البيانات القديمة (إذا وجدت)
-- =====================================================

-- تنظيف السجلات المقفلة المنتهية الصلاحية (أكثر من 30 دقيقة)
DELETE FROM public.collection_records 
WHERE locked_at IS NOT NULL 
AND lock_expires_at IS NOT NULL 
AND lock_expires_at < NOW() - INTERVAL '30 minutes';

-- تنظيف سجلات النشاط القديمة (أكثر من 90 يوم)
DELETE FROM public.activity_logs 
WHERE created_at < NOW() - INTERVAL '90 days';

-- تنظيف الجلسات المنتهية الصلاحية
DELETE FROM public.user_sessions 
WHERE expires_at < NOW();

-- 9. إعدادات إضافية
-- =====================================================

-- تحديث إحصائيات الجداول
ANALYZE public.users;
ANALYZE public.collection_records;
ANALYZE public.record_changes_log;
ANALYZE public.activity_logs;
ANALYZE public.record_photos;
ANALYZE public.record_locations;
ANALYZE public.backups;
ANALYZE public.backup_info;
ANALYZE public.backup_logs;
ANALYZE public.user_sessions;

-- 10. رسالة النجاح
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE 'E-Jibaya System Database Migration Completed Successfully!';
    RAISE NOTICE 'All tables, indexes, functions, and policies have been created.';
    RAISE NOTICE 'Default users have been inserted.';
    RAISE NOTICE 'Database is ready for use.';
END $$;
