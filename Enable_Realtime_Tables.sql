-- تفعيل Real-time للجداول المطلوبة
-- قم بتشغيل هذا الكود في Supabase SQL Editor

-- تفعيل Real-time للجدول الرئيسي
ALTER PUBLICATION supabase_realtime ADD TABLE collection_records;

-- تفعيل Real-time لجداول أخرى مهمة (اختياري)
ALTER PUBLICATION supabase_realtime ADD TABLE users;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE record_photos;

-- التحقق من الجداول المفعلة
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
