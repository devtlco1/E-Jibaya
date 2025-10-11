-- =====================================================
-- E-Jibaya Simple Password Test
-- إنشاء مستخدم بكلمة مرور بسيطة للاختبار
-- =====================================================

-- حذف المستخدم إذا كان موجوداً
DELETE FROM public.users WHERE username = 'simple';

-- إنشاء مستخدم بكلمة مرور بسيطة
-- كلمة المرور: 123
INSERT INTO public.users (username, password_hash, full_name, role, is_active) VALUES
('simple', '$2b$12$rQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4QZqJqJqJq', 'مستخدم بسيط', 'admin', true);

-- رسالة نجاح
DO $$
BEGIN
    RAISE NOTICE 'Simple test user created!';
    RAISE NOTICE 'Username: simple';
    RAISE NOTICE 'Password: 123';
    RAISE NOTICE 'This should work for quick testing!';
END $$;
