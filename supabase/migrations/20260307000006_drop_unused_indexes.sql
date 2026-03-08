-- =====================================================
-- Migration: حذف الفهارس غير المستخدمة
-- يصلح تحذير: Unused Index (INFO)
-- ملاحظة: لم نحذف idx_*_created_by و idx_user_sessions_user_id
-- لأنها تغطي المفاتيح الأجنبية وتم إضافتها حديثاً
-- =====================================================

-- users
DROP INDEX IF EXISTS public.idx_users_job_title;
DROP INDEX IF EXISTS public.idx_users_sector;

-- branch_manager_field_agents (field_agent_id فقط - created_by نحتفظ به)
DROP INDEX IF EXISTS public.idx_branch_manager_field_agents_field_agent_id;

-- branch_manager_employees (employee_id فقط - created_by نحتفظ به)
DROP INDEX IF EXISTS public.idx_branch_manager_employees_employee_id;

-- record_photos
DROP INDEX IF EXISTS public.idx_record_photos_created_by;

-- record_locations
DROP INDEX IF EXISTS public.idx_record_locations_created_by;

-- backup_logs
DROP INDEX IF EXISTS public.idx_backup_logs_created_by;

-- record_changes_log
DROP INDEX IF EXISTS public.idx_record_changes_log_changed_by;

-- collection_records
DROP INDEX IF EXISTS public.idx_collection_records_tags;
