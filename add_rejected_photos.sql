-- إضافة أعمدة رفض الصور في جدول السجلات
ALTER TABLE public.collection_records
ADD COLUMN IF NOT EXISTS meter_photo_rejected boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS invoice_photo_rejected boolean DEFAULT false NOT NULL;

-- تعليق توضيحي
COMMENT ON COLUMN public.collection_records.meter_photo_rejected IS 'رفض صورة المقياس - تموسم عند رفض الصورة لعدم الوضوح';
COMMENT ON COLUMN public.collection_records.invoice_photo_rejected IS 'رفض صورة الفاتورة - تموسم عند رفض الصورة لعدم الوضوح';

-- فهارس اختيارية لتحسين الاستعلامات
CREATE INDEX IF NOT EXISTS idx_records_meter_photo_rejected ON public.collection_records (meter_photo_rejected) WHERE meter_photo_rejected = true;
CREATE INDEX IF NOT EXISTS idx_records_invoice_photo_rejected ON public.collection_records (invoice_photo_rejected) WHERE invoice_photo_rejected = true;

