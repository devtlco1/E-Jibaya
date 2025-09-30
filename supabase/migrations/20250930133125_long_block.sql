/*
  # إعداد نظام تخزين الصور

  1. إنشاء bucket للصور
     - اسم البucket: `photos`
     - الوصول العام للقراءة
     - حد أقصى للملف: 5 ميجابايت
     - أنواع الملفات المسموحة: JPEG, PNG, WebP

  2. السياسات الأمنية
     - السماح للجميع بقراءة الصور
     - السماح للمستخدمين المسجلين برفع الصور
     - تنظيم الرفع في مجلدات محددة

  3. هيكل المجلدات
     - meter_photos/ لصور المقاييس
     - invoice_photos/ لصور الفواتير
*/

-- إنشاء bucket للصور إذا لم يكن موجوداً
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photos',
  'photos',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- السماح للجميع بقراءة الصور
CREATE POLICY "Public read access for photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'photos');

-- السماح للمستخدمين المسجلين برفع الصور
CREATE POLICY "Authenticated users can upload photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'photos' 
  AND auth.role() = 'authenticated'
  AND (
    (storage.foldername(name))[1] = 'meter_photos' OR
    (storage.foldername(name))[1] = 'invoice_photos'
  )
);

-- السماح للمستخدمين المسجلين بتحديث صورهم
CREATE POLICY "Authenticated users can update photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'photos' 
  AND auth.role() = 'authenticated'
);

-- السماح للمدراء بحذف الصور
CREATE POLICY "Admins can delete photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'photos' 
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
    AND users.is_active = true
  )
);