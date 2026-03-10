-- قائمة أرقام السجلات المميزة في النظام (للقائمة المنسدلة في فلتر سجلات المشتركين)

CREATE OR REPLACE FUNCTION public.get_distinct_record_numbers()
RETURNS TABLE (record_number text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT (cr.record_number)::text
  FROM public.collection_records cr
  WHERE cr.record_number IS NOT NULL
    AND TRIM(cr.record_number) <> ''
  ORDER BY 1;
$$;

COMMENT ON FUNCTION public.get_distinct_record_numbers() IS 'أرقام السجلات المميزة لاستخدامها في فلتر القائمة المنسدلة';
GRANT EXECUTE ON FUNCTION public.get_distinct_record_numbers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_distinct_record_numbers() TO anon;
