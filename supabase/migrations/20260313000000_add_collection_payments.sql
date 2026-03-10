-- إضافة جدول دفعات التحصيل المرتبط بكل سجل جباية
-- يسمح بتخزين كل دفعة (مبلغ) كصف مستقل مع ربطه بسجل المشترك

-- إنشاء جدول collection_payments إذا لم يكن موجوداً
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'collection_payments'
  ) THEN
    CREATE TABLE public.collection_payments (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      -- الربط بالسجل الرئيسي
      record_id UUID NOT NULL REFERENCES public.collection_records(id) ON DELETE CASCADE,
      -- تكرار رقم الحساب للتسهيل في الاستعلامات (اختياري)
      account_number VARCHAR(50),
      -- بيانات الدفعة
      amount NUMERIC(18, 2) NOT NULL,
      collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      collector_id UUID REFERENCES public.users(id),
      -- إحداثيات الموقع لحظة استلام الدفعة (اختيارية)
      gps_latitude DECIMAL(10, 8),
      gps_longitude DECIMAL(11, 8),
      -- ملاحظات حرة
      notes TEXT,
      -- مرفقات الدفعة (صور/مستندات)، بنفس أسلوب التخزين الحر المستخدم في أجزاء أخرى
      attachments JSONB
    );
  END IF;
END $$;

-- فهارس لتحسين الاستعلامات
CREATE INDEX IF NOT EXISTS idx_collection_payments_record_id
  ON public.collection_payments(record_id);

CREATE INDEX IF NOT EXISTS idx_collection_payments_collector_id
  ON public.collection_payments(collector_id);

CREATE INDEX IF NOT EXISTS idx_collection_payments_collected_at
  ON public.collection_payments(collected_at);

-- تفعيل RLS على جدول الدفعات (بنفس الأسلوب البسيط المستخدم في record_photos)
ALTER TABLE public.collection_payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'collection_payments'
      AND policyname = 'collection_payments_select_policy'
  ) THEN
    CREATE POLICY "collection_payments_select_policy" ON public.collection_payments
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'collection_payments'
      AND policyname = 'collection_payments_insert_policy'
  ) THEN
    CREATE POLICY "collection_payments_insert_policy" ON public.collection_payments
      FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'collection_payments'
      AND policyname = 'collection_payments_update_policy'
  ) THEN
    CREATE POLICY "collection_payments_update_policy" ON public.collection_payments
      FOR UPDATE USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'collection_payments'
      AND policyname = 'collection_payments_delete_policy'
  ) THEN
    CREATE POLICY "collection_payments_delete_policy" ON public.collection_payments
      FOR DELETE USING (true);
  END IF;
END $$;

-- تفعيل Realtime على جدول الدفعات (اختياري لكن مفيد للتقارير الحية)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'collection_payments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.collection_payments;
  END IF;
END $$;

