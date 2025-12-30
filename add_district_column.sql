-- إضافة عمود المقاطعة (district) إلى جدول collection_records
ALTER TABLE public.collection_records 
ADD COLUMN IF NOT EXISTS district VARCHAR(255);

-- إضافة تعليق على العمود
COMMENT ON COLUMN public.collection_records.district IS 'المقاطعة';

