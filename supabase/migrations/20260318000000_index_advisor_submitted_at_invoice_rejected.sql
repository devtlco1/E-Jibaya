-- =====================================================
-- فهارس مقترحة من تقرير أداء قواعد البيانات (Index Advisor)
-- مصدر: Supabase Database → Reports → Query Performance
-- =====================================================

-- 1. submitted_at DESC — لاستعلام القائمة: ORDER BY submitted_at DESC LIMIT/OFFSET
-- يقلل تكلفة الترتيب ويحسّن زمن تحميل الصفحة الأولى
CREATE INDEX IF NOT EXISTS idx_collection_records_submitted_at_desc
  ON public.collection_records(submitted_at DESC NULLS LAST);

-- 2. invoice_photo_rejected — مقترح من Index Advisor لتحسين الاستعلامات التي تفلتر على هذا العمود
CREATE INDEX IF NOT EXISTS idx_collection_records_invoice_photo_rejected
  ON public.collection_records(invoice_photo_rejected)
  WHERE invoice_photo_rejected IS NOT NULL;
