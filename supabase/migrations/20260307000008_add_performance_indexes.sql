-- =====================================================
-- Migration: فهارس الأداء بناءً على تحليل الاستعلامات
-- مصدر: Supabase Query Performance / Index Advisor
-- =====================================================

-- 1. account_number - الأهم! (~62% من وقت الاستعلامات)
-- يُستخدم في: البحث، التحقق من التكرار، الفلترة
CREATE INDEX IF NOT EXISTS idx_collection_records_account_number
  ON public.collection_records(account_number);

-- 2. is_refused - (~8% من وقت الاستعلامات)
-- يُستخدم في: فلترة سجلات الامتناع
CREATE INDEX IF NOT EXISTS idx_collection_records_is_refused
  ON public.collection_records(is_refused);

-- 3. subscriber_name - للبحث بالاسم
CREATE INDEX IF NOT EXISTS idx_collection_records_subscriber_name
  ON public.collection_records(subscriber_name);

-- 4. new_zone - للفلترة حسب المنطقة
CREATE INDEX IF NOT EXISTS idx_collection_records_new_zone
  ON public.collection_records(new_zone)
  WHERE new_zone IS NOT NULL AND new_zone <> '';

-- 5. users.created_at - لترتيب قائمة المستخدمين
CREATE INDEX IF NOT EXISTS idx_users_created_at
  ON public.users(created_at);
