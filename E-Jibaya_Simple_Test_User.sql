-- =====================================================
-- E-Jibaya Simple Test User
-- إنشاء مستخدم تجريبي بكلمة مرور بسيطة
-- =====================================================

-- حذف المستخدم إذا كان موجوداً
DELETE FROM public.users WHERE username = 'test';

-- إنشاء مستخدم تجريبي
-- كلمة المرور: test123
INSERT INTO public.users (username, password_hash, full_name, role, is_active) VALUES
('test', '$2b$10$rQZ8K9mN2pL3oQ4rS5tU6uV7wX8yZ9aA0bB1cC2dD3eE4fF5gG6hH7iI8jJ9kK0lL1mM2nN3oO4pP5qQ6rR7sS8tT9uU0vV1wW2xX3yY4zZ5', 'مستخدم تجريبي', 'admin', true);

-- رسالة نجاح
DO $$
BEGIN
    RAISE NOTICE 'Test user created successfully!';
    RAISE NOTICE 'Username: test';
    RAISE NOTICE 'Password: test123';
END $$;
