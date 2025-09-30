/*
  # إعداد نظام تخزين الصور

  1. إنشاء Bucket للصور
    - اسم البucket: `photos`
    - وصول عام للقراءة
    - حد أقصى للملف: 5 ميجابايت
    - أنواع مسموحة: JPEG, PNG, WebP

  2. إنشاء المجلدات
    - `meter_photos/` لصور المقاييس  
    - `invoice_photos/` لصور الفواتير

  3. السياسات الأمنية
    - قراءة عامة للصور
    - رفع للمستخدمين المسجلين
    - حذف للمدراء فقط
*/

-- إنشاء bucket للصور إذا لم يكن موجوداً
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'photos'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'photos',
      'photos', 
      true,
      5242880, -- 5MB
      ARRAY['image/jpeg', 'image/png', 'image/webp']
    );
  END IF;
END $$;

-- إنشاء ملفات placeholder لضمان وجود المجلدات
INSERT INTO storage.objects (bucket_id, name, metadata)
VALUES 
  ('photos', 'meter_photos/.gitkeep', '{"size": 0, "mimetype": "text/plain"}'),
  ('photos', 'invoice_photos/.gitkeep', '{"size": 0, "mimetype": "text/plain"}')
ON CONFLICT (bucket_id, name) DO NOTHING;

-- حذف السياسات الموجودة إذا كانت موجودة
DROP POLICY IF EXISTS "Public read access for photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete photos" ON storage.objects;

-- إنشاء السياسات الجديدة
CREATE POLICY "Public read access for photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'photos');

CREATE POLICY "Authenticated users can upload photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos' AND
  (
    (storage.foldername(name))[1] = 'meter_photos' OR
    (storage.foldername(name))[1] = 'invoice_photos'
  )
);

CREATE POLICY "Admins can delete photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'photos' AND
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
    AND users.is_active = true
  )
);