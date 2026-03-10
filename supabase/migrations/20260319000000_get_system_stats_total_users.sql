-- إضافة total_users إلى get_system_stats لاستخدامها في صفحة النسخ الاحتياطي (الكاردات)
-- الدالة كانت تُرجع active_users فقط والواجهة تقرأ total_users فكان يظهر 0

DROP FUNCTION IF EXISTS public.get_system_stats();

CREATE OR REPLACE FUNCTION public.get_system_stats()
RETURNS TABLE (
  total_users bigint,
  active_users bigint,
  total_records bigint,
  pending_records bigint,
  completed_records bigint,
  refused_records bigint,
  verified_records bigint,
  unverified_records bigint,
  locked_records bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM public.users),
    (SELECT COUNT(*) FROM public.users WHERE is_active = true),
    (SELECT COUNT(*) FROM public.collection_records),
    (SELECT COUNT(*) FROM public.collection_records WHERE status = 'pending'),
    (SELECT COUNT(*) FROM public.collection_records WHERE status = 'completed'),
    (SELECT COUNT(*) FROM public.collection_records WHERE status = 'refused'),
    (SELECT COUNT(*) FROM public.collection_records WHERE verification_status = 'مدقق'),
    (SELECT COUNT(*) FROM public.collection_records WHERE verification_status = 'غير مدقق'),
    (SELECT COUNT(*) FROM public.collection_records
     WHERE locked_by IS NOT NULL
       AND lock_expires_at IS NOT NULL
       AND lock_expires_at > NOW());
$$;

COMMENT ON FUNCTION public.get_system_stats() IS 'إحصائيات النظام — total_users + active_users + سجلات ومدققين ومقفلة';
