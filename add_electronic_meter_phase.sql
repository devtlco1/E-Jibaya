-- إضافة 'مقياس الكتروني' إلى نوع المقياس (phase)
-- فقط انسخ والصق في Supabase SQL Editor

-- 1. حذف القيد القديم
ALTER TABLE public.collection_records 
DROP CONSTRAINT IF EXISTS collection_records_phase_check;

-- 2. إضافة القيد الجديد مع 'مقياس الكتروني'
ALTER TABLE public.collection_records
ADD CONSTRAINT collection_records_phase_check 
CHECK (phase IS NULL OR phase IN ('احادي', 'ثلاثي', 'سي تي', 'المحولة الخاصة', 'مقياس الكتروني'));

-- 3. التحقق من القيد
DO $$
BEGIN
    RAISE NOTICE '✓ تم تحديث قيد نوع المقياس (phase) بنجاح - تم إضافة "مقياس الكتروني"';
END $$;

