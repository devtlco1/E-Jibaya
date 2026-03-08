-- =====================================================
-- Migration: تفعيل RLS على جداول مدير الفرع
-- يصلح تحذير: RLS Disabled in Public
-- =====================================================

-- 1. branch_manager_field_agents
ALTER TABLE public.branch_manager_field_agents ENABLE ROW LEVEL SECURITY;

-- سياسات القراءة والإدخال والحذف (التطبيق يستخدم anon/authenticated)
CREATE POLICY "branch_manager_field_agents_select"
  ON public.branch_manager_field_agents FOR SELECT
  TO anon, authenticated, service_role
  USING (true);

CREATE POLICY "branch_manager_field_agents_insert"
  ON public.branch_manager_field_agents FOR INSERT
  TO anon, authenticated, service_role
  WITH CHECK (true);

CREATE POLICY "branch_manager_field_agents_delete"
  ON public.branch_manager_field_agents FOR DELETE
  TO anon, authenticated, service_role
  USING (true);

-- 2. branch_manager_employees
ALTER TABLE public.branch_manager_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branch_manager_employees_select"
  ON public.branch_manager_employees FOR SELECT
  TO anon, authenticated, service_role
  USING (true);

CREATE POLICY "branch_manager_employees_insert"
  ON public.branch_manager_employees FOR INSERT
  TO anon, authenticated, service_role
  WITH CHECK (true);

CREATE POLICY "branch_manager_employees_delete"
  ON public.branch_manager_employees FOR DELETE
  TO anon, authenticated, service_role
  USING (true);
