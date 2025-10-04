-- =====================================================
-- إعادة تعيين النظام بالكامل - E-Jibaya Complete Reset
-- =====================================================

-- 1. حذف جميع البيانات عدا المستخدم الإدمن
DELETE FROM public.activity_logs WHERE user_id != 'ba7a2d56-daa7-44d5-9b90-80a9843be1c1';
DELETE FROM public.collection_records;
DELETE FROM public.record_photos;
DELETE FROM public.user_sessions WHERE user_id != 'ba7a2d56-daa7-44d5-9b90-80a9843be1c1';

-- 2. حذف جدول backup_info وإعادة إنشاؤه
DROP TABLE IF EXISTS public.backup_info CASCADE;

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

-- 3. تفعيل RLS على backup_info
ALTER TABLE public.backup_info ENABLE ROW LEVEL SECURITY;

-- 4. سياسة بسيطة للنسخ الاحتياطي
CREATE POLICY "backup_info_all_access" ON public.backup_info
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 5. إعادة تعيين sequences
ALTER SEQUENCE IF EXISTS collection_records_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS activity_logs_id_seq RESTART WITH 1;

-- 6. تنظيف التخزين المؤقت
-- (سيتم تنظيفه من الكود)

SELECT '✅ تم إعادة تعيين النظام بالكامل!' as result;
