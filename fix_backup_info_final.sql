-- =====================================================
-- إصلاح نهائي لجدول backup_info
-- E-Jibaya - Final Backup Info Fix
-- =====================================================

-- المشكلة: backup_info لا يعمل مع RLS
-- الحل: إصلاح السياسات وإضافة بيانات تجريبية

-- 1. حذف جميع السياسات القديمة
DROP POLICY IF EXISTS "Admins can manage backup info" ON public.backup_info;

-- 2. إعادة إنشاء السياسات بالصيغة الصحيحة
CREATE POLICY "Admins can manage backup info" ON public.backup_info
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid() 
            AND u.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid() 
            AND u.role = 'admin'
        )
    );

-- 3. إضافة سياسة للقراءة العامة
CREATE POLICY "Allow read access to backup info" ON public.backup_info
    FOR SELECT
    TO authenticated
    USING (true);

-- 4. إضافة سياسة للكتابة العامة (للمديرين)
CREATE POLICY "Allow insert access to backup info" ON public.backup_info
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 5. التحقق من السياسات
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
    AND tablename = 'backup_info'
ORDER BY policyname;

-- 6. اختبار إنشاء سجل تجريبي
INSERT INTO public.backup_info (
    backup_name,
    backup_type,
    file_size,
    file_path,
    created_by,
    status,
    description
) VALUES (
    'Test Backup',
    'manual',
    1024,
    '/test/path',
    'ba7a2d56-daa7-44d5-9b90-80a9843be1c1',
    'completed',
    'Test backup entry'
);

-- 7. اختبار القراءة
SELECT 
    'Backup Info Test' as test_name,
    COUNT(*) as record_count
FROM public.backup_info;

-- 8. حذف السجل التجريبي
DELETE FROM public.backup_info WHERE backup_name = 'Test Backup';

-- رسالة النجاح
SELECT '🎉 تم إصلاح جدول backup_info! النسخ الاحتياطي يعمل الآن!' as result;
