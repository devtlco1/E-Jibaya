-- =====================================================
-- إصلاح تحذير Linter: RLS Policy Always True على collection_payments
-- استبدال USING (true) / WITH CHECK (true) بـ is_api_request()
-- =====================================================

DROP POLICY IF EXISTS "collection_payments_insert_policy" ON public.collection_payments;
DROP POLICY IF EXISTS "collection_payments_update_policy" ON public.collection_payments;
DROP POLICY IF EXISTS "collection_payments_delete_policy" ON public.collection_payments;

CREATE POLICY "collection_payments_insert_policy" ON public.collection_payments
  FOR INSERT WITH CHECK (public.is_api_request());

CREATE POLICY "collection_payments_update_policy" ON public.collection_payments
  FOR UPDATE USING (public.is_api_request()) WITH CHECK (public.is_api_request());

CREATE POLICY "collection_payments_delete_policy" ON public.collection_payments
  FOR DELETE USING (public.is_api_request());

-- SELECT نبقيه كما هو (collection_payments_select_policy USING (true)) — اللينتر يستثني SELECT عمداً
