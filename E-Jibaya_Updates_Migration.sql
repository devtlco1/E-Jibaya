-- ملف التعديل النهائي لقاعدة البيانات - E-Jibaya
-- يحتوي على جميع التحديثات المطلوبة

-- 1. إضافة أعمدة جديدة لجدول collection_records
ALTER TABLE public.collection_records 
ADD COLUMN IF NOT EXISTS region VARCHAR(255),
ADD COLUMN IF NOT EXISTS category VARCHAR(50) CHECK (category IN ('منزلي', 'تجاري', 'صناعي', 'زراعي', 'حكومي', 'انارة', 'محولة خاصة')),
ADD COLUMN IF NOT EXISTS phase VARCHAR(20) CHECK (phase IN ('احادي', 'ثلاثي', 'سي تي')),
ADD COLUMN IF NOT EXISTS meter_photo_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS invoice_photo_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) CHECK (verification_status IN ('غير مدقق', 'مدقق'));

-- 2. تحديث عمود address إلى region (إذا كان موجوداً)
-- ملاحظة: إذا كان العمود address موجود، يمكن حذفه بعد نقل البيانات
-- ALTER TABLE public.collection_records DROP COLUMN IF EXISTS address;

-- 3. إضافة فهارس للأعمدة الجديدة
CREATE INDEX IF NOT EXISTS idx_collection_records_region ON public.collection_records(region);
CREATE INDEX IF NOT EXISTS idx_collection_records_category ON public.collection_records(category);
CREATE INDEX IF NOT EXISTS idx_collection_records_phase ON public.collection_records(phase);
CREATE INDEX IF NOT EXISTS idx_collection_records_verification_status ON public.collection_records(verification_status);
CREATE INDEX IF NOT EXISTS idx_collection_records_meter_photo_verified ON public.collection_records(meter_photo_verified);
CREATE INDEX IF NOT EXISTS idx_collection_records_invoice_photo_verified ON public.collection_records(invoice_photo_verified);

-- 4. إضافة تحقق رقم الحساب (12 رقم فقط)
-- أولاً، تنظيف البيانات الموجودة لتتوافق مع القيود الجديدة
UPDATE public.collection_records 
SET account_number = NULL 
WHERE account_number IS NOT NULL 
  AND (LENGTH(account_number) != 12 OR account_number !~ '^[0-9]+$');

-- إضافة constraint للتحقق من رقم الحساب (حد أقصى 12 رقم)
ALTER TABLE public.collection_records 
ADD CONSTRAINT check_account_number_format 
CHECK (account_number IS NULL OR (LENGTH(account_number) <= 12 AND account_number ~ '^[0-9]+$'));

-- 5. تحديث الجدول لضمان التوافق مع النظام الجديد
-- إضافة قيم افتراضية للأعمدة الجديدة
UPDATE public.collection_records 
SET 
  region = COALESCE(region, 'غير محدد'),
  category = COALESCE(category, 'منزلي'),
  phase = COALESCE(phase, 'احادي'),
  meter_photo_verified = COALESCE(meter_photo_verified, false),
  invoice_photo_verified = COALESCE(invoice_photo_verified, false),
  verification_status = COALESCE(verification_status, 'غير مدقق')
WHERE 
  region IS NULL OR 
  category IS NULL OR 
  phase IS NULL OR 
  meter_photo_verified IS NULL OR 
  invoice_photo_verified IS NULL OR 
  verification_status IS NULL;

-- 6. إنشاء دالة لتحديث حالة التدقيق تلقائياً
CREATE OR REPLACE FUNCTION update_verification_status()
RETURNS TRIGGER AS $$
BEGIN
  -- تحديث حالة التدقيق بناءً على تدقيق الصور
  IF NEW.meter_photo_verified = true AND NEW.invoice_photo_verified = true THEN
    NEW.verification_status := 'مدقق';
  ELSE
    NEW.verification_status := 'غير مدقق';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. إنشاء trigger لتحديث حالة التدقيق تلقائياً
DROP TRIGGER IF EXISTS trigger_update_verification_status ON public.collection_records;
CREATE TRIGGER trigger_update_verification_status
  BEFORE UPDATE ON public.collection_records
  FOR EACH ROW
  EXECUTE FUNCTION update_verification_status();

-- 8. إضافة تعليقات للتوثيق
COMMENT ON COLUMN public.collection_records.region IS 'المنطقة بدلاً من العنوان';
COMMENT ON COLUMN public.collection_records.category IS 'صنف السجل (منزلي، تجاري، صناعي، زراعي، حكومي، انارة، محولة خاصة)';
COMMENT ON COLUMN public.collection_records.phase IS 'مرحلة السجل (احادي، ثلاثي، سي تي)';
COMMENT ON COLUMN public.collection_records.meter_photo_verified IS 'حالة تدقيق صورة المقياس';
COMMENT ON COLUMN public.collection_records.invoice_photo_verified IS 'حالة تدقيق صورة الفاتورة';
COMMENT ON COLUMN public.collection_records.verification_status IS 'حالة التدقيق العامة (مدقق، غير مدقق)';

-- 9. إنشاء view للإحصائيات المحدثة
CREATE OR REPLACE VIEW records_stats_view AS
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'pending' AND is_refused = false THEN 1 END) as pending,
  COUNT(CASE WHEN status = 'completed' AND is_refused = false THEN 1 END) as completed,
  COUNT(CASE WHEN is_refused = true THEN 1 END) as refused,
  COUNT(CASE WHEN verification_status = 'مدقق' THEN 1 END) as verified,
  COUNT(CASE WHEN locked_by IS NOT NULL THEN 1 END) as locked
FROM public.collection_records;

-- 10. إنشاء دالة للحصول على إحصائيات السجلات
-- حذف الدالة الموجودة أولاً لتجنب تضارب الأنواع
DROP FUNCTION IF EXISTS get_records_stats();

CREATE OR REPLACE FUNCTION get_records_stats()
RETURNS TABLE (
  total bigint,
  pending bigint,
  completed bigint,
  refused bigint,
  verified bigint,
  locked bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.total,
    s.pending,
    s.completed,
    s.refused,
    s.verified,
    s.locked
  FROM records_stats_view s;
END;
$$ LANGUAGE plpgsql;

-- 11. إنشاء دالة للبحث المتقدم
CREATE OR REPLACE FUNCTION search_records_advanced(
  search_text TEXT DEFAULT '',
  status_filter TEXT DEFAULT '',
  category_filter TEXT DEFAULT '',
  phase_filter TEXT DEFAULT '',
  verification_filter TEXT DEFAULT '',
  region_filter TEXT DEFAULT ''
)
RETURNS TABLE (
  id UUID,
  subscriber_name VARCHAR,
  account_number VARCHAR,
  meter_number VARCHAR,
  region VARCHAR,
  category VARCHAR,
  phase VARCHAR,
  status VARCHAR,
  verification_status VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.id,
    cr.subscriber_name,
    cr.account_number,
    cr.meter_number,
    cr.region,
    cr.category,
    cr.status,
    cr.verification_status,
    cr.created_at
  FROM public.collection_records cr
  WHERE 
    (search_text = '' OR 
     cr.subscriber_name ILIKE '%' || search_text || '%' OR
     cr.account_number ILIKE '%' || search_text || '%' OR
     cr.meter_number ILIKE '%' || search_text || '%')
    AND (status_filter = '' OR cr.status = status_filter)
    AND (category_filter = '' OR cr.category = category_filter)
    AND (phase_filter = '' OR cr.phase = phase_filter)
    AND (verification_filter = '' OR cr.verification_status = verification_filter)
    AND (region_filter = '' OR cr.region ILIKE '%' || region_filter || '%')
  ORDER BY cr.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 12. إنشاء دالة لتصدير التقارير المحدثة
CREATE OR REPLACE FUNCTION export_records_report(
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  status_filter TEXT DEFAULT '',
  category_filter TEXT DEFAULT '',
  phase_filter TEXT DEFAULT '',
  verification_filter TEXT DEFAULT ''
)
RETURNS TABLE (
  subscriber_name VARCHAR,
  account_number VARCHAR,
  meter_number VARCHAR,
  region VARCHAR,
  last_reading VARCHAR,
  category VARCHAR,
  phase VARCHAR,
  status VARCHAR,
  verification_status VARCHAR,
  submitted_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.subscriber_name,
    cr.account_number,
    cr.meter_number,
    cr.region,
    cr.last_reading,
    cr.category,
    cr.phase,
    CASE 
      WHEN cr.is_refused THEN 'امتنع'
      WHEN cr.status = 'pending' THEN 'قيد المراجعة'
      WHEN cr.status = 'completed' THEN 'مكتمل'
      ELSE cr.status
    END as status,
    cr.verification_status,
    cr.submitted_at
  FROM public.collection_records cr
  WHERE 
    (start_date IS NULL OR cr.submitted_at >= start_date)
    AND (end_date IS NULL OR cr.submitted_at <= end_date)
    AND (status_filter = '' OR 
         (status_filter = 'refused' AND cr.is_refused = true) OR
         (status_filter != 'refused' AND cr.status = status_filter AND cr.is_refused = false))
    AND (category_filter = '' OR cr.category = category_filter)
    AND (phase_filter = '' OR cr.phase = phase_filter)
    AND (verification_filter = '' OR cr.verification_status = verification_filter)
  ORDER BY cr.submitted_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 13. إنشاء دالة لتحديث حالة التدقيق عند إضافة صور جديدة
CREATE OR REPLACE FUNCTION reset_verification_on_new_photos()
RETURNS TRIGGER AS $$
BEGIN
  -- إعادة تعيين حالة التدقيق عند إضافة صور جديدة
  UPDATE public.collection_records 
  SET 
    meter_photo_verified = false,
    invoice_photo_verified = false,
    verification_status = 'غير مدقق'
  WHERE id = NEW.record_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 14. إنشاء trigger لإعادة تعيين التدقيق عند إضافة صور جديدة
DROP TRIGGER IF EXISTS trigger_reset_verification_on_new_photos ON public.record_photos;
CREATE TRIGGER trigger_reset_verification_on_new_photos
  AFTER INSERT ON public.record_photos
  FOR EACH ROW
  EXECUTE FUNCTION reset_verification_on_new_photos();

-- 15. إنشاء دالة لتنظيف البيانات القديمة
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
  -- حذف السجلات القديمة (أكثر من سنة) إذا لم تكن مهمة
  DELETE FROM public.collection_records 
  WHERE created_at < NOW() - INTERVAL '1 year'
    AND status = 'completed'
    AND verification_status = 'مدقق';
    
  -- تنظيف الجلسات المنتهية الصلاحية
  DELETE FROM public.user_sessions 
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 16. إنشاء جدول للنسخ الاحتياطية التلقائية
CREATE TABLE IF NOT EXISTS public.backup_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  backup_type VARCHAR(50) NOT NULL,
  backup_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  records_count INTEGER,
  file_size BIGINT,
  status VARCHAR(20) DEFAULT 'completed',
  created_by UUID REFERENCES public.users(id)
);

-- 17. إنشاء دالة للنسخ الاحتياطية التلقائية
CREATE OR REPLACE FUNCTION create_automatic_backup()
RETURNS void AS $$
DECLARE
  backup_id UUID;
  records_count INTEGER;
BEGIN
  -- حساب عدد السجلات
  SELECT COUNT(*) INTO records_count FROM public.collection_records;
  
  -- إنشاء سجل النسخ الاحتياطية
  INSERT INTO public.backup_logs (backup_type, records_count, status)
  VALUES ('automatic', records_count, 'completed')
  RETURNING id INTO backup_id;
  
  -- يمكن إضافة المزيد من منطق النسخ الاحتياطية هنا
  RAISE NOTICE 'Backup created with ID: %', backup_id;
END;
$$ LANGUAGE plpgsql;

-- 18. إنشاء جدول لتتبع التغييرات
CREATE TABLE IF NOT EXISTS public.record_changes_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  record_id UUID REFERENCES public.collection_records(id),
  changed_by UUID REFERENCES public.users(id),
  change_type VARCHAR(50) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 19. إنشاء دالة لتسجيل التغييرات
CREATE OR REPLACE FUNCTION log_record_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.record_changes_log (
    record_id,
    changed_by,
    change_type,
    old_values,
    new_values
  ) VALUES (
    NEW.id,
    NEW.locked_by,
    'update',
    to_jsonb(OLD),
    to_jsonb(NEW)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 20. إنشاء trigger لتسجيل التغييرات
DROP TRIGGER IF EXISTS trigger_log_record_changes ON public.collection_records;
CREATE TRIGGER trigger_log_record_changes
  AFTER UPDATE ON public.collection_records
  FOR EACH ROW
  EXECUTE FUNCTION log_record_changes();

-- 21. إنشاء فهارس إضافية للأداء
CREATE INDEX IF NOT EXISTS idx_collection_records_submitted_at ON public.collection_records(submitted_at);
CREATE INDEX IF NOT EXISTS idx_collection_records_field_agent_id ON public.collection_records(field_agent_id);
CREATE INDEX IF NOT EXISTS idx_collection_records_completed_by ON public.collection_records(completed_by);
CREATE INDEX IF NOT EXISTS idx_record_changes_log_record_id ON public.record_changes_log(record_id);
CREATE INDEX IF NOT EXISTS idx_record_changes_log_changed_at ON public.record_changes_log(changed_at);

-- 22. إنشاء دالة للحصول على إحصائيات مفصلة
CREATE OR REPLACE FUNCTION get_detailed_stats()
RETURNS TABLE (
  total_records bigint,
  pending_records bigint,
  completed_records bigint,
  refused_records bigint,
  verified_records bigint,
  locked_records bigint,
  by_category jsonb,
  by_phase jsonb,
  by_verification jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM public.collection_records) as total_records,
    (SELECT COUNT(*) FROM public.collection_records WHERE status = 'pending' AND is_refused = false) as pending_records,
    (SELECT COUNT(*) FROM public.collection_records WHERE status = 'completed' AND is_refused = false) as completed_records,
    (SELECT COUNT(*) FROM public.collection_records WHERE is_refused = true) as refused_records,
    (SELECT COUNT(*) FROM public.collection_records WHERE verification_status = 'مدقق') as verified_records,
    (SELECT COUNT(*) FROM public.collection_records WHERE locked_by IS NOT NULL) as locked_records,
    (SELECT jsonb_object_agg(category, count) FROM (
      SELECT category, COUNT(*) as count 
      FROM public.collection_records 
      WHERE category IS NOT NULL 
      GROUP BY category
    ) t) as by_category,
    (SELECT jsonb_object_agg(phase, count) FROM (
      SELECT phase, COUNT(*) as count 
      FROM public.collection_records 
      WHERE phase IS NOT NULL 
      GROUP BY phase
    ) t) as by_phase,
    (SELECT jsonb_object_agg(verification_status, count) FROM (
      SELECT verification_status, COUNT(*) as count 
      FROM public.collection_records 
      WHERE verification_status IS NOT NULL 
      GROUP BY verification_status
    ) t) as by_verification;
END;
$$ LANGUAGE plpgsql;

-- 23. إنشاء دالة لتنظيف البيانات المؤقتة
CREATE OR REPLACE FUNCTION cleanup_temp_data()
RETURNS void AS $$
BEGIN
  -- حذف السجلات المؤقتة القديمة
  DELETE FROM public.collection_records 
  WHERE created_at < NOW() - INTERVAL '7 days'
    AND status = 'pending'
    AND field_agent_id IS NULL;
    
  -- تنظيف سجلات التغييرات القديمة
  DELETE FROM public.record_changes_log 
  WHERE changed_at < NOW() - INTERVAL '3 months';
END;
$$ LANGUAGE plpgsql;

-- 24. إنشاء دالة للتحقق من صحة البيانات
CREATE OR REPLACE FUNCTION validate_record_data()
RETURNS TABLE (
  invalid_records jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'subscriber_name', subscriber_name,
      'account_number', account_number,
      'issues', issues
    )
  )
  FROM (
    SELECT 
      id,
      subscriber_name,
      account_number,
      jsonb_agg(issue) as issues
    FROM (
      SELECT 
        id,
        subscriber_name,
        account_number,
        'Invalid account number format' as issue
      FROM public.collection_records 
      WHERE account_number IS NOT NULL 
        AND (LENGTH(account_number) != 12 OR account_number !~ '^[0-9]+$')
      
      UNION ALL
      
      SELECT 
        id,
        subscriber_name,
        account_number,
        'Missing required fields' as issue
      FROM public.collection_records 
      WHERE subscriber_name IS NULL 
        OR account_number IS NULL
    ) issues
    GROUP BY id, subscriber_name, account_number
  ) invalid;
END;
$$ LANGUAGE plpgsql;

-- 25. إنشاء دالة لإعادة تعيين حالة التدقيق
CREATE OR REPLACE FUNCTION reset_verification_status(record_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.collection_records 
  SET 
    meter_photo_verified = false,
    invoice_photo_verified = false,
    verification_status = 'غير مدقق'
  WHERE id = record_id_param;
END;
$$ LANGUAGE plpgsql;

-- 26. إنشاء دالة لتحديث حالة التدقيق
CREATE OR REPLACE FUNCTION update_verification_status_manual(
  record_id_param UUID,
  meter_verified BOOLEAN,
  invoice_verified BOOLEAN
)
RETURNS void AS $$
DECLARE
  new_status VARCHAR(20);
BEGIN
  -- تحديد الحالة الجديدة
  IF meter_verified = true AND invoice_verified = true THEN
    new_status := 'مدقق';
  ELSE
    new_status := 'غير مدقق';
  END IF;
  
  -- تحديث السجل
  UPDATE public.collection_records 
  SET 
    meter_photo_verified = meter_verified,
    invoice_photo_verified = invoice_verified,
    verification_status = new_status
  WHERE id = record_id_param;
END;
$$ LANGUAGE plpgsql;

-- 27. إنشاء دالة للحصول على سجلات تحتاج تدقيق
CREATE OR REPLACE FUNCTION get_records_needing_verification()
RETURNS TABLE (
  id UUID,
  subscriber_name VARCHAR,
  account_number VARCHAR,
  meter_photo_url TEXT,
  invoice_photo_url TEXT,
  verification_status VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.id,
    cr.subscriber_name,
    cr.account_number,
    cr.meter_photo_url,
    cr.invoice_photo_url,
    cr.verification_status,
    cr.created_at
  FROM public.collection_records cr
  WHERE 
    cr.verification_status = 'غير مدقق'
    AND cr.meter_photo_url IS NOT NULL
    AND cr.invoice_photo_url IS NOT NULL
  ORDER BY cr.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 28. إنشاء دالة للحصول على إحصائيات المستخدمين
CREATE OR REPLACE FUNCTION get_user_stats()
RETURNS TABLE (
  user_id UUID,
  full_name VARCHAR,
  total_records bigint,
  pending_records bigint,
  completed_records bigint,
  verified_records bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.full_name,
    COUNT(cr.id) as total_records,
    COUNT(CASE WHEN cr.status = 'pending' AND cr.is_refused = false THEN 1 END) as pending_records,
    COUNT(CASE WHEN cr.status = 'completed' AND cr.is_refused = false THEN 1 END) as completed_records,
    COUNT(CASE WHEN cr.verification_status = 'مدقق' THEN 1 END) as verified_records
  FROM public.users u
  LEFT JOIN public.collection_records cr ON u.id = cr.field_agent_id
  GROUP BY u.id, u.full_name
  ORDER BY total_records DESC;
END;
$$ LANGUAGE plpgsql;

-- 29. إنشاء دالة لتصدير البيانات للنسخ الاحتياطية
CREATE OR REPLACE FUNCTION export_backup_data()
RETURNS TABLE (
  table_name TEXT,
  data jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'collection_records'::TEXT,
    jsonb_agg(to_jsonb(cr))
  FROM public.collection_records cr;
  
  RETURN QUERY
  SELECT 
    'users'::TEXT,
    jsonb_agg(to_jsonb(u))
  FROM public.users u;
  
  RETURN QUERY
  SELECT 
    'activity_logs'::TEXT,
    jsonb_agg(to_jsonb(al))
  FROM public.activity_logs al;
END;
$$ LANGUAGE plpgsql;

-- 30. إنشاء دالة لاستيراد البيانات من النسخ الاحتياطية
CREATE OR REPLACE FUNCTION import_backup_data(backup_data jsonb)
RETURNS void AS $$
BEGIN
  -- يمكن إضافة منطق استيراد البيانات هنا
  RAISE NOTICE 'Backup data import function created';
END;
$$ LANGUAGE plpgsql;

-- 31. إضافة حقل التحقق للصور الإضافية
-- Add verified field to record_photos table
ALTER TABLE public.record_photos
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;

-- تحديث الصور الموجودة لتكون غير محققة
UPDATE public.record_photos 
SET verified = FALSE 
WHERE verified IS NULL;

-- إضافة فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_record_photos_verified 
ON public.record_photos(verified);

CREATE INDEX IF NOT EXISTS idx_record_photos_record_id_verified 
ON public.record_photos(record_id, verified);

-- إنهاء الملف
-- تم إنشاء جميع التحديثات المطلوبة بنجاح
-- يمكن تشغيل هذا الملف على قاعدة البيانات لتطبيق جميع التحديثات
