-- =====================================================
-- إصلاح مشكلة activity_logs
-- E-Jibaya - Fix Activity Logs RLS Issue
-- =====================================================

-- المشكلة: تسجيل الدخول يعمل لكن activity_logs لا يمكن إنشاء سجلات جديدة
-- الحل: إصلاح سياسات activity_logs للسماح بإنشاء سجلات جديدة

-- 1. حذف السياسات الموجودة لـ activity_logs
DROP POLICY IF EXISTS "Allow authenticated users to create activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Allow authenticated users to read activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Allow authenticated users to update activity logs" ON public.activity_logs;

-- 2. إعادة إنشاء السياسات مع الصيغة الصحيحة
CREATE POLICY "Allow authenticated users to create activity logs" ON public.activity_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read activity logs" ON public.activity_logs
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to update activity logs" ON public.activity_logs
    FOR UPDATE
    TO authenticated
    USING (true);

-- 3. إضافة سياسة للوصول العام (للمستخدمين غير المصادقين إذا لزم الأمر)
CREATE POLICY "Allow anon to create activity logs" ON public.activity_logs
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- 4. التحقق من السياسات
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
    AND tablename = 'activity_logs'
ORDER BY policyname;

-- 5. اختبار إنشاء سجل نشاط
INSERT INTO public.activity_logs (user_id, action, target_type, target_name, details)
VALUES (
    'ba7a2d56-daa7-44d5-9b90-80a9843be1c1',
    'test_login',
    'system',
    'النظام',
    '{"test": true}'::jsonb
);

-- 6. حذف السجل التجريبي
DELETE FROM public.activity_logs WHERE action = 'test_login';

-- رسالة النجاح
SELECT '🎉 تم إصلاح مشكلة activity_logs! يمكن الآن إنشاء سجلات الأنشطة.' as result;
