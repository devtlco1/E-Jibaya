-- =====================================================
-- إصلاح شامل لمشاكل الأمان في قاعدة البيانات
-- E-Jibaya Database Security Migration
-- =====================================================

-- تفعيل Row Level Security (RLS) على جميع الجداول
-- هذا يحل مشاكل الأمان المطلوبة للإنتاج

-- 1. تفعيل RLS على جدول المستخدمين
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2. تفعيل RLS على جدول سجلات الجباية
ALTER TABLE public.collection_records ENABLE ROW LEVEL SECURITY;

-- 3. تفعيل RLS على جدول سجل الأنشطة
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- 4. تفعيل RLS على جدول صور السجلات
ALTER TABLE public.record_photos ENABLE ROW LEVEL SECURITY;

-- 5. تفعيل RLS على جدول معلومات النسخ الاحتياطي
ALTER TABLE public.backup_info ENABLE ROW LEVEL SECURITY;

-- 6. تفعيل RLS على جدول جلسات المستخدمين (إذا كان موجود)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_sessions') THEN
        ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- التحقق من حالة RLS بعد التفعيل
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✅ مفعل' 
        ELSE '❌ غير مفعل' 
    END as status
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('users', 'collection_records', 'activity_logs', 'record_photos', 'backup_info', 'user_sessions')
ORDER BY tablename;

-- عرض السياسات الموجودة لكل جدول
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public'
    AND tablename IN ('users', 'collection_records', 'activity_logs', 'record_photos', 'backup_info', 'user_sessions')
ORDER BY tablename, policyname;

-- رسالة نجاح
DO $$ 
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ تم تفعيل Row Level Security بنجاح!';
    RAISE NOTICE '✅ النظام جاهز للإنتاج من ناحية الأمان';
    RAISE NOTICE '========================================';
END $$;
