-- كود بسيط لتحديث قيود الأصناف ونوع المقياس
-- فقط انسخ والصق في Supabase SQL Editor

-- 1. تحديث قيد الصنف (category) - حذف 'انارة' و 'محولة خاصة'
ALTER TABLE public.collection_records 
DROP CONSTRAINT IF EXISTS collection_records_category_check;

ALTER TABLE public.collection_records
ADD CONSTRAINT collection_records_category_check 
CHECK (category IS NULL OR category IN ('منزلي', 'تجاري', 'صناعي', 'زراعي', 'حكومي'));

-- 2. تحديث قيد نوع المقياس (phase) - إضافة 'المحولة الخاصة'
ALTER TABLE public.collection_records 
DROP CONSTRAINT IF EXISTS collection_records_phase_check;

ALTER TABLE public.collection_records
ADD CONSTRAINT collection_records_phase_check 
CHECK (phase IS NULL OR phase IN ('احادي', 'ثلاثي', 'سي تي', 'المحولة الخاصة'));

-- 3. تحديث السجلات الموجودة: تعيين category إلى NULL للسجلات التي تحتوي على 'انارة' أو 'محولة خاصة'
UPDATE public.collection_records 
SET category = NULL 
WHERE category IN ('انارة', 'محولة خاصة');

