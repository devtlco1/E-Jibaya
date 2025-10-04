-- =====================================================
-- إصلاح شامل لجميع السياسات
-- E-Jibaya - Complete Policy Fix
-- =====================================================

-- إصلاح جميع السياسات لضمان عمل النظام بالكامل

-- =====================================================
-- 1. إصلاح سياسات users
-- =====================================================

-- حذف السياسات القديمة
DROP POLICY IF EXISTS "Allow login access to users" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can read users for login" ON public.users;
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Users can read their own data" ON public.users;

-- إعادة إنشاء السياسات
CREATE POLICY "Allow login access to users" ON public.users
    FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Admins can manage users" ON public.users
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
-- 2. إصلاح سياسات collection_records
-- =====================================================

-- حذف السياسات القديمة
DROP POLICY IF EXISTS "Admins and employees can read all records" ON public.collection_records;
DROP POLICY IF EXISTS "Admins and employees can update all records" ON public.collection_records;
DROP POLICY IF EXISTS "Admins can delete records" ON public.collection_records;
DROP POLICY IF EXISTS "Anon can create records (local)" ON public.collection_records;
DROP POLICY IF EXISTS "Anon can read records (local)" ON public.collection_records;
DROP POLICY IF EXISTS "Anon can update records (local)" ON public.collection_records;
DROP POLICY IF EXISTS "Field agents can create records" ON public.collection_records;
DROP POLICY IF EXISTS "Field agents can read their own records" ON public.collection_records;

-- إعادة إنشاء السياسات
CREATE POLICY "Admins and employees can read all records" ON public.collection_records
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'employee')
        )
    );

CREATE POLICY "Admins and employees can update all records" ON public.collection_records
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'employee')
        )
    );

CREATE POLICY "Admins can delete records" ON public.collection_records
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid() 
            AND u.role = 'admin'
        )
    );

CREATE POLICY "Field agents can create records" ON public.collection_records
    FOR INSERT
    TO authenticated
    WITH CHECK (
        field_agent_id = auth.uid() 
        AND EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid() 
            AND u.role IN ('field_agent', 'employee')
        )
    );

CREATE POLICY "Field agents can read their own records" ON public.collection_records
    FOR SELECT
    TO authenticated
    USING (
        field_agent_id = auth.uid() 
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'employee')
        )
    );

-- سياسات للمستخدمين غير المصادقين (للموبايل)
CREATE POLICY "Anon can create records (local)" ON public.collection_records
    FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "Anon can read records (local)" ON public.collection_records
    FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "Anon can update records (local)" ON public.collection_records
    FOR UPDATE
    TO anon
    USING (true);

-- =====================================================
-- 3. إصلاح سياسات activity_logs
-- =====================================================

-- حذف السياسات القديمة
DROP POLICY IF EXISTS "Allow authenticated users to create activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Allow authenticated users to read activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Allow authenticated users to update activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Allow anon to create activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Allow anon to read activity logs" ON public.activity_logs;

-- إعادة إنشاء السياسات
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

CREATE POLICY "Allow anon to create activity logs" ON public.activity_logs
    FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "Allow anon to read activity logs" ON public.activity_logs
    FOR SELECT
    TO anon
    USING (true);

-- =====================================================
-- 4. إصلاح سياسات record_photos
-- =====================================================

-- حذف السياسات القديمة
DROP POLICY IF EXISTS "Allow authenticated users to delete photos" ON public.record_photos;
DROP POLICY IF EXISTS "Allow authenticated users to insert photos" ON public.record_photos;
DROP POLICY IF EXISTS "Allow authenticated users to read photos" ON public.record_photos;
DROP POLICY IF EXISTS "Allow authenticated users to update photos" ON public.record_photos;
DROP POLICY IF EXISTS "Anon can add photos (local)" ON public.record_photos;
DROP POLICY IF EXISTS "Anon can read photos (local)" ON public.record_photos;
DROP POLICY IF EXISTS "Anon can update photos (local)" ON public.record_photos;

-- إعادة إنشاء السياسات
CREATE POLICY "Allow authenticated users to insert photos" ON public.record_photos
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read photos" ON public.record_photos
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to update photos" ON public.record_photos
    FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to delete photos" ON public.record_photos
    FOR DELETE
    TO authenticated
    USING (true);

CREATE POLICY "Anon can add photos (local)" ON public.record_photos
    FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "Anon can read photos (local)" ON public.record_photos
    FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "Anon can update photos (local)" ON public.record_photos
    FOR UPDATE
    TO anon
    USING (true);

-- =====================================================
-- 5. إصلاح سياسات backup_info
-- =====================================================

-- حذف السياسات القديمة
DROP POLICY IF EXISTS "Admins can manage backup info" ON public.backup_info;

-- إعادة إنشاء السياسات
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
-- 6. إصلاح سياسات user_sessions
-- =====================================================

-- حذف السياسات القديمة
DROP POLICY IF EXISTS "Users can manage their own sessions" ON public.user_sessions;

-- إعادة إنشاء السياسات
CREATE POLICY "Users can manage their own sessions" ON public.user_sessions
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

-- =====================================================
-- 7. التحقق من جميع السياسات
-- =====================================================

SELECT 
    'Policy Summary' as info,
    tablename,
    COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
    AND tablename IN ('users', 'collection_records', 'activity_logs', 'record_photos', 'backup_info', 'user_sessions')
GROUP BY tablename
ORDER BY tablename;

-- =====================================================
-- 8. اختبار شامل
-- =====================================================

-- اختبار قراءة المستخدمين
SELECT 'Users Read Test' as test, COUNT(*) as count FROM public.users;

-- اختبار قراءة السجلات
SELECT 'Records Read Test' as test, COUNT(*) as count FROM public.collection_records;

-- اختبار قراءة سجلات الأنشطة
SELECT 'Activity Logs Read Test' as test, COUNT(*) as count FROM public.activity_logs;

-- اختبار قراءة الصور
SELECT 'Photos Read Test' as test, COUNT(*) as count FROM public.record_photos;

-- رسالة النجاح
SELECT '🎉 تم إصلاح جميع السياسات! النظام جاهز للعمل بالكامل!' as result;
