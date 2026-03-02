-- نفّذ هذا في Supabase SQL Editor لتفعيل الإنجازات الصحيحة
-- إنجازات المستخدمين عبر RPC - تجميع في قاعدة البيانات بدون حد للصفوف

CREATE OR REPLACE FUNCTION public.get_users_achievements(p_start_date text, p_end_date text)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  username text,
  role text,
  records_added bigint,
  records_added_dashboard bigint,
  records_completed bigint,
  records_refused bigint,
  records_updated bigint,
  total_actions bigint,
  last_activity timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start timestamptz := (p_start_date || 'T00:00:00.000Z')::timestamptz;
  v_end timestamptz := (p_end_date || 'T23:59:59.999Z')::timestamptz;
BEGIN
  RETURN QUERY
  WITH active_users AS (
    SELECT id, full_name, username, role
    FROM public.users
    WHERE is_active = true
  ),
  recs_submitted AS (
    SELECT cr.field_agent_id AS uid, COUNT(*)::bigint AS cnt
    FROM public.collection_records cr
    WHERE cr.field_agent_id IS NOT NULL
      AND cr.submitted_at IS NOT NULL
      AND cr.submitted_at >= v_start
      AND cr.submitted_at <= v_end
    GROUP BY cr.field_agent_id
  ),
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
    u.full_name::text,
    u.username::text,
    u.role::text,
    COALESCE(rs.cnt, 0),
    COALESCE(rd.cnt, 0),
    COALESCE(rc.completed, 0),
    COALESCE(rc.refused, 0),
    COALESCE(ru.cnt, 0),
    COALESCE(uac.cnt, 0),
    COALESCE(la.last_ts, lag.last_ts)
  FROM active_users u
  LEFT JOIN recs_submitted rs ON rs.uid = u.id
  LEFT JOIN recs_dashboard rd ON rd.uid = u.id
  LEFT JOIN recs_completed rc ON rc.uid = u.id
  LEFT JOIN recs_updated ru ON ru.uid = u.id
  LEFT JOIN user_act_count uac ON uac.uid = u.id
  LEFT JOIN last_act la ON la.uid = u.id
  LEFT JOIN last_act_global lag ON lag.uid = u.id
  ORDER BY (COALESCE(rs.cnt, 0) + COALESCE(rd.cnt, 0) + COALESCE(rc.completed, 0) + COALESCE(ru.cnt, 0)) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_users_achievements(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_users_achievements(text, text) TO anon;
