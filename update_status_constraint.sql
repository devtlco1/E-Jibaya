-- تحديث constraint للـ status في جدول collection_records
-- إضافة حالة 'refused' كحالة ثالثة

-- حذف الـ constraint القديم
ALTER TABLE public.collection_records DROP CONSTRAINT IF EXISTS collection_records_status_check;

-- إضافة الـ constraint الجديد مع دعم 'refused'
ALTER TABLE public.collection_records ADD CONSTRAINT collection_records_status_check 
CHECK (status IN ('pending', 'completed', 'refused'));

-- تحديث السجلات الموجودة التي لديها is_refused = true
UPDATE public.collection_records 
SET status = 'refused' 
WHERE is_refused = true AND status != 'refused';

-- التحقق من النتيجة
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'collection_records_status_check';

-- عرض إحصائيات الحالات
SELECT 
    status,
    COUNT(*) as count
FROM public.collection_records 
GROUP BY status
ORDER BY status;
