-- =====================================================
-- Migration: إضافة حالتين جديدتين لحالة الأرض (land_status)
-- القيم الجديدة: إيقاف قراءة، عاطل
-- =====================================================

-- حذف القيد القديم وإضافة قيد جديد بالقيم الإضافية
DO $$
BEGIN
    -- حذف القيد إن وجد
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_schema = 'public' 
        AND table_name = 'collection_records' 
        AND constraint_name = 'collection_records_land_status_check'
    ) THEN
        ALTER TABLE public.collection_records
        DROP CONSTRAINT collection_records_land_status_check;
        RAISE NOTICE 'تم حذف القيد القديم';
    END IF;

    -- إضافة القيد الجديد مع القيم الإضافية
    ALTER TABLE public.collection_records
    ADD CONSTRAINT collection_records_land_status_check
    CHECK (land_status IS NULL OR land_status IN (
        'متروك', 'مهدوم', 'لم اعثر عليه', 'ممتنع', 'تجاوز', 
        'قيد الانشاء', 'مبدل', 'مغلق', 'لايوجد مقياس', 
        'فحص مقياس', 'فارغ', 'خطاء في القراءة',
        'إيقاف قراءة', 'عاطل'
    ));

    RAISE NOTICE 'تم إضافة القيد الجديد بحالات إيقاف قراءة وعاطل بنجاح';
END $$;

-- =====================================================
-- Migration completed successfully
-- =====================================================
