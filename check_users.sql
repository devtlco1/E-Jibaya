-- =====================================================
-- التحقق من المستخدمين الموجودين في قاعدة البيانات
-- =====================================================

-- عرض جميع المستخدمين
SELECT 
    id,
    username,
    full_name,
    role,
    is_active,
    created_at
FROM public.users
ORDER BY created_at DESC;

-- عدد المستخدمين
SELECT COUNT(*) as total_users FROM public.users;

-- التحقق من المستخدم الإدمن
SELECT 
    CASE 
        WHEN EXISTS(SELECT 1 FROM public.users WHERE username = 'admin') 
        THEN '✅ المستخدم admin موجود'
        ELSE '❌ المستخدم admin غير موجود'
    END as admin_status;

-- التحقق من المحصل التجريبي
SELECT 
    CASE 
        WHEN EXISTS(SELECT 1 FROM public.users WHERE username = 'agent1') 
        THEN '✅ المستخدم agent1 موجود'
        ELSE '❌ المستخدم agent1 غير موجود'
    END as agent_status;
