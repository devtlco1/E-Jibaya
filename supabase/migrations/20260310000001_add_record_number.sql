-- إضافة عمود رقم السجل (من B_SECT في الإكسل)
ALTER TABLE public.collection_records
ADD COLUMN IF NOT EXISTS record_number TEXT;

COMMENT ON COLUMN public.collection_records.record_number IS 'رقم السجل (من B_SECT في ملف الإكسل)';
