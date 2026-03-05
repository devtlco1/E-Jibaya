-- دالة للحصول على العدد الدقيق للصور في النظام (تتجاوز RLS)
-- تحسب: record_photos + صور المقياس + صور الفاتورة في collection_records

CREATE OR REPLACE FUNCTION get_photo_count()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record_photos BIGINT;
  v_meter_photos BIGINT;
  v_invoice_photos BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_record_photos FROM public.record_photos;
  SELECT COUNT(*) INTO v_meter_photos FROM public.collection_records WHERE meter_photo_url IS NOT NULL AND trim(meter_photo_url) != '';
  SELECT COUNT(*) INTO v_invoice_photos FROM public.collection_records WHERE invoice_photo_url IS NOT NULL AND trim(invoice_photo_url) != '';
  
  RETURN COALESCE(v_record_photos, 0) + COALESCE(v_meter_photos, 0) + COALESCE(v_invoice_photos, 0);
END;
$$;

-- منح صلاحية الاستدعاء
GRANT EXECUTE ON FUNCTION get_photo_count() TO authenticated;
GRANT EXECUTE ON FUNCTION get_photo_count() TO anon;
GRANT EXECUTE ON FUNCTION get_photo_count() TO service_role;
