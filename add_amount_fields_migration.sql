-- Migration: إضافة حقول المبلغ الكلي والمبلغ الحالي
-- Date: 2024-12-24

-- إضافة عمود المبلغ الكلي
ALTER TABLE public.collection_records
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(15, 2) NULL;

-- إضافة عمود المبلغ الحالي
ALTER TABLE public.collection_records
ADD COLUMN IF NOT EXISTS current_amount DECIMAL(15, 2) NULL;

-- إضافة تعليقات على الأعمدة
COMMENT ON COLUMN public.collection_records.total_amount IS 'المبلغ الكلي المطلوب';
COMMENT ON COLUMN public.collection_records.current_amount IS 'المبلغ الحالي المدفوع';

-- إضافة فهرس للأداء (اختياري)
CREATE INDEX IF NOT EXISTS idx_collection_records_total_amount ON public.collection_records(total_amount);
CREATE INDEX IF NOT EXISTS idx_collection_records_current_amount ON public.collection_records(current_amount);

