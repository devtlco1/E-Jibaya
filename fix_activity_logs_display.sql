-- =====================================================
-- إصلاح مشكلة عرض سجلات الأنشطة
-- E-Jibaya - Fix Activity Logs Display Issue
-- =====================================================

-- المشكلة: سجلات الأنشطة تُنشأ بنجاح لكن لا تظهر في العرض
-- الحل: إصلاح سياسات القراءة لـ activity_logs

-- 1. التحقق من السجلات الموجودة
SELECT 
    'Current Activity Logs' as info,
    COUNT(*) as total_count
FROM public.activity_logs;

-- 2. عرض السجلات الموجودة
SELECT 
    id,
    user_id,
    action,
    target_type,
    target_name,
    created_at
FROM public.activity_logs
ORDER BY created_at DESC
LIMIT 10;

-- 3. حذف السياسات القديمة وإعادة إنشائها
DROP POLICY IF EXISTS "Allow authenticated users to read activity logs" ON public.activity_logs;

-- 4. إعادة إنشاء سياسة القراءة مع الصيغة الصحيحة
CREATE POLICY "Allow authenticated users to read activity logs" ON public.activity_logs
    FOR SELECT
    TO authenticated
    USING (true);

-- 5. إضافة سياسة للقراءة العامة (للمستخدمين غير المصادقين إذا لزم الأمر)
CREATE POLICY "Allow anon to read activity logs" ON public.activity_logs
    FOR SELECT
    TO anon
    USING (true);

-- 6. التحقق من السياسات الجديدة
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public'
    AND tablename = 'activity_logs'
ORDER BY policyname;

-- 7. اختبار القراءة
SELECT 
    'Read Test' as test_name,
    COUNT(*) as readable_count
FROM public.activity_logs;

-- رسالة النجاح
SELECT '🎉 تم إصلاح مشكلة عرض سجلات الأنشطة!' as result;
