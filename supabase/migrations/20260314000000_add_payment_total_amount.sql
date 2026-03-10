-- سجل الدفعات: كل صف = ما أدخله المحصل (المجموع المطلوب + المبلغ المستلم) بدون تراكم
-- إضافة عمود المجموع المطلوب لكل دفعة

ALTER TABLE public.collection_payments
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(18, 2) NULL;

COMMENT ON COLUMN public.collection_payments.total_amount IS 'المجموع المطلوب كما أدخله المحصل لهذه الدفعة (سجل فقط، بدون جمع)';
