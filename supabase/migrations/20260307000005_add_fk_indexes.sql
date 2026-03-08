-- =====================================================
-- Migration: إضافة فهارس للمفاتيح الأجنبية غير المفهرسة
-- يصلح تحذير: Unindexed foreign keys (أداء أفضل للـ JOINs)
-- =====================================================

-- branch_manager_employees.created_by
CREATE INDEX IF NOT EXISTS idx_branch_manager_employees_created_by
  ON public.branch_manager_employees(created_by)
  WHERE created_by IS NOT NULL;

-- branch_manager_field_agents.created_by
CREATE INDEX IF NOT EXISTS idx_branch_manager_field_agents_created_by
  ON public.branch_manager_field_agents(created_by)
  WHERE created_by IS NOT NULL;

-- user_sessions.user_id
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
  ON public.user_sessions(user_id);
