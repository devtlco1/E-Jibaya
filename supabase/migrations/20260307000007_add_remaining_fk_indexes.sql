-- =====================================================
-- Migration: إضافة فهارس للمفاتيح الأجنبية المتبقية
-- يصلح تحذير: Unindexed foreign keys
-- =====================================================

-- backup_logs.created_by
CREATE INDEX IF NOT EXISTS idx_backup_logs_created_by
  ON public.backup_logs(created_by)
  WHERE created_by IS NOT NULL;

-- branch_manager_employees.employee_id
CREATE INDEX IF NOT EXISTS idx_branch_manager_employees_employee_id
  ON public.branch_manager_employees(employee_id);

-- branch_manager_field_agents.field_agent_id
CREATE INDEX IF NOT EXISTS idx_branch_manager_field_agents_field_agent_id
  ON public.branch_manager_field_agents(field_agent_id);

-- record_changes_log.changed_by
CREATE INDEX IF NOT EXISTS idx_record_changes_log_changed_by
  ON public.record_changes_log(changed_by)
  WHERE changed_by IS NOT NULL;

-- record_locations.created_by
CREATE INDEX IF NOT EXISTS idx_record_locations_created_by
  ON public.record_locations(created_by)
  WHERE created_by IS NOT NULL;

-- record_photos.created_by
CREATE INDEX IF NOT EXISTS idx_record_photos_created_by
  ON public.record_photos(created_by)
  WHERE created_by IS NOT NULL;
