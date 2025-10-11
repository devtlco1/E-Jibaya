-- =====================================================
-- E-Jibaya Simple Login Test
-- إنشاء مستخدم بسيط للاختبار السريع
-- =====================================================

-- حذف المستخدم إذا كان موجوداً
DELETE FROM public.users WHERE username = 'test';

-- إنشاء مستخدم بسيط
-- كلمة المرور: 123456
INSERT INTO public.users (username, password_hash, full_name, role, is_active) VALUES
('test', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4QZqJqJqJq', 'مستخدم تجريبي', 'admin', true);

-- رسالة نجاح
DO $$
BEGIN
    RAISE NOTICE 'Simple test user created!';
    RAISE NOTICE 'Username: test';
    RAISE NOTICE 'Password: 123456';
END $$;
