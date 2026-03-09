-- =====================================================
-- تحديد سجل الحركات: أقصى ٥٠٠٠ حركة (الأحدث يبقى)
-- عند تجاوز العدد يُحذف الأقدم تلقائياً
-- =====================================================

-- دالة حذف الحركات الأقدم والإبقاء على آخر ٥٠٠٠ فقط
CREATE OR REPLACE FUNCTION public.trim_activity_logs(max_count int DEFAULT 5000)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  excess int;
  deleted int;
BEGIN
  SELECT COUNT(*) - max_count INTO excess FROM public.activity_logs;
  IF excess <= 0 THEN RETURN 0; END IF;

  WITH to_delete AS (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
      FROM public.activity_logs
    ) sub
    WHERE rn <= excess
  )
  DELETE FROM public.activity_logs WHERE id IN (SELECT id FROM to_delete);
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

COMMENT ON FUNCTION public.trim_activity_logs(int) IS 'يحذف أقدم سجلات النشاط ويبقي آخر max_count حركة (افتراضي 5000)';

-- تشغيل الدالة الآن لتنظيف البيانات الحالية
SELECT public.trim_activity_logs(5000);

-- تريجر: بعد كل إضافة حركة، إن زاد العدد عن ٥٠٠٠ يُحذف الأقدم
CREATE OR REPLACE FUNCTION public.trigger_trim_activity_logs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.trim_activity_logs(5000);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS after_activity_log_insert_trim ON public.activity_logs;
CREATE TRIGGER after_activity_log_insert_trim
  AFTER INSERT ON public.activity_logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trigger_trim_activity_logs();
