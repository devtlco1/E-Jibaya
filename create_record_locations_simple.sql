-- =====================================================
-- إنشاء جدول المواقع التاريخية - نسخة مبسطة
-- =====================================================

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

-- تفعيل Row Level Security
ALTER TABLE public.record_locations ENABLE ROW LEVEL SECURITY;

-- سياسة للقراءة - جميع المستخدمين النشطين
CREATE POLICY "Allow all users to read record_locations" ON public.record_locations
    FOR SELECT USING (true);

-- سياسة للإدراج - جميع المستخدمين النشطين
CREATE POLICY "Allow all users to insert record_locations" ON public.record_locations
    FOR INSERT WITH CHECK (true);

-- سياسة للتحديث - جميع المستخدمين النشطين
CREATE POLICY "Allow all users to update record_locations" ON public.record_locations
    FOR UPDATE USING (true);

-- سياسة للحذف - جميع المستخدمين النشطين
CREATE POLICY "Allow all users to delete record_locations" ON public.record_locations
    FOR DELETE USING (true);

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
AND gps_longitude IS NOT NULL
ON CONFLICT DO NOTHING;

-- التحقق من البيانات المدرجة
SELECT 
    COUNT(*) as total_locations,
    COUNT(DISTINCT record_id) as records_with_locations
FROM public.record_locations;
