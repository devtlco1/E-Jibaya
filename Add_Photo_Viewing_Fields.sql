-- إضافة حقول قفل مقارنة الصور إلى قاعدة البيانات
-- قم بتشغيل هذا الكود في Supabase SQL Editor

-- التحقق من وجود الحقول أولاً
DO $$
BEGIN
    -- إضافة حقل photo_viewing_by إذا لم يكن موجوداً
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'collection_records' 
        AND column_name = 'photo_viewing_by'
    ) THEN
        ALTER TABLE collection_records 
        ADD COLUMN photo_viewing_by UUID REFERENCES public.users(id);
        RAISE NOTICE '✅ Added photo_viewing_by column';
    ELSE
        RAISE NOTICE '✅ photo_viewing_by column already exists';
    END IF;

    -- إضافة حقل photo_viewing_at إذا لم يكن موجوداً
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'collection_records' 
        AND column_name = 'photo_viewing_at'
    ) THEN
        ALTER TABLE collection_records 
        ADD COLUMN photo_viewing_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE '✅ Added photo_viewing_at column';
    ELSE
        RAISE NOTICE '✅ photo_viewing_at column already exists';
    END IF;
END $$;

-- التحقق من الحقول المضافة
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'collection_records' 
AND column_name IN ('photo_viewing_by', 'photo_viewing_at')
ORDER BY column_name;

-- التحقق من حالة Real-time
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
