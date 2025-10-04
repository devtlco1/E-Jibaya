-- =====================================================
-- إصلاح hash كلمات المرور
-- =====================================================

-- حذف المستخدمين الحاليين
DELETE FROM public.users WHERE username IN ('admin', 'agent1');

-- إدراج المستخدم الإدمن بكلمة مرور صحيحة
-- كلمة المرور: admin123 (مشفرة بـ bcrypt saltRounds=12)
INSERT INTO public.users (id, username, password_hash, full_name, role, is_active) VALUES
('ba7a2d56-daa7-44d5-9b90-80a9843be1c1', 'admin', '$2b$12$FeKHxDzVWSOg8Io8wNo36e60s.4sPZJwhTInRjnmqV7TmhvYDs7KW', 'مدير النظام', 'admin', true);

-- إدراج محصل تجريبي بكلمة مرور صحيحة
-- كلمة المرور: agent123 (مشفرة بـ bcrypt saltRounds=12)
INSERT INTO public.users (username, password_hash, full_name, role, is_active) VALUES
('agent1', '$2b$12$Cu5p19pLu6AyDOCXRtNKv.aYN3n5YhO20Dz8gGgXxkGZGwVHIZx4G', 'محصل تجريبي', 'field_agent', true);

SELECT '✅ تم إصلاح hash كلمات المرور!' as result,
       'المستخدم الإدمن: admin' as admin,
       'كلمة المرور: admin123' as admin_password,
       'المحصل التجريبي: agent1' as agent,
       'كلمة المرور: agent123' as agent_password;
