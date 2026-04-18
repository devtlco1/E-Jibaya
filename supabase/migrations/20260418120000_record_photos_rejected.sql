-- حفظ حالة الرفض على صفوف الأرشفة في record_photos (يتوافق مع addPhotoToRecord / المقارنة)
ALTER TABLE public.record_photos
  ADD COLUMN IF NOT EXISTS rejected boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.record_photos.rejected IS 'رفض الصورة (أرشيف أو إضافية)';
