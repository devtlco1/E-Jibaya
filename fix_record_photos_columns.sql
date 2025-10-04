-- =====================================================
-- إصلاح أعمدة جدول record_photos
-- =====================================================

-- إضافة العمود المفقود created_by
ALTER TABLE public.record_photos 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id);

-- إضافة العمود المفقود notes
ALTER TABLE public.record_photos 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- رسالة النجاح
SELECT '✅ تم إضافة الأعمدة المفقودة لجدول record_photos بنجاح!' as result;
