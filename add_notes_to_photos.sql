-- إضافة حقل الملاحظات لجدول record_photos
-- لتخزين الملاحظات المرتبطة بكل صورة

-- إضافة عمود الملاحظات
ALTER TABLE record_photos 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- إضافة تعليق على العمود
COMMENT ON COLUMN record_photos.notes IS 'ملاحظات مرتبطة بالصورة';

-- إنشاء فهرس على الملاحظات للبحث السريع
CREATE INDEX IF NOT EXISTS idx_record_photos_notes 
ON record_photos USING gin(to_tsvector('arabic', notes));

-- تحديث السياسات إذا لزم الأمر
-- (السياسات الحالية ستعمل مع العمود الجديد)
