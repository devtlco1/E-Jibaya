-- =====================================================
-- إصلاح سياسات RLS للسماح بالوصول للمستخدمين
-- =====================================================

-- حذف السياسات الحالية
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
DROP POLICY IF EXISTS "users_update_policy" ON public.users;
DROP POLICY IF EXISTS "users_delete_policy" ON public.users;

-- إنشاء سياسات جديدة تسمح بالوصول للمستخدمين غير المعتمدين
CREATE POLICY "users_select_policy" ON public.users
    FOR SELECT 
    TO anon, authenticated
    USING (true);

CREATE POLICY "users_insert_policy" ON public.users
    FOR INSERT 
    TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "users_update_policy" ON public.users
    FOR UPDATE 
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "users_delete_policy" ON public.users
    FOR DELETE 
    TO anon, authenticated
    USING (true);

-- التحقق من النتائج
SELECT '✅ تم إصلاح سياسات RLS للمستخدمين!' as result;

-- اختبار الوصول
SELECT COUNT(*) as total_users FROM public.users;
