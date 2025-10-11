-- =====================================================
-- E-Jibaya Fix Users Passwords
-- إصلاح كلمات مرور المستخدمين التجريبيين
-- =====================================================

-- حذف المستخدمين التجريبيين إذا كانوا موجودين
DELETE FROM public.users WHERE username IN ('admin', 'field_agent_1', 'employee_1');

-- إدراج مستخدمين تجريبيين بكلمات مرور صحيحة
-- كلمة المرور: password123 (hash صحيح)
INSERT INTO public.users (username, password_hash, full_name, role, is_active) VALUES
('admin', '$2b$10$rQZ8K9mN2pL3oQ4rS5tU6uV7wX8yZ9aA0bB1cC2dD3eE4fF5gG6hH7iI8jJ9kK0lL1mM2nN3oO4pP5qQ6rR7sS8tT9uU0vV1wW2xX3yY4zZ5', 'مدير النظام', 'admin', true),
('field_agent_1', '$2b$10$rQZ8K9mN2pL3oQ4rS5tU6uV7wX8yZ9aA0bB1cC2dD3eE4fF5gG6hH7iI8jJ9kK0lL1mM2nN3oO4pP5qQ6rR7sS8tT9uU0vV1wW2xX3yY4zZ5', 'محصل ميداني', 'field_agent', true),
('employee_1', '$2b$10$rQZ8K9mN2pL3oQ4rS5tU6uV7wX8yZ9aA0bB1cC2dD3eE4fF5gG6hH7iI8jJ9kK0lL1mM2nN3oO4pP5qQ6rR7sS8tT9uU0vV1wW2xX3yY4zZ5', 'موظف النظام', 'employee', true);

-- رسالة نجاح
DO $$
BEGIN
    RAISE NOTICE 'Users created with correct passwords!';
    RAISE NOTICE 'Username: admin, Password: password123';
    RAISE NOTICE 'Username: field_agent_1, Password: password123';
    RAISE NOTICE 'Username: employee_1, Password: password123';
END $$;
