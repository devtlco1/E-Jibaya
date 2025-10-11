-- الحصول على User ID صحيح للاختبار
-- قم بتشغيل هذا الكود في Supabase SQL Editor

-- عرض جميع المستخدمين المتاحين
SELECT 
    id,
    username,
    full_name,
    role,
    is_active,
    created_at
FROM users
WHERE is_active = true
ORDER BY created_at DESC;

-- الحصول على أول مستخدم نشط للاختبار
SELECT 
    id as valid_user_id,
    username,
    full_name,
    role
FROM users
WHERE is_active = true
LIMIT 1;
