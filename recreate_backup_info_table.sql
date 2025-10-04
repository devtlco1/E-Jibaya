-- =====================================================
-- إعادة إنشاء جدول backup_info بالكامل
-- E-Jibaya - Recreate Backup Info Table
-- =====================================================

-- 1. حذف الجدول إذا كان موجوداً
DROP TABLE IF EXISTS public.backup_info CASCADE;

-- 2. إنشاء الجدول من جديد
CREATE TABLE public.backup_info (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    backup_name VARCHAR(255) NOT NULL,
    backup_type VARCHAR(50) NOT NULL DEFAULT 'manual',
    file_size BIGINT,
    file_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id),
    status VARCHAR(50) DEFAULT 'completed',
    description TEXT,
    backup_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. تفعيل RLS
ALTER TABLE public.backup_info ENABLE ROW LEVEL SECURITY;

-- 4. إنشاء السياسات
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

-- 5. اختبار إنشاء سجل تجريبي
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

-- 6. اختبار القراءة
SELECT 
    'Backup Info Test' as test_name,
    COUNT(*) as record_count
FROM public.backup_info;

-- 7. حذف السجل التجريبي
DELETE FROM public.backup_info WHERE backup_name = 'Test Backup';

-- 8. التحقق من الهيكل النهائي
SELECT 
    'Final Structure' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'backup_info'
ORDER BY ordinal_position;

-- رسالة النجاح
SELECT '🎉 تم إعادة إنشاء جدول backup_info بنجاح! النسخ الاحتياطي يعمل الآن!' as result;
