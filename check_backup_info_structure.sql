-- =====================================================
-- التحقق من هيكل جدول backup_info
-- E-Jibaya - Check Backup Info Table Structure
-- =====================================================

-- 1. التحقق من وجود الجدول
SELECT 
    'Table Exists' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'backup_info'
        ) THEN '✅ موجود'
        ELSE '❌ غير موجود'
    END as result;

-- 2. التحقق من هيكل الجدول
SELECT 
    'Column Structure' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'backup_info'
ORDER BY ordinal_position;

-- 3. التحقق من عدد الأعمدة
SELECT 
    'Column Count' as check_type,
    COUNT(*) as total_columns
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'backup_info';

-- 4. التحقق من السياسات
SELECT 
    'Policies' as check_type,
    policyname,
    cmd,
    roles
FROM pg_policies 
WHERE schemaname = 'public'
    AND tablename = 'backup_info';

-- 5. التحقق من RLS
SELECT 
    'RLS Status' as check_type,
    CASE 
        WHEN rowsecurity THEN '✅ مفعل'
        ELSE '❌ غير مفعل'
    END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename = 'backup_info';
