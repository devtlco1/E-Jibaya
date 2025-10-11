-- =====================================================
-- E-Jibaya Final Complete System Migration
-- بناء قاعدة البيانات من الصفر مع جميع التطويرات الحديثة
-- تاريخ الإنشاء: 2025-01-15
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
DROP POLICY IF EXISTS "backup_logs_select_policy" ON public.backup_logs;
DROP POLICY IF EXISTS "backup_logs_insert_policy" ON public.backup_logs;
DROP POLICY IF EXISTS "backup_logs_update_policy" ON public.backup_logs;
DROP POLICY IF EXISTS "backup_logs_delete_policy" ON public.backup_logs;

-- حذف جميع الجداول (مع CASCADE لحذف المراجع)
DROP TABLE IF EXISTS public.backup_logs CASCADE;
DROP TABLE IF EXISTS public.backup_info CASCADE;
DROP TABLE IF EXISTS public.record_locations CASCADE;
DROP TABLE IF EXISTS public.record_photos CASCADE;
DROP TABLE IF EXISTS public.record_changes_log CASCADE;
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.user_sessions CASCADE;
DROP TABLE IF EXISTS public.collection_records CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- حذف جميع الدوال
DROP FUNCTION IF EXISTS update_users_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_collection_records_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_backup_info_updated_at() CASCADE;
DROP FUNCTION IF EXISTS hash_password(text) CASCADE;
DROP FUNCTION IF EXISTS verify_password(text, text) CASCADE;
DROP FUNCTION IF EXISTS lock_record(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS unlock_record(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS is_record_locked(UUID) CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_locks() CASCADE;
DROP FUNCTION IF EXISTS get_user_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_collection_stats() CASCADE;
DROP FUNCTION IF EXISTS get_system_stats() CASCADE;

-- حذف جميع الـ Views
DROP VIEW IF EXISTS v_collection_records_with_users CASCADE;
DROP VIEW IF EXISTS v_system_stats CASCADE;
DROP VIEW IF EXISTS v_user_activity CASCADE;
DROP VIEW IF EXISTS v_backup_status CASCADE;

-- =====================================================
-- 2. إنشاء الجداول الأساسية
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

-- جدول سجلات الجباية (مع جميع الحقول المطلوبة والتطويرات الحديثة)
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
    -- تدقيق الصور (التطويرات الحديثة)
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
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
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


-- جدول سجلات النسخ الاحتياطي
CREATE TABLE public.backup_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    backup_type VARCHAR(50) NOT NULL,
    backup_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    records_count INTEGER,
    file_size BIGINT,
    status VARCHAR(50) DEFAULT 'completed',
    created_by UUID,
    FOREIGN KEY (created_by) REFERENCES public.users(id)
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
CREATE INDEX idx_collection_records_created_at ON public.collection_records(created_at);
CREATE INDEX idx_collection_records_updated_at ON public.collection_records(updated_at);

-- فهارس جدول الصور
CREATE INDEX idx_record_photos_record_id ON public.record_photos(record_id);
CREATE INDEX idx_record_photos_photo_type ON public.record_photos(photo_type);
CREATE INDEX idx_record_photos_created_by ON public.record_photos(created_by);
CREATE INDEX idx_record_photos_verified ON public.record_photos(verified);

-- فهارس جدول المواقع
CREATE INDEX idx_record_locations_record_id ON public.record_locations(record_id);
CREATE INDEX idx_record_locations_location_type ON public.record_locations(location_type);
CREATE INDEX idx_record_locations_created_by ON public.record_locations(created_by);

-- فهارس جدول سجل النشاط
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_action ON public.activity_logs(action);
CREATE INDEX idx_activity_logs_target_type ON public.activity_logs(target_type);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at);

-- فهارس جدول الجلسات
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_session_token ON public.user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires_at ON public.user_sessions(expires_at);

-- فهارس جدول النسخ الاحتياطي
CREATE INDEX idx_backup_info_backup_type ON public.backup_info(backup_type);
CREATE INDEX idx_backup_info_backup_date ON public.backup_info(backup_date);
CREATE INDEX idx_backup_info_status ON public.backup_info(status);

-- فهارس جدول سجلات النسخ الاحتياطي
CREATE INDEX idx_backup_logs_backup_type ON public.backup_logs(backup_type);
CREATE INDEX idx_backup_logs_backup_date ON public.backup_logs(backup_date);
CREATE INDEX idx_backup_logs_status ON public.backup_logs(status);

-- =====================================================
-- 4. إنشاء الدوال المساعدة
-- =====================================================

-- دالة لتشفير كلمات المرور
CREATE OR REPLACE FUNCTION hash_password(password text)
RETURNS text AS $$
BEGIN
    -- استخدام bcrypt مع salt rounds = 12
    RETURN crypt(password, gen_salt('bf', 12));
END;
$$ LANGUAGE plpgsql;

-- دالة للتحقق من كلمات المرور
CREATE OR REPLACE FUNCTION verify_password(password text, hash text)
RETURNS boolean AS $$
BEGIN
    RETURN crypt(password, hash) = hash;
END;
$$ LANGUAGE plpgsql;

-- دالة لقفل السجلات
CREATE OR REPLACE FUNCTION lock_record(record_id UUID, user_id UUID)
RETURNS boolean AS $$
DECLARE
    current_lock UUID;
    lock_expires TIMESTAMP WITH TIME ZONE;
BEGIN
    -- تنظيف الأقفال المنتهية الصلاحية
    PERFORM cleanup_expired_locks();
    
    -- التحقق من وجود السجل
    IF NOT EXISTS (SELECT 1 FROM public.collection_records WHERE id = record_id) THEN
        RETURN false;
    END IF;
    
    -- التحقق من القفل الحالي
    SELECT locked_by INTO current_lock 
    FROM public.collection_records 
    WHERE id = record_id;
    
    -- إذا كان مقفولاً من قبل مستخدم آخر
    IF current_lock IS NOT NULL AND current_lock != user_id THEN
        RETURN false;
    END IF;
    
    -- تعيين وقت انتهاء القفل (30 دقيقة)
    lock_expires := NOW() + INTERVAL '30 minutes';
    
    -- قفل السجل
    UPDATE public.collection_records 
    SET 
        locked_by = user_id,
        locked_at = NOW(),
        lock_expires_at = lock_expires
    WHERE id = record_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- دالة لإلغاء قفل السجلات
CREATE OR REPLACE FUNCTION unlock_record(record_id UUID, user_id UUID)
RETURNS boolean AS $$
BEGIN
    -- التحقق من أن المستخدم هو من قفل السجل
    IF NOT EXISTS (
        SELECT 1 FROM public.collection_records 
        WHERE id = record_id AND locked_by = user_id
    ) THEN
        RETURN false;
    END IF;
    
    -- إلغاء القفل
    UPDATE public.collection_records 
    SET 
        locked_by = NULL,
        locked_at = NULL,
        lock_expires_at = NULL
    WHERE id = record_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- دالة للتحقق من حالة القفل
CREATE OR REPLACE FUNCTION is_record_locked(record_id UUID)
RETURNS boolean AS $$
DECLARE
    lock_expires TIMESTAMP WITH TIME ZONE;
BEGIN
    -- تنظيف الأقفال المنتهية الصلاحية
    PERFORM cleanup_expired_locks();
    
    -- التحقق من وجود قفل فعال
    SELECT lock_expires_at INTO lock_expires
    FROM public.collection_records 
    WHERE id = record_id AND locked_by IS NOT NULL;
    
    RETURN lock_expires IS NOT NULL AND lock_expires > NOW();
END;
$$ LANGUAGE plpgsql;

-- دالة لتنظيف الأقفال المنتهية الصلاحية
CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS void AS $$
BEGIN
    UPDATE public.collection_records 
    SET 
        locked_by = NULL,
        locked_at = NULL,
        lock_expires_at = NULL
    WHERE lock_expires_at IS NOT NULL AND lock_expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- دالة للحصول على إحصائيات المستخدم
CREATE OR REPLACE FUNCTION get_user_stats(user_id UUID)
RETURNS TABLE (
    total_records BIGINT,
    pending_records BIGINT,
    completed_records BIGINT,
    refused_records BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_records,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_records,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_records,
        COUNT(*) FILTER (WHERE status = 'refused') as refused_records
    FROM public.collection_records
    WHERE field_agent_id = user_id;
END;
$$ LANGUAGE plpgsql;

-- دالة للحصول على إحصائيات النظام
CREATE OR REPLACE FUNCTION get_collection_stats()
RETURNS TABLE (
    total_records BIGINT,
    pending_records BIGINT,
    completed_records BIGINT,
    refused_records BIGINT,
    verified_records BIGINT,
    unverified_records BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_records,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_records,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_records,
        COUNT(*) FILTER (WHERE status = 'refused') as refused_records,
        COUNT(*) FILTER (WHERE verification_status = 'مدقق') as verified_records,
        COUNT(*) FILTER (WHERE verification_status = 'غير مدقق') as unverified_records
    FROM public.collection_records;
END;
$$ LANGUAGE plpgsql;

-- دالة للحصول على إحصائيات النظام الشاملة
CREATE OR REPLACE FUNCTION get_system_stats()
RETURNS TABLE (
    total_users BIGINT,
    active_users BIGINT,
    total_records BIGINT,
    pending_records BIGINT,
    completed_records BIGINT,
    refused_records BIGINT,
    verified_records BIGINT,
    unverified_records BIGINT,
    locked_records BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM public.users) as total_users,
        (SELECT COUNT(*) FROM public.users WHERE is_active = true) as active_users,
        (SELECT COUNT(*) FROM public.collection_records) as total_records,
        (SELECT COUNT(*) FROM public.collection_records WHERE status = 'pending') as pending_records,
        (SELECT COUNT(*) FROM public.collection_records WHERE status = 'completed') as completed_records,
        (SELECT COUNT(*) FROM public.collection_records WHERE status = 'refused') as refused_records,
        (SELECT COUNT(*) FROM public.collection_records WHERE verification_status = 'مدقق') as verified_records,
        (SELECT COUNT(*) FROM public.collection_records WHERE verification_status = 'غير مدقق') as unverified_records,
        (SELECT COUNT(*) FROM public.collection_records WHERE locked_by IS NOT NULL) as locked_records;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. إنشاء Triggers
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
-- 6. إنشاء Views مفيدة
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
    (SELECT COUNT(*) FROM public.collection_records WHERE status = 'refused') as refused_records,
    (SELECT COUNT(*) FROM public.collection_records WHERE verification_status = 'مدقق') as verified_records,
    (SELECT COUNT(*) FROM public.collection_records WHERE verification_status = 'غير مدقق') as unverified_records,
    (SELECT COUNT(*) FROM public.collection_records WHERE locked_by IS NOT NULL) as locked_records;

-- View لنشاط المستخدمين
CREATE VIEW v_user_activity AS
SELECT 
    u.id,
    u.username,
    u.full_name,
    u.role,
    u.is_active,
    COUNT(al.id) as activity_count,
    MAX(al.created_at) as last_activity
FROM public.users u
LEFT JOIN public.activity_logs al ON u.id = al.user_id
GROUP BY u.id, u.username, u.full_name, u.role, u.is_active;

-- View لحالة النسخ الاحتياطي
CREATE VIEW v_backup_status AS
SELECT 
    bi.id,
    bi.backup_name,
    bi.backup_type,
    bi.backup_date,
    bi.total_records,
    bi.total_photos,
    bi.total_users,
    bi.file_size,
    bi.status,
    bi.created_at
FROM public.backup_info bi
ORDER BY bi.backup_date DESC;

-- =====================================================
-- 7. إنشاء Row Level Security (RLS) Policies
-- =====================================================

-- تفعيل RLS على جميع الجداول
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;

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

-- سياسات جدول سجل النشاط
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

CREATE POLICY "backup_logs_select_policy" ON public.backup_logs
    FOR SELECT USING (true);

CREATE POLICY "backup_logs_insert_policy" ON public.backup_logs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "backup_logs_update_policy" ON public.backup_logs
    FOR UPDATE USING (true);

CREATE POLICY "backup_logs_delete_policy" ON public.backup_logs
    FOR DELETE USING (true);

-- =====================================================
-- 8. إنشاء المستخدمين التجريبيين
-- =====================================================

-- إدراج المستخدمين التجريبيين
INSERT INTO public.users (username, password_hash, full_name, role, is_active) VALUES
('admin', hash_password('password123'), 'مدير النظام', 'admin', true),
('field_agent_1', hash_password('password123'), 'محصل ميداني 1', 'field_agent', true),
('field_agent_2', hash_password('password123'), 'محصل ميداني 2', 'field_agent', true),
('employee_1', hash_password('password123'), 'موظف 1', 'employee', true),
('employee_2', hash_password('password123'), 'موظف 2', 'employee', true);

-- =====================================================
-- 9. تفعيل Realtime للجداول المطلوبة
-- =====================================================

-- تفعيل Realtime لجدول السجلات
ALTER PUBLICATION supabase_realtime ADD TABLE public.collection_records;

-- تفعيل Realtime لجدول الصور
ALTER PUBLICATION supabase_realtime ADD TABLE public.record_photos;

-- تفعيل Realtime لجدول سجل النشاط
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;

-- =====================================================
-- 10. إعداد Storage RLS Policies
-- =====================================================

-- Storage RLS Policies
-- Note: Storage RLS policies need to be set up manually in Supabase Dashboard
-- Go to Storage > Settings > Policies and add the following policies:

-- 1. Policy for field agents to upload photos:
-- CREATE POLICY "Field agents can upload photos" ON storage.objects
--     FOR INSERT WITH CHECK (
--         bucket_id = 'photos' AND
--         auth.role() = 'authenticated' AND
--         EXISTS (
--             SELECT 1 FROM users 
--             WHERE id = auth.uid() 
--             AND role IN ('field_agent', 'admin', 'employee')
--             AND is_active = true
--         )
--     );

-- 2. Policy for all authenticated users to view photos:
-- CREATE POLICY "Authenticated users can view photos" ON storage.objects
--     FOR SELECT USING (
--         bucket_id = 'photos' AND
--         auth.role() = 'authenticated' AND
--         EXISTS (
--             SELECT 1 FROM users 
--             WHERE id = auth.uid() 
--             AND is_active = true
--         )
--     );

-- 3. Policy for admins to manage photos:
-- CREATE POLICY "Admins can manage photos" ON storage.objects
--     FOR ALL USING (
--         bucket_id = 'photos' AND
--         auth.role() = 'authenticated' AND
--         EXISTS (
--             SELECT 1 FROM users 
--             WHERE id = auth.uid() 
--             AND role = 'admin'
--             AND is_active = true
--         )
--     );

-- Alternative: Create a simple public bucket policy
-- This allows all authenticated users to upload and view photos
-- You can restrict this further in the application code

-- =====================================================
-- 11. رسالة النجاح النهائية
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'E-Jibaya Final Complete System Migration completed successfully!';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Database structure created with all required tables, indexes, functions, and policies.';
    RAISE NOTICE '';
    RAISE NOTICE 'System Features (100% Used):';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE '✅ Enhanced Record Locking System';
    RAISE NOTICE '✅ Photo Verification System';
    RAISE NOTICE '✅ Real-time Updates';
    RAISE NOTICE '✅ Local Lock Status Updates';
    RAISE NOTICE '✅ Enhanced Filtering System';
    RAISE NOTICE '✅ Improved User Experience';
    RAISE NOTICE '✅ Background Refresh Optimization';
    RAISE NOTICE '✅ Silent Lock Updates';
    RAISE NOTICE '✅ Preserved Filter States';
    RAISE NOTICE '✅ Complete System Match - No Unused Fields';
    RAISE NOTICE '';
    RAISE NOTICE 'IMPORTANT: Storage RLS Policies Setup Required!';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'To complete the setup, you need to manually configure Storage policies:';
    RAISE NOTICE '1. Go to Supabase Dashboard > Storage > Settings > Policies';
    RAISE NOTICE '2. Create a new policy for the "photos" bucket:';
    RAISE NOTICE '   - Policy name: Allow authenticated users to upload photos';
    RAISE NOTICE '   - Target roles: authenticated';
    RAISE NOTICE '   - Operation: INSERT';
    RAISE NOTICE '   - Policy definition: bucket_id = photos';
    RAISE NOTICE '3. Create another policy for viewing photos:';
    RAISE NOTICE '   - Policy name: Allow authenticated users to view photos';
    RAISE NOTICE '   - Target roles: authenticated';
    RAISE NOTICE '   - Operation: SELECT';
    RAISE NOTICE '   - Policy definition: bucket_id = photos';
    RAISE NOTICE '';
    RAISE NOTICE 'Test users created:';
    RAISE NOTICE '  - admin (password: password123)';
    RAISE NOTICE '  - field_agent_1 (password: password123)';
    RAISE NOTICE '  - field_agent_2 (password: password123)';
    RAISE NOTICE '  - employee_1 (password: password123)';
    RAISE NOTICE '  - employee_2 (password: password123)';
    RAISE NOTICE '';
    RAISE NOTICE 'All passwords are hashed with bcrypt (saltRounds = 12) and ready for login!';
    RAISE NOTICE 'You can now login to the system with any of these users.';
    RAISE NOTICE '';
    RAISE NOTICE 'System Features:';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE '🔒 Advanced Record Locking System';
    RAISE NOTICE '📸 Photo Verification & Comparison';
    RAISE NOTICE '🔄 Real-time Updates';
    RAISE NOTICE '📊 Comprehensive Reporting';
    RAISE NOTICE '👥 User Management';
    RAISE NOTICE '💾 Backup System';
    RAISE NOTICE '📱 Mobile Responsive';
    RAISE NOTICE '🎯 Enhanced UX';
    RAISE NOTICE '=====================================================';
END $$;
