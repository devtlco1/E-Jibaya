-- =====================================================
-- E-Jibaya Quick Test User
-- إنشاء مستخدم سريع للاختبار
-- =====================================================

-- حذف المستخدم إذا كان موجوداً
DELETE FROM public.users WHERE username = 'quick';

-- إنشاء مستخدم سريع
-- كلمة المرور: 123456
INSERT INTO public.users (username, password_hash, full_name, role, is_active) VALUES
('quick', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4QZqJqJqJq', 'مستخدم سريع', 'admin', true);

-- رسالة نجاح
DO $$
BEGIN
    RAISE NOTICE 'Quick test user created!';
    RAISE NOTICE 'Username: quick';
    RAISE NOTICE 'Password: 123456';
END $$;
