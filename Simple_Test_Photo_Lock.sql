-- اختبار بسيط لقفل مقارنة الصور
-- قم بتشغيل هذا الكود في Supabase SQL Editor

-- عرض السجلات مع حالة القفل
SELECT 
    id,
    subscriber_name,
    account_number,
    CASE 
        WHEN locked_by IS NOT NULL THEN '🔒 مقفل للتعديل'
        WHEN photo_viewing_by IS NOT NULL THEN '📷 مقفل لمقارنة الصور'
        ELSE '✅ متاح'
    END as status,
    locked_by,
    photo_viewing_by
FROM collection_records
ORDER BY updated_at DESC
LIMIT 5;

-- عرض المستخدمين المتاحين
SELECT 
    id,
    username,
    full_name,
    role
FROM users
WHERE is_active = true
LIMIT 3;
