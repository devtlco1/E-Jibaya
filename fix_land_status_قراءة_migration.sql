-- =====================================================
-- Migration: إضافة "خطاء في القراءة" و"إيقاف قراءة" و"عاطل" لقيد land_status
-- نفّذ هذا الملف في Supabase SQL Editor
-- =====================================================

-- 1. حذف القيد القديم (تأكد من تنفيذ هذا أولاً)
ALTER TABLE public.collection_records
DROP CONSTRAINT IF EXISTS collection_records_land_status_check;

-- 2. إضافة القيد الجديد - يشمل كل القيم (القديمة والجديدة)
ALTER TABLE public.collection_records
ADD CONSTRAINT collection_records_land_status_check
CHECK (land_status IS NULL OR land_status IN (
    'متروك', 'مهدوم', 'لم اعثر عليه', 'ممتنع', 'تجاوز', 
    'قيد الانشاء', 'مبدل', 'مغلق', 'لايوجد مقياس', 
    'فحص مقياس', 'فارغ', 
    'خطاء في القرادة', 'خطاء في القراءة',
    'إيقاف قراءة', 'عاطل'
));

-- 3. (اختياري) تحديث السجلات القديمة للقيمة المصححة
UPDATE public.collection_records
SET land_status = 'خطاء في القراءة'
WHERE land_status = 'خطاء في القرادة';
