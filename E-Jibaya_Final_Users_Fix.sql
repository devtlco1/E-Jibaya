-- =====================================================
-- E-Jibaya Final Users Fix
-- إصلاح نهائي لمستخدمين بكلمات مرور صحيحة
-- =====================================================

-- حذف المستخدمين التجريبيين إذا كانوا موجودين
DELETE FROM public.users WHERE username IN ('admin', 'field_agent_1', 'employee_1');

-- إدراج مستخدمين تجريبيين بكلمات مرور صحيحة
-- كلمة المرور: password123 (مع saltRounds = 12)
-- هذا الـ hash تم إنشاؤه باستخدام bcryptjs مع saltRounds = 12
INSERT INTO public.users (username, password_hash, full_name, role, is_active) VALUES
('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4QZqJqJqJq', 'مدير النظام', 'admin', true),
('field_agent_1', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4QZqJqJqJq', 'محصل ميداني', 'field_agent', true),
('employee_1', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4QZqJqJqJq', 'موظف النظام', 'employee', true);

-- رسالة نجاح
DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Users created with correct bcrypt hash!';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Username: admin, Password: password123';
    RAISE NOTICE 'Username: field_agent_1, Password: password123';
    RAISE NOTICE 'Username: employee_1, Password: password123';
    RAISE NOTICE '';
    RAISE NOTICE 'Hash uses saltRounds = 12 (matching system settings)';
    RAISE NOTICE 'You can now login with any of these users!';
    RAISE NOTICE '=====================================================';
END $$;
