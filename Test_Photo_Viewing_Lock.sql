-- اختبار قفل مقارنة الصور
-- قم بتشغيل هذا الكود في Supabase SQL Editor

-- عرض السجلات مع حالة قفل مقارنة الصور
SELECT 
    id,
    subscriber_name,
    account_number,
    locked_by,
    locked_at,
    photo_viewing_by,
    photo_viewing_at,
    CASE 
        WHEN locked_by IS NOT NULL THEN '🔒 مقفل للتعديل'
        WHEN photo_viewing_by IS NOT NULL THEN '📷 مقفل لمقارنة الصور'
        ELSE '✅ متاح'
    END as status
FROM collection_records
ORDER BY updated_at DESC
LIMIT 10;

-- اختبار تحديث قفل مقارنة الصور
DO $$
DECLARE
    test_record_id UUID;
    valid_user_id UUID;
BEGIN
    -- الحصول على أول سجل للاختبار
    SELECT id INTO test_record_id 
    FROM collection_records 
    LIMIT 1;
    
    -- الحصول على أول مستخدم نشط للاختبار
    SELECT id INTO valid_user_id
    FROM users 
    WHERE is_active = true 
    LIMIT 1;
    
    IF test_record_id IS NOT NULL AND valid_user_id IS NOT NULL THEN
        -- تحديث قفل مقارنة الصور
        UPDATE collection_records 
        SET 
            photo_viewing_by = valid_user_id,
            photo_viewing_at = NOW()
        WHERE id = test_record_id;
        
        RAISE NOTICE '✅ Updated photo viewing lock for record: % with user: %', test_record_id, valid_user_id;
        
        -- عرض النتيجة
        SELECT 
            cr.id,
            cr.subscriber_name,
            cr.photo_viewing_by,
            cr.photo_viewing_at,
            u.username,
            u.full_name
        FROM collection_records cr
        LEFT JOIN users u ON cr.photo_viewing_by = u.id
        WHERE cr.id = test_record_id;
    ELSE
        RAISE NOTICE '❌ No records or users found for testing';
    END IF;
END $$;

-- عرض إحصائيات القفل
SELECT 
    COUNT(*) as total_records,
    COUNT(locked_by) as locked_for_editing,
    COUNT(photo_viewing_by) as locked_for_photos,
    COUNT(CASE WHEN locked_by IS NULL AND photo_viewing_by IS NULL THEN 1 END) as available
FROM collection_records;
