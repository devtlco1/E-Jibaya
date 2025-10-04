-- =====================================================
-- إنشاء المستخدمين نهائياً - E-Jibaya Users
-- =====================================================

-- حذف جميع المستخدمين الموجودين
DELETE FROM public.users;

-- إدراج المستخدم الإدمن
INSERT INTO public.users (id, username, password_hash, full_name, role, is_active) VALUES
('ba7a2d56-daa7-44d5-9b90-80a9843be1c1', 'admin', '$2b$12$FeKHxDzVWSOg8Io8wNo36e60s.4sPZJwhTInRjnmqV7TmhvYDs7KW', 'مدير النظام', 'admin', true);

-- إدراج المحصل التجريبي
INSERT INTO public.users (username, password_hash, full_name, role, is_active) VALUES
('agent1', '$2b$12$Cu5p19pLu6AyDOCXRtNKv.aYN3n5YhO20Dz8gGgXxkGZGwVHIZx4G', 'محصل تجريبي', 'field_agent', true);

-- التحقق من النتائج
SELECT 
    '✅ تم إنشاء المستخدمين بنجاح!' as result,
    COUNT(*) as total_users
FROM public.users;

-- عرض المستخدمين الموجودين
SELECT 
    username,
    full_name,
    role,
    is_active,
    created_at
FROM public.users
ORDER BY created_at DESC;
