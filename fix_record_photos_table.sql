-- =====================================================
-- إصلاح جدول record_photos - إضافة العمود المفقود
-- =====================================================

-- إضافة عمود created_at إذا لم يكن موجوداً
ALTER TABLE public.record_photos 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- إضافة عمود updated_at إذا لم يكن موجوداً
ALTER TABLE public.record_photos 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- التحقق من هيكل الجدول
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'record_photos' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- اختبار الاستعلام
SELECT COUNT(*) as total_photos FROM public.record_photos;

SELECT '✅ تم إصلاح جدول record_photos!' as result;
