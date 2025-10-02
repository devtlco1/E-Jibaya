-- إنشاء جدول معلومات النسخ الاحتياطية
CREATE TABLE IF NOT EXISTS backup_info (
  id INTEGER PRIMARY KEY DEFAULT 1,
  backup_date TIMESTAMP WITH TIME ZONE NOT NULL,
  total_records INTEGER NOT NULL DEFAULT 0,
  total_photos INTEGER NOT NULL DEFAULT 0,
  total_users INTEGER NOT NULL DEFAULT 0,
  backup_type VARCHAR(50) NOT NULL DEFAULT 'complete_with_images',
  file_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إضافة تعليق على الجدول
COMMENT ON TABLE backup_info IS 'معلومات آخر نسخة احتياطية';

-- إضافة تعليقات على الأعمدة
COMMENT ON COLUMN backup_info.id IS 'معرف فريد (دائماً 1)';
COMMENT ON COLUMN backup_info.backup_date IS 'تاريخ إنشاء النسخة الاحتياطية';
COMMENT ON COLUMN backup_info.total_records IS 'عدد السجلات في النسخة الاحتياطية';
COMMENT ON COLUMN backup_info.total_photos IS 'عدد الصور في النسخة الاحتياطية';
COMMENT ON COLUMN backup_info.total_users IS 'عدد المستخدمين في النسخة الاحتياطية';
COMMENT ON COLUMN backup_info.backup_type IS 'نوع النسخة الاحتياطية';
COMMENT ON COLUMN backup_info.file_name IS 'اسم ملف النسخة الاحتياطية';

-- إنشاء فهرس على تاريخ النسخة الاحتياطية
CREATE INDEX IF NOT EXISTS idx_backup_info_date ON backup_info(backup_date);

-- إدراج سجل افتراضي
INSERT INTO backup_info (
  id,
  backup_date,
  total_records,
  total_photos,
  total_users,
  backup_type,
  file_name
) VALUES (
  1,
  NOW(),
  0,
  0,
  0,
  'complete_with_images',
  'no_backup_yet.zip'
) ON CONFLICT (id) DO NOTHING;
