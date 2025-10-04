-- =====================================================
-- إصلاح سريع لمشاكل النسخ الاحتياطي
-- E-Jibaya - Quick Backup Fix
-- =====================================================

-- 1. حذف الجدول القديم وإعادة إنشاؤه
DROP TABLE IF EXISTS public.backup_info CASCADE;

-- 2. إنشاء الجدول الجديد
CREATE TABLE public.backup_info (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    backup_name VARCHAR(255) NOT NULL,
    backup_type VARCHAR(50) NOT NULL DEFAULT 'manual',
    file_name VARCHAR(255),
    file_size BIGINT,
    file_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id),
    status VARCHAR(50) DEFAULT 'completed',
    description TEXT,
    backup_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_records INTEGER DEFAULT 0,
    total_photos INTEGER DEFAULT 0,
    total_users INTEGER DEFAULT 0
);

-- 3. تفعيل RLS
ALTER TABLE public.backup_info ENABLE ROW LEVEL SECURITY;

-- 4. إنشاء سياسات بسيطة
CREATE POLICY "Allow all operations on backup_info" ON public.backup_info
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 5. اختبار
INSERT INTO public.backup_info (
    backup_name,
    backup_type,
    file_name,
    total_records,
    total_photos,
    total_users
) VALUES (
    'Test Backup',
    'manual',
    'test.zip',
    10,
    5,
    3
);

-- 6. حذف الاختبار
DELETE FROM public.backup_info WHERE backup_name = 'Test Backup';

SELECT '✅ تم إصلاح جدول backup_info بنجاح!' as result;
