-- =====================================================
-- إصلاح مشكلة تسجيل الدخول
-- E-Jibaya - Fix Login Issue with RLS
-- =====================================================

-- المشكلة: RLS مفعل لكن السياسات تمنع الوصول للمستخدمين
-- الحل: إضافة سياسة تسمح بالوصول للمستخدمين للمصادقة

-- 1. إضافة سياسة للوصول إلى بيانات المستخدمين للمصادقة
CREATE POLICY "Allow login access to users" ON public.users
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- 2. إضافة سياسة للوصول إلى بيانات المستخدمين للمصادقة (للمستخدمين المصادقين)
CREATE POLICY "Authenticated users can read users for login" ON public.users
    FOR SELECT
    TO authenticated
    USING (true);

-- 3. التحقق من السياسات الموجودة
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
    AND tablename = 'users'
ORDER BY policyname;

-- 4. اختبار الوصول
SELECT 
    'Users Table Access Test' as test_name,
    COUNT(*) as user_count
FROM public.users;

-- رسالة النجاح
SELECT '🎉 تم إصلاح مشكلة تسجيل الدخول! يمكنك الآن تسجيل الدخول.' as result;
