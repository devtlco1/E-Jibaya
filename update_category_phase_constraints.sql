-- =====================================================
-- Migration: تحديث قيود الأصناف ونوع المقياس
-- Date: 2024-12-27
-- Description: 
-- 1. حذف 'انارة' و 'محولة خاصة' من قائمة الأصناف (category)
-- 2. إضافة 'المحولة الخاصة' إلى قائمة نوع المقياس (phase)
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

-- 1. تحديث قيد الصنف (category) - حذف 'انارة' و 'محولة خاصة'
DO $$
BEGIN
    -- حذف القيد القديم
    ALTER TABLE public.collection_records 
    DROP CONSTRAINT IF EXISTS collection_records_category_check;
    
    -- إضافة القيد الجديد بدون 'انارة' و 'محولة خاصة'
    ALTER TABLE public.collection_records
    ADD CONSTRAINT collection_records_category_check 
    CHECK (category IS NULL OR category IN ('منزلي', 'تجاري', 'صناعي', 'زراعي', 'حكومي'));
    
    RAISE NOTICE '✓ تم تحديث قيد الصنف (category) بنجاح';
END $$;

-- 2. تحديث قيد نوع المقياس (phase) - إضافة 'المحولة الخاصة'
DO $$
BEGIN
    -- حذف القيد القديم
    ALTER TABLE public.collection_records 
    DROP CONSTRAINT IF EXISTS collection_records_phase_check;
    
    -- إضافة القيد الجديد مع 'المحولة الخاصة'
    ALTER TABLE public.collection_records
    ADD CONSTRAINT collection_records_phase_check 
    CHECK (phase IS NULL OR phase IN ('احادي', 'ثلاثي', 'سي تي', 'المحولة الخاصة'));
    
    RAISE NOTICE '✓ تم تحديث قيد نوع المقياس (phase) بنجاح';
END $$;

-- 3. تحديث السجلات الموجودة التي تحتوي على 'انارة' أو 'محولة خاصة' في category
-- يمكنك اختيار أحد الخيارات التالية:

-- الخيار 1: حذف السجلات (غير مستحسن)
-- DELETE FROM public.collection_records WHERE category IN ('انارة', 'محولة خاصة');

-- الخيار 2: تعيين category إلى NULL (مستحسن)
UPDATE public.collection_records 
SET category = NULL 
WHERE category IN ('انارة', 'محولة خاصة');

-- الخيار 3: تعيين category إلى قيمة افتراضية (مثل 'منزلي')
-- UPDATE public.collection_records 
-- SET category = 'منزلي' 
-- WHERE category IN ('انارة', 'محولة خاصة');

-- 4. التحقق النهائي من القيود
DO $$
DECLARE
    category_constraint_exists BOOLEAN;
    phase_constraint_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
        AND table_name = 'collection_records' 
        AND constraint_name = 'collection_records_category_check'
    ) INTO category_constraint_exists;
    
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
        AND table_name = 'collection_records' 
        AND constraint_name = 'collection_records_phase_check'
    ) INTO phase_constraint_exists;
    
    IF category_constraint_exists AND phase_constraint_exists THEN
        RAISE NOTICE '✓ تم التحقق: جميع القيود محدثة بنجاح';
        RAISE NOTICE '✓ category constraint: موجود';
        RAISE NOTICE '✓ phase constraint: موجود';
    ELSE
        RAISE WARNING '⚠ تحذير: بعض القيود غير موجودة';
        RAISE WARNING 'category constraint: %', CASE WHEN category_constraint_exists THEN 'موجود' ELSE 'غير موجود' END;
        RAISE WARNING 'phase constraint: %', CASE WHEN phase_constraint_exists THEN 'موجود' ELSE 'غير موجود' END;
    END IF;
END $$;

-- =====================================================
-- Migration completed successfully
-- =====================================================

