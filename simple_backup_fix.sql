-- =====================================================
-- إصلاح بسيط جداً لجدول backup_info
-- E-Jibaya - Simple Backup Fix
-- =====================================================

-- 1. حذف الجدول إذا كان موجود
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

-- 4. سياسة بسيطة جداً - السماح بكل شيء
CREATE POLICY "backup_info_all_access" ON public.backup_info
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 5. اختبار بسيط
INSERT INTO public.backup_info (backup_name, backup_type, file_name) 
VALUES ('Test', 'manual', 'test.zip');

-- 6. حذف الاختبار
DELETE FROM public.backup_info WHERE backup_name = 'Test';

SELECT '✅ تم إصلاح جدول backup_info بنجاح!' as result;
