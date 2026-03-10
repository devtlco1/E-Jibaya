-- سجلات ميدانية = فقط السجلات اللي المحصل رفعها من تطبيق الميدان (لا التي أُنشئت من الداشبورد وربطت به)
-- سجلات من الداشبورد = السجلات اللي المستخدم أنشأها من لوحة التحكم (create_record + from_dashboard)

DROP FUNCTION IF EXISTS public.get_users_achievements(text, text);

CREATE OR REPLACE FUNCTION public.get_users_achievements(p_start_date text, p_end_date text)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  username text,
  role text,
  sector text,
  job_title text,
  records_added bigint,
  records_added_dashboard bigint,
  records_completed bigint,
  records_refused bigint,
  records_updated bigint,
  records_verified bigint,
  total_actions bigint,
  last_activity timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz := (p_start_date || 'T00:00:00.000Z')::timestamptz;
  v_end timestamptz := (p_end_date || 'T23:59:59.999Z')::timestamptz;
BEGIN
  RETURN QUERY
  WITH active_users AS (
    SELECT us.id, us.full_name AS u_full_name, us.username AS u_username, us.role AS u_role, us.sector AS u_sector, us.job_title AS u_job_title
    FROM public.users us
    WHERE us.is_active = true
  ),
  -- سجلات ميدانية: فقط سجلات رُفعت من تطبيق المحصل (لا التي أُنشئت من الداشبورد وربطت بمحصل)
  recs_submitted AS (
    SELECT cr.field_agent_id AS uid, COUNT(*)::bigint AS cnt
    FROM public.collection_records cr
    WHERE cr.field_agent_id IS NOT NULL
      AND cr.submitted_at IS NOT NULL
      AND cr.submitted_at >= v_start
      AND cr.submitted_at <= v_end
      AND NOT EXISTS (
        SELECT 1 FROM public.activity_logs al
        WHERE al.target_id = cr.id
          AND al.action = 'create_record'
          AND (al.details->>'from_dashboard') = 'true'
      )
    GROUP BY cr.field_agent_id
  ),
  -- سجلات من الداشبورد: من ضغط "إنشاء سجل" من لوحة التحكم
  recs_dashboard AS (
    SELECT al.user_id AS uid, COUNT(*)::bigint AS cnt
    FROM public.activity_logs al
    WHERE al.user_id IS NOT NULL
      AND al.action = 'create_record'
      AND (al.details->>'from_dashboard') = 'true'
      AND al.created_at >= v_start
      AND al.created_at <= v_end
    GROUP BY al.user_id
  ),
  recs_completed AS (
    SELECT cr.completed_by AS uid,
      COUNT(*) FILTER (WHERE NOT cr.is_refused AND cr.status = 'completed')::bigint AS completed,
      COUNT(*) FILTER (WHERE cr.is_refused OR cr.status = 'refused')::bigint AS refused
    FROM public.collection_records cr
    WHERE cr.completed_by IS NOT NULL
      AND cr.completed_at IS NOT NULL
      AND cr.completed_at >= v_start
      AND cr.completed_at <= v_end
    GROUP BY cr.completed_by
  ),
  recs_updated AS (
    SELECT al.user_id AS uid, COUNT(*)::bigint AS cnt
    FROM public.activity_logs al
    WHERE al.user_id IS NOT NULL
      AND al.action = 'update_record'
      AND al.created_at >= v_start
      AND al.created_at <= v_end
    GROUP BY al.user_id
  ),
  recs_verified AS (
    SELECT al.user_id AS uid, COUNT(DISTINCT al.target_id)::bigint AS cnt
    FROM public.activity_logs al
    WHERE al.user_id IS NOT NULL
      AND al.action = 'verify_record'
      AND (al.target_type IS NULL OR al.target_type = 'record')
      AND al.target_id IS NOT NULL
      AND al.created_at >= v_start
      AND al.created_at <= v_end
    GROUP BY al.user_id
  ),
  last_act AS (
    SELECT al.user_id AS uid, MAX(al.created_at) AS last_ts
    FROM public.activity_logs al
    WHERE al.user_id IS NOT NULL
      AND al.created_at >= v_start
      AND al.created_at <= v_end
    GROUP BY al.user_id
  ),
  last_act_global AS (
    SELECT DISTINCT ON (al.user_id) al.user_id AS uid, al.created_at AS last_ts
    FROM public.activity_logs al
    WHERE al.user_id IS NOT NULL
    ORDER BY al.user_id, al.created_at DESC
  ),
  user_act_count AS (
    SELECT al.user_id AS uid, COUNT(*)::bigint AS cnt
    FROM public.activity_logs al
    WHERE al.user_id IS NOT NULL
      AND al.created_at >= v_start
      AND al.created_at <= v_end
    GROUP BY al.user_id
  )
  SELECT
    u.id,
    u.u_full_name::text,
    u.u_username::text,
    u.u_role::text,
    u.u_sector::text,
    u.u_job_title::text,
    COALESCE(rs.cnt, 0),
    COALESCE(rd.cnt, 0),
    COALESCE(rc.completed, 0),
    COALESCE(rc.refused, 0),
    COALESCE(ru.cnt, 0),
    COALESCE(rv.cnt, 0),
    COALESCE(uac.cnt, 0),
    COALESCE(la.last_ts, lag.last_ts)
  FROM active_users u
  LEFT JOIN recs_submitted rs ON rs.uid = u.id
  LEFT JOIN recs_dashboard rd ON rd.uid = u.id
  LEFT JOIN recs_completed rc ON rc.uid = u.id
  LEFT JOIN recs_updated ru ON ru.uid = u.id
  LEFT JOIN recs_verified rv ON rv.uid = u.id
  LEFT JOIN user_act_count uac ON uac.uid = u.id
  LEFT JOIN last_act la ON la.uid = u.id
  LEFT JOIN last_act_global lag ON lag.uid = u.id
  ORDER BY (COALESCE(rs.cnt, 0) + COALESCE(rd.cnt, 0) + COALESCE(rc.completed, 0) + COALESCE(ru.cnt, 0) + COALESCE(rv.cnt, 0)) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_users_achievements(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_users_achievements(text, text) TO anon;

COMMENT ON FUNCTION public.get_users_achievements(text, text) IS 'سجلات ميدانية = من التطبيق فقط. سجلات من الداشبورد = من ضغط إنشاء سجل. تدقيق = DISTINCT سجلات.';
