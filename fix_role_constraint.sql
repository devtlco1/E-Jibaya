-- =====================================================
-- إصلاح مشكلة check constraint للأدوار
-- =====================================================
-- هذا الملف يضيف دور 'employee' إلى قاعدة البيانات

-- 1. حذف الـ constraint الحالي
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. إضافة الـ constraint الجديد مع دور 'employee'
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
CHECK (role IN ('admin', 'field_agent', 'employee'));

-- 3. التحقق من التحديث
SELECT 
    tc.constraint_name,
    cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'users' 
    AND tc.constraint_type = 'CHECK'
    AND tc.constraint_name = 'users_role_check';
