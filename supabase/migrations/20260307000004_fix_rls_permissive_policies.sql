-- =====================================================
-- Migration: إصلاح سياسات RLS المسماة "permissive" (always true)
-- يصلح تحذير: RLS Policy Always True
-- =====================================================

-- دالة مساعدة: تتحقق أن الطلب من أدوار API فقط (وليس always true)
CREATE OR REPLACE FUNCTION public.is_api_request()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  jwt_role text;
BEGIN
  BEGIN
    jwt_role := coalesce((current_setting('request.jwt.claims', true)::jsonb)->>'role', 'anon');
  EXCEPTION WHEN OTHERS THEN
    jwt_role := 'anon';
  END;
  RETURN jwt_role IN ('anon', 'authenticated', 'service_role');
END;
$$;

-- users
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
DROP POLICY IF EXISTS "users_update_policy" ON public.users;
DROP POLICY IF EXISTS "users_delete_policy" ON public.users;

CREATE POLICY "users_insert_policy" ON public.users FOR INSERT
  WITH CHECK (public.is_api_request());

CREATE POLICY "users_update_policy" ON public.users FOR UPDATE
  USING (public.is_api_request()) WITH CHECK (public.is_api_request());

CREATE POLICY "users_delete_policy" ON public.users FOR DELETE
  USING (public.is_api_request());

-- collection_records
DROP POLICY IF EXISTS "collection_records_insert_policy" ON public.collection_records;
DROP POLICY IF EXISTS "collection_records_update_policy" ON public.collection_records;
DROP POLICY IF EXISTS "collection_records_delete_policy" ON public.collection_records;

CREATE POLICY "collection_records_insert_policy" ON public.collection_records FOR INSERT
  WITH CHECK (public.is_api_request());

CREATE POLICY "collection_records_update_policy" ON public.collection_records FOR UPDATE
  USING (public.is_api_request()) WITH CHECK (public.is_api_request());

CREATE POLICY "collection_records_delete_policy" ON public.collection_records FOR DELETE
  USING (public.is_api_request());

-- record_photos
DROP POLICY IF EXISTS "record_photos_insert_policy" ON public.record_photos;
DROP POLICY IF EXISTS "record_photos_update_policy" ON public.record_photos;
DROP POLICY IF EXISTS "record_photos_delete_policy" ON public.record_photos;

CREATE POLICY "record_photos_insert_policy" ON public.record_photos FOR INSERT
  WITH CHECK (public.is_api_request());

CREATE POLICY "record_photos_update_policy" ON public.record_photos FOR UPDATE
  USING (public.is_api_request()) WITH CHECK (public.is_api_request());

CREATE POLICY "record_photos_delete_policy" ON public.record_photos FOR DELETE
  USING (public.is_api_request());

-- record_locations
DROP POLICY IF EXISTS "record_locations_insert_policy" ON public.record_locations;
DROP POLICY IF EXISTS "record_locations_update_policy" ON public.record_locations;
DROP POLICY IF EXISTS "record_locations_delete_policy" ON public.record_locations;

CREATE POLICY "record_locations_insert_policy" ON public.record_locations FOR INSERT
  WITH CHECK (public.is_api_request());

CREATE POLICY "record_locations_update_policy" ON public.record_locations FOR UPDATE
  USING (public.is_api_request()) WITH CHECK (public.is_api_request());

CREATE POLICY "record_locations_delete_policy" ON public.record_locations FOR DELETE
  USING (public.is_api_request());

-- activity_logs
DROP POLICY IF EXISTS "activity_logs_insert_policy" ON public.activity_logs;

CREATE POLICY "activity_logs_insert_policy" ON public.activity_logs FOR INSERT
  WITH CHECK (public.is_api_request());

-- user_sessions
DROP POLICY IF EXISTS "user_sessions_insert_policy" ON public.user_sessions;
DROP POLICY IF EXISTS "user_sessions_delete_policy" ON public.user_sessions;

CREATE POLICY "user_sessions_insert_policy" ON public.user_sessions FOR INSERT
  WITH CHECK (public.is_api_request());

CREATE POLICY "user_sessions_delete_policy" ON public.user_sessions FOR DELETE
  USING (public.is_api_request());

-- backup_info
DROP POLICY IF EXISTS "backup_info_insert_policy" ON public.backup_info;
DROP POLICY IF EXISTS "backup_info_update_policy" ON public.backup_info;
DROP POLICY IF EXISTS "backup_info_delete_policy" ON public.backup_info;

CREATE POLICY "backup_info_insert_policy" ON public.backup_info FOR INSERT
  WITH CHECK (public.is_api_request());

CREATE POLICY "backup_info_update_policy" ON public.backup_info FOR UPDATE
  USING (public.is_api_request()) WITH CHECK (public.is_api_request());

CREATE POLICY "backup_info_delete_policy" ON public.backup_info FOR DELETE
  USING (public.is_api_request());

-- backup_logs
DROP POLICY IF EXISTS "backup_logs_insert_policy" ON public.backup_logs;
DROP POLICY IF EXISTS "backup_logs_update_policy" ON public.backup_logs;
DROP POLICY IF EXISTS "backup_logs_delete_policy" ON public.backup_logs;

CREATE POLICY "backup_logs_insert_policy" ON public.backup_logs FOR INSERT
  WITH CHECK (public.is_api_request());

CREATE POLICY "backup_logs_update_policy" ON public.backup_logs FOR UPDATE
  USING (public.is_api_request()) WITH CHECK (public.is_api_request());

CREATE POLICY "backup_logs_delete_policy" ON public.backup_logs FOR DELETE
  USING (public.is_api_request());

-- branch_manager_field_agents (من migration 20260307000003)
DROP POLICY IF EXISTS "branch_manager_field_agents_insert" ON public.branch_manager_field_agents;
DROP POLICY IF EXISTS "branch_manager_field_agents_delete" ON public.branch_manager_field_agents;

CREATE POLICY "branch_manager_field_agents_insert" ON public.branch_manager_field_agents FOR INSERT
  TO anon, authenticated, service_role
  WITH CHECK (public.is_api_request());

CREATE POLICY "branch_manager_field_agents_delete" ON public.branch_manager_field_agents FOR DELETE
  TO anon, authenticated, service_role
  USING (public.is_api_request());

-- branch_manager_employees
DROP POLICY IF EXISTS "branch_manager_employees_insert" ON public.branch_manager_employees;
DROP POLICY IF EXISTS "branch_manager_employees_delete" ON public.branch_manager_employees;

CREATE POLICY "branch_manager_employees_insert" ON public.branch_manager_employees FOR INSERT
  TO anon, authenticated, service_role
  WITH CHECK (public.is_api_request());

CREATE POLICY "branch_manager_employees_delete" ON public.branch_manager_employees FOR DELETE
  TO anon, authenticated, service_role
  USING (public.is_api_request());
