-- =====================================================
-- إزالة فهارس لم تُستخدم حسب تقرير Database Linter (Unused Index)
-- يقلل حجم القاعدة ويسرّع الكتابة قليلاً
-- =====================================================

-- collection_records
DROP INDEX IF EXISTS public.idx_collection_records_invoice_photo_rejected;

-- branch_manager_employees / branch_manager_field_agents
DROP INDEX IF EXISTS public.idx_branch_manager_employees_created_by;
DROP INDEX IF EXISTS public.idx_branch_manager_field_agents_created_by;

-- user_sessions
DROP INDEX IF EXISTS public.idx_user_sessions_user_id;

-- backup_logs
DROP INDEX IF EXISTS public.idx_backup_logs_created_by;

-- record_changes_log
DROP INDEX IF EXISTS public.idx_record_changes_log_changed_by;

-- record_locations
DROP INDEX IF EXISTS public.idx_record_locations_created_by;

-- record_photos
DROP INDEX IF EXISTS public.idx_record_photos_created_by;

-- collection_payments (فهارس غير مستخدمة حسب التقرير)
DROP INDEX IF EXISTS public.idx_collection_payments_collector_id;
DROP INDEX IF EXISTS public.idx_collection_payments_collected_at;
