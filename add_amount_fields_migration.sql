-- =====================================================
-- Migration: إضافة حقول المبلغ الكلي والمبلغ الحالي
-- Date: 2024-12-24
-- Description: إضافة حقول total_amount و current_amount إلى جدول collection_records
-- Compatible with Supabase PostgreSQL
-- =====================================================

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
    END IF;
END $$;

-- إضافة فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_collection_records_total_amount 
ON public.collection_records(total_amount)
WHERE total_amount IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_collection_records_current_amount 
ON public.collection_records(current_amount)
WHERE current_amount IS NOT NULL;

