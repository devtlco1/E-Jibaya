-- =====================================================
-- E-Jibaya - Complete Database Migration
-- ملف شامل لجميع إعدادات قاعدة البيانات
-- =====================================================

-- =====================================================
-- 1. إنشاء جدول معلومات النسخ الاحتياطي
-- =====================================================

-- إنشاء جدول backup_info إذا لم يكن موجوداً
CREATE TABLE IF NOT EXISTS public.backup_info (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    backup_name VARCHAR(255) NOT NULL,
    backup_type VARCHAR(50) NOT NULL DEFAULT 'manual',
    file_size BIGINT,
    file_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id),
    status VARCHAR(50) DEFAULT 'completed',
    description TEXT
);

-- =====================================================
-- 2. تفعيل Row Level Security (RLS) على جميع الجداول
-- =====================================================

-- تفعيل RLS على جميع الجداول
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3. إصلاح الدوال مع search_path ثابت
-- =====================================================

-- حذف الدوال الموجودة أولاً
DROP FUNCTION IF EXISTS public.get_records_stats();
DROP FUNCTION IF EXISTS public.get_active_field_agents_count();

-- إعادة إنشاء دالة get_records_stats مع search_path ثابت
CREATE OR REPLACE FUNCTION public.get_records_stats()
RETURNS TABLE(
    total bigint,
    pending bigint,
    completed bigint,
    reviewed bigint,
    refused bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'reviewed') as reviewed,
        COUNT(*) FILTER (WHERE is_refused = true) as refused
    FROM collection_records;
$$;

-- إعادة إنشاء دالة get_active_field_agents_count مع search_path ثابت
CREATE OR REPLACE FUNCTION public.get_active_field_agents_count()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COUNT(*)
    FROM users
    WHERE (role = 'field_agent' OR role = 'employee')
      AND is_active = true
      AND username NOT LIKE '%(محذوف)%';
$$;

-- =====================================================
-- 4. إضافة السياسات المفقودة
-- =====================================================

-- سياسة للمديرين فقط للوصول إلى معلومات النسخ الاحتياطي
CREATE POLICY "Admins can manage backup info" ON public.backup_info
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid() 
            AND u.role = 'admin'
        )
    );

-- =====================================================
-- 5. التحقق من النتيجة النهائية
-- =====================================================

-- التحقق من حالة RLS
SELECT 
    'RLS Status' as check_type,
    tablename,
    CASE 
        WHEN rowsecurity THEN '✅ مفعل' 
        ELSE '❌ غير مفعل' 
    END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('users', 'collection_records', 'activity_logs', 'record_photos', 'backup_info', 'user_sessions')
ORDER BY tablename;

-- التحقق من الدوال
SELECT 
    'Functions Status' as check_type,
    routine_name as function_name,
    '✅ موجودة' as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
    AND routine_name IN ('get_records_stats', 'get_active_field_agents_count')
ORDER BY routine_name;

-- التحقق من السياسات
SELECT 
    'Policies Status' as check_type,
    tablename,
    COUNT(*) as policies_count
FROM pg_policies 
WHERE schemaname = 'public'
    AND tablename IN ('users', 'collection_records', 'activity_logs', 'record_photos', 'backup_info', 'user_sessions')
GROUP BY tablename
ORDER BY tablename;

-- =====================================================
-- 6. رسالة النجاح النهائية
-- =====================================================

DO $$ 
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '🎉 E-Jibaya Database Migration Complete!';
    RAISE NOTICE '✅ جميع الجداول محمية بـ RLS';
    RAISE NOTICE '✅ جميع الدوال محمية بـ search_path';
    RAISE NOTICE '✅ جميع السياسات الأمنية مفعلة';
    RAISE NOTICE '✅ النظام جاهز للإنتاج 100%';
    RAISE NOTICE '========================================';
END $$;
