-- =====================================================
-- إصلاح قيود جدول backup_info
-- E-Jibaya - Fix Backup Info Constraints
-- =====================================================

-- المشكلة: عمود backup_date مطلوب (NOT NULL) لكن لم نضعه في الاستعلام
-- الحل: إضافة backup_date أو جعله اختيارياً

-- 1. التحقق من هيكل الجدول الحالي
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'backup_info'
ORDER BY ordinal_position;

-- 2. إصلاح قيد backup_date
-- جعل العمود اختيارياً أو إضافة قيمة افتراضية
ALTER TABLE public.backup_info ALTER COLUMN backup_date DROP NOT NULL;

-- أو إضافة قيمة افتراضية
ALTER TABLE public.backup_info ALTER COLUMN backup_date SET DEFAULT NOW();

-- 3. إصلاح السياسات
DROP POLICY IF EXISTS "Admins can manage backup info" ON public.backup_info;
DROP POLICY IF EXISTS "Allow read access to backup info" ON public.backup_info;
DROP POLICY IF EXISTS "Allow insert access to backup info" ON public.backup_info;

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
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid() 
            AND u.role = 'admin'
        )
    );

CREATE POLICY "Allow read access to backup info" ON public.backup_info
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow insert access to backup info" ON public.backup_info
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 4. اختبار إنشاء سجل تجريبي مع backup_date
INSERT INTO public.backup_info (
    backup_name,
    backup_type,
    file_size,
    file_path,
    created_by,
    status,
    description,
    backup_date
) VALUES (
    'Test Backup',
    'manual',
    1024,
    '/test/path',
    'ba7a2d56-daa7-44d5-9b90-80a9843be1c1',
    'completed',
    'Test backup entry',
    NOW()
);

-- 5. اختبار القراءة
SELECT 
    'Backup Info Test' as test_name,
    COUNT(*) as record_count
FROM public.backup_info;

-- 6. حذف السجل التجريبي
DELETE FROM public.backup_info WHERE backup_name = 'Test Backup';

-- 7. اختبار إنشاء سجل بدون backup_date (يجب أن يعمل الآن)
INSERT INTO public.backup_info (
    backup_name,
    backup_type,
    file_size,
    file_path,
    created_by,
    status,
    description
) VALUES (
    'Test Backup 2',
    'manual',
    2048,
    '/test/path2',
    'ba7a2d56-daa7-44d5-9b90-80a9843be1c1',
    'completed',
    'Test backup entry 2'
);

-- 8. حذف السجل التجريبي الثاني
DELETE FROM public.backup_info WHERE backup_name = 'Test Backup 2';

-- رسالة النجاح
SELECT '🎉 تم إصلاح قيود جدول backup_info! النسخ الاحتياطي يعمل الآن!' as result;
