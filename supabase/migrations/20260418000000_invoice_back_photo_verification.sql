-- تدقيق ورفض صورة ظهر الفاتورة بشكل مستقل عن وجه الفاتورة
ALTER TABLE public.collection_records
  ADD COLUMN IF NOT EXISTS invoice_back_photo_verified boolean NOT NULL DEFAULT false;

ALTER TABLE public.collection_records
  ADD COLUMN IF NOT EXISTS invoice_back_photo_rejected boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.collection_records.invoice_back_photo_verified IS 'تدقيق صورة ظهر الفاتورة الحالية';
COMMENT ON COLUMN public.collection_records.invoice_back_photo_rejected IS 'رفض صورة ظهر الفاتورة الحالية';
