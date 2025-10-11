-- تفعيل Real-time لحقول مقارنة الصور
-- قم بتشغيل هذا الكود في Supabase SQL Editor

-- التحقق من حالة Real-time الحالية
SELECT 
    schemaname,
    tablename,
    'Real-time enabled' as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename = 'collection_records';

-- التحقق من وجود الحقول الجديدة
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'collection_records' 
AND column_name IN ('photo_viewing_by', 'photo_viewing_at')
ORDER BY column_name;

-- إضافة الحقول الجديدة إلى Real-time publication
-- (هذا يتم تلقائياً عند إضافة الحقول، لكن للتأكد)
DO $$
BEGIN
    -- التحقق من أن الجدول مفعل للـ real-time
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'collection_records'
    ) THEN
        -- إضافة الجدول إلى real-time publication
        ALTER PUBLICATION supabase_realtime ADD TABLE collection_records;
        RAISE NOTICE '✅ Added collection_records to real-time publication';
    ELSE
        RAISE NOTICE '✅ collection_records is already enabled for real-time';
    END IF;
END $$;

-- التحقق النهائي من حالة Real-time
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'collection_records'
        ) 
        THEN '✅ collection_records is enabled for real-time'
        ELSE '❌ collection_records is NOT enabled for real-time'
    END as realtime_status;

-- عرض جميع الحقول في الجدول
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'collection_records' 
AND column_name LIKE '%photo_viewing%'
ORDER BY column_name;
