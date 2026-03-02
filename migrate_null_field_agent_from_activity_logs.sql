-- =====================================================
-- Migration: تعيين field_agent_id للسجلات ذات القيمة NULL
-- يعتمد على activity_logs لمعرفة من أنشأ السجل من الداشبورد
-- =====================================================

-- تحديث السجلات التي field_agent_id = null بناءً على سجل النشاط (create_record)
UPDATE public.collection_records cr
SET field_agent_id = sub.creator_id
FROM (
  SELECT 
    al.target_id as record_id,
    al.user_id as creator_id,
    ROW_NUMBER() OVER (PARTITION BY al.target_id ORDER BY al.created_at DESC) as rn
  FROM public.activity_logs al
  WHERE al.action = 'create_record'
    AND al.target_type = 'record'
    AND al.user_id IS NOT NULL
) sub
WHERE cr.id = sub.record_id
  AND sub.rn = 1
  AND cr.field_agent_id IS NULL;
