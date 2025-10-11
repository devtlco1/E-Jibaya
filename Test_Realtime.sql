-- اختبار Real-time
-- قم بتشغيل هذا الكود في Supabase SQL Editor

-- إدراج سجل تجريبي لاختبار Real-time
INSERT INTO collection_records (
    subscriber_name, 
    account_number, 
    meter_number, 
    region, 
    last_reading, 
    status,
    field_agent_id
) VALUES (
    'اختبار Real-time', 
    '123456', 
    '789', 
    'منطقة تجريبية', 
    '1000', 
    'pending',
    (SELECT id FROM users WHERE role = 'field_agent' LIMIT 1)
);

-- حذف السجل التجريبي بعد الاختبار
DELETE FROM collection_records 
WHERE subscriber_name = 'اختبار Real-time';
