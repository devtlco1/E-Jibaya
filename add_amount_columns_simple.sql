-- كود بسيط لإضافة أعمدة المبالغ
-- فقط انسخ والصق في Supabase SQL Editor

ALTER TABLE public.collection_records
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(15, 2) NULL;

ALTER TABLE public.collection_records
ADD COLUMN IF NOT EXISTS current_amount DECIMAL(15, 2) NULL;

