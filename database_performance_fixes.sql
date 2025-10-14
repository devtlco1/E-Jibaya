-- إصلاح مشاكل الأداء في قاعدة البيانات
-- Database Performance Fixes

-- 1. إصلاح RLS policies لتحسين الأداء
-- Fix RLS policies for better performance

-- إصلاح record_changes_log_select_policy
DROP POLICY IF EXISTS record_changes_log_select_policy ON public.record_changes_log;
CREATE POLICY record_changes_log_select_policy ON public.record_changes_log
FOR SELECT USING (
  (SELECT auth.uid()) IS NOT NULL AND (
    (SELECT auth.role()) = 'service_role' OR
    (SELECT auth.uid()) = changed_by OR
    (SELECT auth.uid()) IN (
      SELECT id FROM users WHERE role IN ('admin', 'employee')
    )
  )
);

-- إصلاح record_changes_log_insert_policy
DROP POLICY IF EXISTS record_changes_log_insert_policy ON public.record_changes_log;
CREATE POLICY record_changes_log_insert_policy ON public.record_changes_log
FOR INSERT WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL AND (
    (SELECT auth.role()) = 'service_role' OR
    (SELECT auth.uid()) = changed_by OR
    (SELECT auth.uid()) IN (
      SELECT id FROM users WHERE role IN ('admin', 'employee')
    )
  )
);

-- 2. إضافة فهارس للمفاتيح الخارجية
-- Add indexes for foreign keys

-- فهارس backup_logs
CREATE INDEX IF NOT EXISTS idx_backup_logs_created_by 
ON public.backup_logs(created_by);

-- فهارس record_changes_log
CREATE INDEX IF NOT EXISTS idx_record_changes_log_changed_by 
ON public.record_changes_log(changed_by);

CREATE INDEX IF NOT EXISTS idx_record_changes_log_record_id 
ON public.record_changes_log(record_id);

-- 3. حذف الفهارس غير المستخدمة
-- Remove unused indexes

-- حذف فهارس users غير المستخدمة
DROP INDEX IF EXISTS idx_users_role;
DROP INDEX IF EXISTS idx_users_is_active;

-- حذف فهارس collection_records غير المستخدمة
DROP INDEX IF EXISTS idx_collection_records_is_refused;
DROP INDEX IF EXISTS idx_collection_records_region;
DROP INDEX IF EXISTS idx_collection_records_category;
DROP INDEX IF EXISTS idx_collection_records_phase;
DROP INDEX IF EXISTS idx_collection_records_verification_status;
DROP INDEX IF EXISTS idx_collection_records_meter_photo_verified;
DROP INDEX IF EXISTS idx_collection_records_invoice_photo_verified;
DROP INDEX IF EXISTS idx_collection_records_lock_expires_at;
DROP INDEX IF EXISTS idx_collection_records_created_at;
DROP INDEX IF EXISTS idx_collection_records_updated_at;
DROP INDEX IF EXISTS idx_records_meter_photo_rejected;
DROP INDEX IF EXISTS idx_records_invoice_photo_rejected;
DROP INDEX IF EXISTS idx_collection_records_multiplier;

-- حذف فهارس record_photos غير المستخدمة
DROP INDEX IF EXISTS idx_record_photos_photo_type;
DROP INDEX IF EXISTS idx_record_photos_verified;

-- حذف فهارس record_locations غير المستخدمة
DROP INDEX IF EXISTS idx_record_locations_location_type;

-- حذف فهارس activity_logs غير المستخدمة
DROP INDEX IF EXISTS idx_activity_logs_action;
DROP INDEX IF EXISTS idx_activity_logs_target_type;

-- حذف فهارس user_sessions غير المستخدمة
DROP INDEX IF EXISTS idx_user_sessions_user_id;
DROP INDEX IF EXISTS idx_user_sessions_session_token;
DROP INDEX IF EXISTS idx_user_sessions_expires_at;

-- حذف فهارس backup_info غير المستخدمة
DROP INDEX IF EXISTS idx_backup_info_backup_type;
DROP INDEX IF EXISTS idx_backup_info_status;

-- حذف فهارس backup_logs غير المستخدمة
DROP INDEX IF EXISTS idx_backup_logs_backup_type;
DROP INDEX IF EXISTS idx_backup_logs_backup_date;
DROP INDEX IF EXISTS idx_backup_logs_status;

-- 4. إضافة فهارس مفيدة للأداء
-- Add useful indexes for performance

-- فهارس للاستعلامات الشائعة
CREATE INDEX IF NOT EXISTS idx_collection_records_status_field_agent 
ON public.collection_records(status, field_agent_id);

CREATE INDEX IF NOT EXISTS idx_collection_records_verification_status_created 
ON public.collection_records(verification_status, created_at);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_action 
ON public.activity_logs(user_id, action);

-- 5. تحسين إحصائيات الجداول
-- Update table statistics
ANALYZE public.collection_records;
ANALYZE public.users;
ANALYZE public.record_changes_log;
ANALYZE public.backup_logs;
ANALYZE public.activity_logs;
