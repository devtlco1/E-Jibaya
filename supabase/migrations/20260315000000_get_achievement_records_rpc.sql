-- جلب قائمة السجلات المرتبطة بإنجاز مستخدم (مدقق / مضاف / محدث ...) لعرضها عند النقر على الرقم
-- p_type: records_added | records_added_dashboard | records_completed | records_refused | records_updated | records_verified

CREATE OR REPLACE FUNCTION public.get_achievement_records(
  p_user_id uuid,
  p_type text,
  p_start_date text,
  p_end_date text
)
RETURNS TABLE (
  record_id uuid,
  account_number text,
  subscriber_name text,
  action_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz := (p_start_date || 'T00:00:00.000Z')::timestamptz;
  v_end timestamptz := (p_end_date || 'T23:59:59.999Z')::timestamptz;
BEGIN
  -- سجلات ميدانية (أنشأها المحصل من التطبيق)
  IF p_type = 'records_added' THEN
    RETURN QUERY
    SELECT cr.id, cr.account_number::text, cr.subscriber_name::text, cr.submitted_at
    FROM public.collection_records cr
    WHERE cr.field_agent_id = p_user_id
      AND cr.submitted_at IS NOT NULL
      AND cr.submitted_at >= v_start
      AND cr.submitted_at <= v_end
      AND EXISTS (
        SELECT 1 FROM public.activity_logs al
        WHERE al.target_id = cr.id
          AND al.action = 'create_record'
          AND (al.details->>'from_dashboard') IS DISTINCT FROM 'true'
          AND al.user_id = p_user_id
      )
    ORDER BY cr.submitted_at DESC;
    RETURN;
  END IF;

  -- سجلات من الداشبورد
  IF p_type = 'records_added_dashboard' THEN
    RETURN QUERY
    SELECT (al.target_id)::uuid, cr.account_number::text, cr.subscriber_name::text, al.created_at
    FROM public.activity_logs al
    LEFT JOIN public.collection_records cr ON cr.id = (al.target_id)::uuid
    WHERE al.user_id = p_user_id
      AND al.action = 'create_record'
      AND (al.details->>'from_dashboard') = 'true'
      AND al.created_at >= v_start
      AND al.created_at <= v_end
    ORDER BY al.created_at DESC;
    RETURN;
  END IF;

  -- سجلات مكتملة
  IF p_type = 'records_completed' THEN
    RETURN QUERY
    SELECT cr.id, cr.account_number::text, cr.subscriber_name::text, cr.completed_at
    FROM public.collection_records cr
    WHERE cr.completed_by = p_user_id
      AND cr.completed_at IS NOT NULL
      AND cr.completed_at >= v_start
      AND cr.completed_at <= v_end
      AND NOT cr.is_refused
      AND cr.status = 'completed'
    ORDER BY cr.completed_at DESC;
    RETURN;
  END IF;

  -- سجلات امتناع
  IF p_type = 'records_refused' THEN
    RETURN QUERY
    SELECT cr.id, cr.account_number::text, cr.subscriber_name::text, cr.completed_at
    FROM public.collection_records cr
    WHERE cr.completed_by = p_user_id
      AND cr.completed_at IS NOT NULL
      AND cr.completed_at >= v_start
      AND cr.completed_at <= v_end
      AND (cr.is_refused OR cr.status = 'refused')
    ORDER BY cr.completed_at DESC;
    RETURN;
  END IF;

  -- تحديثات (update_record أو edit_record)
  IF p_type = 'records_updated' THEN
    RETURN QUERY
    SELECT DISTINCT ON ((al.target_id)::uuid) (al.target_id)::uuid, cr.account_number::text, cr.subscriber_name::text, al.created_at
    FROM public.activity_logs al
    LEFT JOIN public.collection_records cr ON cr.id = (al.target_id)::uuid
    WHERE al.user_id = p_user_id
      AND al.action IN ('update_record', 'edit_record')
      AND al.target_id IS NOT NULL
      AND al.created_at >= v_start
      AND al.created_at <= v_end
    ORDER BY (al.target_id)::uuid, al.created_at DESC;
    RETURN;
  END IF;

  -- تدقيق
  IF p_type = 'records_verified' THEN
    RETURN QUERY
    SELECT DISTINCT ON ((al.target_id)::uuid) (al.target_id)::uuid, cr.account_number::text, cr.subscriber_name::text, al.created_at
    FROM public.activity_logs al
    LEFT JOIN public.collection_records cr ON cr.id = (al.target_id)::uuid
    WHERE al.user_id = p_user_id
      AND al.action = 'verify_record'
      AND (al.target_type IS NULL OR al.target_type = 'record')
      AND al.target_id IS NOT NULL
      AND al.created_at >= v_start
      AND al.created_at <= v_end
    ORDER BY (al.target_id)::uuid, al.created_at DESC;
    RETURN;
  END IF;

  RETURN;
END;
$$;

COMMENT ON FUNCTION public.get_achievement_records(uuid, text, text, text) IS 'قائمة السجلات المرتبطة بإنجاز مستخدم (للنقر على الرقم في شاشة الإنجازات)';
GRANT EXECUTE ON FUNCTION public.get_achievement_records(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_achievement_records(uuid, text, text, text) TO anon;
