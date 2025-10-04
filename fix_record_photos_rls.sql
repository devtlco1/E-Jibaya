-- =====================================================
-- إصلاح سياسات RLS لجدول record_photos
-- =====================================================

-- حذف السياسات الموجودة
DROP POLICY IF EXISTS "record_photos_select_policy" ON public.record_photos;
DROP POLICY IF EXISTS "record_photos_insert_policy" ON public.record_photos;
DROP POLICY IF EXISTS "record_photos_delete_policy" ON public.record_photos;

-- إنشاء سياسات جديدة مع دعم anon و authenticated
CREATE POLICY "record_photos_select_policy" ON public.record_photos
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "record_photos_insert_policy" ON public.record_photos
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "record_photos_update_policy" ON public.record_photos
    FOR UPDATE TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "record_photos_delete_policy" ON public.record_photos
    FOR DELETE TO anon, authenticated
    USING (true);

-- التأكد من تفعيل RLS
ALTER TABLE public.record_photos ENABLE ROW LEVEL SECURITY;

-- رسالة النجاح
SELECT '✅ تم إصلاح سياسات RLS لجدول record_photos بنجاح!' as result;
