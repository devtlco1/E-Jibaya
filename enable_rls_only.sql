-- =====================================================
-- تفعيل Row Level Security (RLS) فقط
-- E-Jibaya - Enable RLS for Production
-- =====================================================

-- تفعيل RLS على جميع الجداول (السياسات موجودة بالفعل)

-- 1. جدول المستخدمين
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2. جدول سجلات الجباية
ALTER TABLE public.collection_records ENABLE ROW LEVEL SECURITY;

-- 3. جدول سجل الأنشطة
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- 4. جدول صور السجلات
ALTER TABLE public.record_photos ENABLE ROW LEVEL SECURITY;

-- 5. جدول معلومات النسخ الاحتياطي
ALTER TABLE public.backup_info ENABLE ROW LEVEL SECURITY;

-- 6. جدول جلسات المستخدمين
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- التحقق من النتيجة
SELECT 
    tablename,
    CASE 
        WHEN rowsecurity THEN '✅ RLS مفعل' 
        ELSE '❌ RLS غير مفعل' 
    END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('users', 'collection_records', 'activity_logs', 'record_photos', 'backup_info', 'user_sessions')
ORDER BY tablename;

-- رسالة النجاح
SELECT '🎉 تم تفعيل RLS بنجاح! النظام جاهز للإنتاج!' as result;
