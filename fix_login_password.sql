-- =====================================================
-- إصلاح كلمة مرور المستخدم الإدمن
-- =====================================================

-- حذف المستخدم الإدمن الحالي
DELETE FROM public.users WHERE username = 'admin';

-- إدراج المستخدم الإدمن بكلمة مرور صحيحة
-- كلمة المرور: admin123 (مشفرة)
INSERT INTO public.users (id, username, password_hash, full_name, role, is_active) VALUES
('ba7a2d56-daa7-44d5-9b90-80a9843be1c1', 'admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'مدير النظام', 'admin', true);

-- إدراج محصل تجريبي بكلمة مرور صحيحة
-- كلمة المرور: agent123 (مشفرة)
INSERT INTO public.users (username, password_hash, full_name, role, is_active) VALUES
('agent1', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'محصل تجريبي', 'field_agent', true);

SELECT '✅ تم إصلاح كلمات المرور!' as result,
       'المستخدم الإدمن: admin' as admin,
       'كلمة المرور: admin123' as admin_password,
       'المحصل التجريبي: agent1' as agent,
       'كلمة المرور: agent123' as agent_password;
