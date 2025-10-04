-- =====================================================
-- إصلاح جميع سياسات RLS للسماح بالوصول الكامل
-- =====================================================

-- إصلاح سياسات جدول activity_logs
DROP POLICY IF EXISTS "activity_logs_select_policy" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs_insert_policy" ON public.activity_logs;

CREATE POLICY "activity_logs_select_policy" ON public.activity_logs
    FOR SELECT 
    TO anon, authenticated
    USING (true);

CREATE POLICY "activity_logs_insert_policy" ON public.activity_logs
    FOR INSERT 
    TO anon, authenticated
    WITH CHECK (true);

-- إصلاح سياسات جدول collection_records
DROP POLICY IF EXISTS "collection_records_select_policy" ON public.collection_records;
DROP POLICY IF EXISTS "collection_records_insert_policy" ON public.collection_records;
DROP POLICY IF EXISTS "collection_records_update_policy" ON public.collection_records;
DROP POLICY IF EXISTS "collection_records_delete_policy" ON public.collection_records;

CREATE POLICY "collection_records_select_policy" ON public.collection_records
    FOR SELECT 
    TO anon, authenticated
    USING (true);

CREATE POLICY "collection_records_insert_policy" ON public.collection_records
    FOR INSERT 
    TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "collection_records_update_policy" ON public.collection_records
    FOR UPDATE 
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "collection_records_delete_policy" ON public.collection_records
    FOR DELETE 
    TO anon, authenticated
    USING (true);

-- إصلاح سياسات جدول record_photos
DROP POLICY IF EXISTS "record_photos_select_policy" ON public.record_photos;
DROP POLICY IF EXISTS "record_photos_insert_policy" ON public.record_photos;
DROP POLICY IF EXISTS "record_photos_delete_policy" ON public.record_photos;

CREATE POLICY "record_photos_select_policy" ON public.record_photos
    FOR SELECT 
    TO anon, authenticated
    USING (true);

CREATE POLICY "record_photos_insert_policy" ON public.record_photos
    FOR INSERT 
    TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "record_photos_delete_policy" ON public.record_photos
    FOR DELETE 
    TO anon, authenticated
    USING (true);

-- إصلاح سياسات جدول backup_info
DROP POLICY IF EXISTS "backup_info_all_access" ON public.backup_info;

CREATE POLICY "backup_info_all_access" ON public.backup_info
    FOR ALL 
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- إصلاح سياسات جدول user_sessions
DROP POLICY IF EXISTS "user_sessions_select_policy" ON public.user_sessions;
DROP POLICY IF EXISTS "user_sessions_insert_policy" ON public.user_sessions;
DROP POLICY IF EXISTS "user_sessions_delete_policy" ON public.user_sessions;

CREATE POLICY "user_sessions_select_policy" ON public.user_sessions
    FOR SELECT 
    TO anon, authenticated
    USING (true);

CREATE POLICY "user_sessions_insert_policy" ON public.user_sessions
    FOR INSERT 
    TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "user_sessions_delete_policy" ON public.user_sessions
    FOR DELETE 
    TO anon, authenticated
    USING (true);

-- التحقق من النتائج
SELECT '✅ تم إصلاح جميع سياسات RLS!' as result;

-- اختبار الوصول للجداول
SELECT 'users' as table_name, COUNT(*) as count FROM public.users
UNION ALL
SELECT 'activity_logs' as table_name, COUNT(*) as count FROM public.activity_logs
UNION ALL
SELECT 'collection_records' as table_name, COUNT(*) as count FROM public.collection_records
UNION ALL
SELECT 'record_photos' as table_name, COUNT(*) as count FROM public.record_photos
UNION ALL
SELECT 'backup_info' as table_name, COUNT(*) as count FROM public.backup_info
UNION ALL
SELECT 'user_sessions' as table_name, COUNT(*) as count FROM public.user_sessions;
