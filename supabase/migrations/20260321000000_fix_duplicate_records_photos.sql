-- إصلاح السجلات المكررة مع الصور القديمة
-- الفكرة:
-- 1) لكل رقم حساب مكرر في collection_records:
--    - نحدد سجل "أساسي" نحتفظ به (الأولوية للسجل الذي يحتوي صور).
--    - ننقل أي صور إضافية record_photos من السجلات الأخرى إلى السجل الأساسي.
--    - ندمج بعض الحقول النصية من السجلات الأخرى إلى السجل الأساسي (بدون مسح قيم موجودة).
--    - نحذف السجلات الزائدة حتى يبقى سجل واحد فقط لكل رقم حساب.
-- 2) هذا السكربت يُشغَّل مرة واحدة كـ migration لإصلاح الدمجات القديمة.

DO $$
DECLARE
  rec RECORD;
  rec_dups RECORD;
  v_keep_id uuid;
  v_remove_id uuid;
BEGIN
  -- المرور على كل رقم حساب مكرر
  FOR rec IN
    SELECT account_number
    FROM public.collection_records
    WHERE account_number IS NOT NULL AND account_number <> ''
    GROUP BY account_number
    HAVING COUNT(*) > 1
  LOOP
    -- اختيار السجل الذي سنحتفظ به:
    -- أولوية للسجل الذي يحتوي صور (روابط أو record_photos)، ثم الأحدث تحديثاً.
    SELECT id
    INTO v_keep_id
    FROM (
      SELECT
        r.id,
        (CASE
           WHEN r.meter_photo_url IS NOT NULL
             OR r.invoice_photo_url IS NOT NULL
             OR r.invoice_photo_back_url IS NOT NULL
             OR EXISTS (SELECT 1 FROM public.record_photos p WHERE p.record_id = r.id)
           THEN 1 ELSE 0
         END) AS has_photos,
        COALESCE(r.updated_at, r.created_at, now()) AS sort_ts
      FROM public.collection_records r
      WHERE r.account_number = rec.account_number
    ) t
    ORDER BY has_photos DESC, sort_ts DESC
    LIMIT 1;

    -- في حال لم نجد سجل لأي سبب، نكمل
    IF v_keep_id IS NULL THEN
      CONTINUE;
    END IF;

    -- المرور على بقية السجلات لنفس رقم الحساب (غير السجل الأساسي)
    FOR rec_dups IN
      SELECT r.*
      FROM public.collection_records r
      WHERE r.account_number = rec.account_number
        AND r.id <> v_keep_id
    LOOP
      v_remove_id := rec_dups.id;

      -- 1) تحديث السجل الأساسي ببعض الحقول من السجل الذي سيتم حذفه
      --    نستخدم COALESCE بحيث لا نمسح قيمة موجودة في السجل الأساسي.
      UPDATE public.collection_records AS keep
      SET
        subscriber_name = COALESCE(keep.subscriber_name, rec_dups.subscriber_name),
        record_number   = COALESCE(keep.record_number,   rec_dups.record_number),
        meter_number    = COALESCE(keep.meter_number,    rec_dups.meter_number),
        region          = COALESCE(keep.region,          rec_dups.region),
        district        = COALESCE(keep.district,        rec_dups.district),
        last_reading    = COALESCE(keep.last_reading,    rec_dups.last_reading),
        new_zone        = COALESCE(keep.new_zone,        rec_dups.new_zone),
        new_block       = COALESCE(keep.new_block,       rec_dups.new_block),
        new_home        = COALESCE(keep.new_home,        rec_dups.new_home),
        category        = COALESCE(keep.category,        rec_dups.category),
        phase           = COALESCE(keep.phase,           rec_dups.phase),
        multiplier      = COALESCE(keep.multiplier,      rec_dups.multiplier),
        total_amount    = COALESCE(keep.total_amount,    rec_dups.total_amount),
        current_amount  = COALESCE(keep.current_amount,  rec_dups.current_amount),
        land_status     = COALESCE(keep.land_status,     rec_dups.land_status),
        status          = COALESCE(keep.status,          rec_dups.status),
        field_agent_id  = COALESCE(keep.field_agent_id,  rec_dups.field_agent_id),
        meter_photo_url        = COALESCE(keep.meter_photo_url,        rec_dups.meter_photo_url),
        invoice_photo_url      = COALESCE(keep.invoice_photo_url,      rec_dups.invoice_photo_url),
        invoice_photo_back_url = COALESCE(keep.invoice_photo_back_url, rec_dups.invoice_photo_back_url)
      WHERE keep.id = v_keep_id;

      -- 2) نقل الصور الإضافية record_photos إلى السجل الأساسي
      UPDATE public.record_photos
      SET record_id = v_keep_id
      WHERE record_id = v_remove_id;

      -- 3) (اختياري) نقل الدفعات حتى لو كانت مربوطة بالسجل الآخر
      UPDATE public.collection_payments
      SET record_id = v_keep_id,
          account_number = rec.account_number
      WHERE record_id = v_remove_id;

      -- 4) نقل record_locations (إن وجدت)
      UPDATE public.record_locations
      SET record_id = v_keep_id
      WHERE record_id = v_remove_id;

      -- 5) نقل سجل التغييرات إلى السجل الأساسي للحفاظ على التاريخ
      UPDATE public.record_changes_log
      SET record_id = v_keep_id
      WHERE record_id = v_remove_id;

      -- 6) في النهاية نحذف السجل الزائد
      DELETE FROM public.collection_records
      WHERE id = v_remove_id;
    END LOOP;
  END LOOP;
END;
$$;

