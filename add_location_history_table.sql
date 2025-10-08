-- =====================================================
-- إضافة جدول المواقع التاريخية
-- =====================================================
-- هذا الملف يضيف جدول لحفظ المواقع التاريخية للسجلات

-- إنشاء جدول المواقع التاريخية
CREATE TABLE IF NOT EXISTS public.record_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    record_id UUID REFERENCES public.collection_records(id) ON DELETE CASCADE,
    gps_latitude DECIMAL(10, 8) NOT NULL,
    gps_longitude DECIMAL(11, 8) NOT NULL,
    location_type VARCHAR(20) NOT NULL DEFAULT 'submission' CHECK (location_type IN ('submission', 'update', 'photo_upload')),
    created_by UUID REFERENCES public.users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إنشاء فهرس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_record_locations_record_id ON public.record_locations(record_id);
CREATE INDEX IF NOT EXISTS idx_record_locations_created_at ON public.record_locations(created_at);

-- إضافة سياسات الأمان (RLS)
ALTER TABLE public.record_locations ENABLE ROW LEVEL SECURITY;

-- سياسة للقراءة - جميع المستخدمين النشطين يمكنهم قراءة المواقع
CREATE POLICY "record_locations_select_policy" ON public.record_locations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.is_active = true
        )
    );

-- سياسة للإدراج - المستخدمون النشطون يمكنهم إضافة مواقع
CREATE POLICY "record_locations_insert_policy" ON public.record_locations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.is_active = true
        )
    );

-- سياسة للتحديث - المستخدمون النشطون يمكنهم تحديث المواقع
CREATE POLICY "record_locations_update_policy" ON public.record_locations
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.is_active = true
        )
    );

-- سياسة للحذف - المستخدمون النشطون يمكنهم حذف المواقع
CREATE POLICY "record_locations_delete_policy" ON public.record_locations
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.is_active = true
        )
    );

-- إدراج المواقع الموجودة من collection_records
INSERT INTO public.record_locations (record_id, gps_latitude, gps_longitude, location_type, created_by, notes, created_at)
SELECT 
    id as record_id,
    gps_latitude,
    gps_longitude,
    'submission' as location_type,
    field_agent_id as created_by,
    'الموقع الأصلي عند الإرسال' as notes,
    submitted_at as created_at
FROM public.collection_records 
WHERE gps_latitude IS NOT NULL 
AND gps_longitude IS NOT NULL;

-- التحقق من البيانات المدرجة
SELECT 
    COUNT(*) as total_locations,
    COUNT(DISTINCT record_id) as records_with_locations
FROM public.record_locations;
