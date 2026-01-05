-- إضافة حقل tags (تاغات المشاكل) إلى جدول collection_records
-- فقط انسخ والصق في Supabase SQL Editor

-- التحقق من وجود الجدول أولاً
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'collection_records'
    ) THEN
        RAISE EXCEPTION 'جدول collection_records غير موجود';
    END IF;
END $$;

-- إضافة عمود tags (JSONB array)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'collection_records' 
        AND column_name = 'tags'
    ) THEN
        ALTER TABLE public.collection_records
        ADD COLUMN tags JSONB DEFAULT '[]'::jsonb;
        
        COMMENT ON COLUMN public.collection_records.tags IS 'تاغات المشاكل التي لاحظها المحصل الميداني';
        
        -- إضافة فهرس للأداء
        CREATE INDEX IF NOT EXISTS idx_collection_records_tags 
        ON public.collection_records USING GIN (tags);
        
        RAISE NOTICE '✓ تم إضافة عمود tags بنجاح';
    ELSE
        RAISE NOTICE 'عمود tags موجود بالفعل';
    END IF;
END $$;

-- التاغات المتاحة:
-- عاطل
-- متلاعب
-- مغلق
-- مهدوم
-- متروك
-- لم يعثر عليه
-- م. بدون مقياس
-- م.على المقياس
-- ق.مشكوك بها

