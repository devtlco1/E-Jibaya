-- =====================================================
-- إزالة السجلات المكررة (نفس رقم الحساب)
-- يُبقي السجل الأكثر اكتمالاً (صور، مبالغ، إرسال) ويحذف الباقي
-- =====================================================
-- تشغيل: من Supabase SQL Editor أو: psql ... -f scripts/remove_duplicate_records_keep_fullest.sql
-- يُفضّل عمل نسخة احتياطية قبل التشغيل.
-- =====================================================

DO $$
DECLARE
  v_ids_to_delete uuid[];
  v_count_duplicates int;
  v_count_deleted int;
BEGIN
  -- 1) تحديد هويات السجلات المكررة التي سنحذفها (نحتفظ بالأفضل لكل رقم حساب)
  WITH
  normalized AS (
    SELECT
      id,
      TRIM(COALESCE(account_number::text, '')) AS acc,
      -- درجة الاكتمال: صور ومبالغ وإرسال
      (CASE WHEN meter_photo_url IS NOT NULL AND TRIM(COALESCE(meter_photo_url, '')) <> '' THEN 2 ELSE 0 END) +
      (CASE WHEN invoice_photo_url IS NOT NULL AND TRIM(COALESCE(invoice_photo_url, '')) <> '' THEN 2 ELSE 0 END) +
      (CASE WHEN invoice_photo_back_url IS NOT NULL AND TRIM(COALESCE(invoice_photo_back_url, '')) <> '' THEN 1 ELSE 0 END) +
      (CASE WHEN total_amount IS NOT NULL AND total_amount > 0 THEN 1 ELSE 0 END) +
      (CASE WHEN current_amount IS NOT NULL AND current_amount > 0 THEN 1 ELSE 0 END) +
      (CASE WHEN submitted_at IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN last_reading IS NOT NULL AND TRIM(COALESCE(last_reading::text, '')) <> '' THEN 1 ELSE 0 END)
        AS score,
      COALESCE(updated_at, submitted_at, created_at) AS sort_ts
    FROM public.collection_records
    WHERE TRIM(COALESCE(account_number::text, '')) <> ''
  ),
  dup_groups AS (
    SELECT acc
    FROM normalized
    GROUP BY acc
    HAVING COUNT(*) > 1
  ),
  ranked AS (
    SELECT
      n.id,
      n.acc,
      ROW_NUMBER() OVER (
        PARTITION BY n.acc
        ORDER BY n.score DESC, n.sort_ts DESC NULLS LAST
      ) AS rn
    FROM normalized n
    JOIN dup_groups d ON d.acc = n.acc
  )
  SELECT
    ARRAY_AGG(r.id ORDER BY r.id),
    COUNT(*)
  INTO v_ids_to_delete, v_count_duplicates
  FROM ranked r
  WHERE r.rn > 1;

  IF v_ids_to_delete IS NULL OR array_length(v_ids_to_delete, 1) IS NULL THEN
    RAISE NOTICE 'لا توجد سجلات مكررة (نفس رقم الحساب) لحذفها.';
    RETURN;
  END IF;

  RAISE NOTICE 'عدد السجلات المكررة المحددة للحذف: %', v_count_duplicates;

  -- 2) حذف سجلات النشاط المرتبطة بهذه السجلات (target_id لا يملك CASCADE)
  DELETE FROM public.activity_logs
  WHERE target_type = 'record'
    AND target_id = ANY(v_ids_to_delete);
  GET DIAGNOSTICS v_count_deleted = ROW_COUNT;
  RAISE NOTICE 'تم حذف % سجل نشاط مرتبط بالسجلات المكررة.', v_count_deleted;

  -- 3) حذف السجلات المكررة (record_photos و record_locations و record_changes_log لديها ON DELETE CASCADE)
  DELETE FROM public.collection_records
  WHERE id = ANY(v_ids_to_delete);
  GET DIAGNOSTICS v_count_deleted = ROW_COUNT;
  RAISE NOTICE 'تم حذف % سجل مكرر من collection_records.', v_count_deleted;
END;
$$;
