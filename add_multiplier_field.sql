-- إضافة حقل معامل الضرب إلى جدول collection_records
-- هذا الحقل يظهر فقط عند اختيار نوع المقياس "سي تي"

-- إضافة العمود الجديد
ALTER TABLE public.collection_records 
ADD COLUMN IF NOT EXISTS multiplier TEXT;

-- إضافة تعليق على العمود
COMMENT ON COLUMN public.collection_records.multiplier IS 'معامل الضرب - يظهر فقط عند اختيار نوع المقياس سي تي';

-- تحديث RLS policies إذا لزم الأمر (السياسات الموجودة يجب أن تعمل مع العمود الجديد)

-- إضافة فهرس على العمود الجديد لتحسين الأداء (اختياري)
CREATE INDEX IF NOT EXISTS idx_collection_records_multiplier 
ON public.collection_records(multiplier) 
WHERE multiplier IS NOT NULL;

-- تحديث View v_collection_records_with_users إذا كان موجوداً
-- (هذا سيتطلب تحديث الـ view ليشمل العمود الجديد)

-- ملاحظة: العمود الجديد سيكون NULL افتراضياً لجميع السجلات الموجودة
-- ويمكن ملؤه عند تعديل السجلات التي لها نوع مقياس "سي تي"
