-- التحقق من حالة Real-time للجداول
-- قم بتشغيل هذا الكود في Supabase SQL Editor

-- عرض جميع الجداول المفعلة للـ Real-time
SELECT 
    schemaname,
    tablename,
    'Real-time enabled' as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- التحقق من وجود الجدول الرئيسي
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
