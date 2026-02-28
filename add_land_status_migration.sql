-- =====================================================
-- Migration: إضافة حقل حالة الارض (land_status)
-- Description: إضافة حقل حالة الارض إلى جدول collection_records
-- القيم: متروك، مهدوم، لم اعثر عليه، ممتنع، تجاوز، قيد الانشاء، مبدل، مغلق، لايوجد مقياس، فحص مقياس، فارغ، خطاء في القراءة
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

-- إضافة عمود حالة الارض (land_status)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'collection_records' 
        AND column_name = 'land_status'
    ) THEN
        ALTER TABLE public.collection_records
        ADD COLUMN land_status VARCHAR(50) NULL;
        
        COMMENT ON COLUMN public.collection_records.land_status IS 'حالة الارض: متروك، مهدوم، لم اعثر عليه، ممتنع، تجاوز، قيد الانشاء، مبدل، مغلق، لايوجد مقياس، فحص مقياس، فارغ، خطاء في القراءة';
        
        -- إضافة قيد التحقق
        ALTER TABLE public.collection_records
        ADD CONSTRAINT collection_records_land_status_check
        CHECK (land_status IS NULL OR land_status IN (
            'متروك', 'مهدوم', 'لم اعثر عليه', 'ممتنع', 'تجاوز', 
            'قيد الانشاء', 'مبدل', 'مغلق', 'لايوجد مقياس', 
            'فحص مقياس', 'فارغ', 'خطاء في القراءة'
        ));
        
        RAISE NOTICE 'تم إضافة عمود land_status بنجاح';
    ELSE
        RAISE NOTICE 'عمود land_status موجود بالفعل';
    END IF;
END $$;

-- إضافة فهرس للأداء (إذا لزم الأمر)
CREATE INDEX IF NOT EXISTS idx_collection_records_land_status 
ON public.collection_records(land_status)
WHERE land_status IS NOT NULL;

-- =====================================================
-- Migration completed successfully
-- =====================================================
