-- إضافة حقول قفل مقارنة الصور - نسخة مبسطة
-- قم بتشغيل هذا الكود في Supabase SQL Editor

-- إضافة الحقول الجديدة
ALTER TABLE collection_records 
ADD COLUMN IF NOT EXISTS photo_viewing_by UUID REFERENCES public.users(id),
ADD COLUMN IF NOT EXISTS photo_viewing_at TIMESTAMP WITH TIME ZONE;

-- التحقق من إضافة الحقول
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'collection_records' 
AND column_name IN ('photo_viewing_by', 'photo_viewing_at')
ORDER BY column_name;

-- التحقق من Realtime
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'collection_records'
        ) 
        THEN '✅ Realtime enabled for collection_records'
        ELSE '❌ Realtime NOT enabled - Run: ALTER PUBLICATION supabase_realtime ADD TABLE collection_records;'
    END as realtime_status;
