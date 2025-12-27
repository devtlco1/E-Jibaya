-- =====================================================
-- Migration: إضافة حقول المبلغ الكلي والمبلغ الحالي
-- Date: 2024-12-24
-- Description: إضافة حقول total_amount و current_amount إلى جدول collection_records
-- =====================================================

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

-- إضافة عمود المبلغ الكلي (total_amount)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'collection_records' 
        AND column_name = 'total_amount'
    ) THEN
        ALTER TABLE public.collection_records
        ADD COLUMN total_amount DECIMAL(15, 2) NULL;
        
        COMMENT ON COLUMN public.collection_records.total_amount IS 'المبلغ الكلي المطلوب';
        
        RAISE NOTICE 'تم إضافة عمود total_amount بنجاح';
    ELSE
        RAISE NOTICE 'عمود total_amount موجود بالفعل';
    END IF;
END $$;

-- إضافة عمود المبلغ الحالي (current_amount)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'collection_records' 
        AND column_name = 'current_amount'
    ) THEN
        ALTER TABLE public.collection_records
        ADD COLUMN current_amount DECIMAL(15, 2) NULL;
        
        COMMENT ON COLUMN public.collection_records.current_amount IS 'المبلغ الحالي المدفوع';
        
        RAISE NOTICE 'تم إضافة عمود current_amount بنجاح';
    ELSE
        RAISE NOTICE 'عمود current_amount موجود بالفعل';
    END IF;
END $$;

-- إضافة فهارس للأداء (إذا لم تكن موجودة)
CREATE INDEX IF NOT EXISTS idx_collection_records_total_amount 
ON public.collection_records(total_amount)
WHERE total_amount IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_collection_records_current_amount 
ON public.collection_records(current_amount)
WHERE current_amount IS NOT NULL;

-- التحقق النهائي من الأعمدة
DO $$
DECLARE
    total_amount_exists BOOLEAN;
    current_amount_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'collection_records' 
        AND column_name = 'total_amount'
    ) INTO total_amount_exists;
    
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'collection_records' 
        AND column_name = 'current_amount'
    ) INTO current_amount_exists;
    
    IF total_amount_exists AND current_amount_exists THEN
        RAISE NOTICE '✓ تم التحقق: جميع الأعمدة موجودة بنجاح';
        RAISE NOTICE '✓ total_amount: موجود';
        RAISE NOTICE '✓ current_amount: موجود';
    ELSE
        RAISE WARNING '⚠ تحذير: بعض الأعمدة غير موجودة';
        RAISE WARNING 'total_amount: %', CASE WHEN total_amount_exists THEN 'موجود' ELSE 'غير موجود' END;
        RAISE WARNING 'current_amount: %', CASE WHEN current_amount_exists THEN 'موجود' ELSE 'غير موجود' END;
    END IF;
END $$;

-- =====================================================
-- Migration completed successfully
-- =====================================================

