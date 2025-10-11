-- =====================================================
-- E-Jibaya Create Admin User
-- إنشاء مستخدم مدير بكلمة مرور صحيحة
-- =====================================================

-- حذف المستخدم إذا كان موجوداً
DELETE FROM public.users WHERE username = 'admin';

-- إنشاء مستخدم مدير جديد
-- كلمة المرور: admin123
INSERT INTO public.users (username, password_hash, full_name, role, is_active) VALUES
('admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'مدير النظام', 'admin', true);

-- رسالة نجاح
DO $$
BEGIN
    RAISE NOTICE 'Admin user created successfully!';
    RAISE NOTICE 'Username: admin';
    RAISE NOTICE 'Password: admin123';
END $$;
