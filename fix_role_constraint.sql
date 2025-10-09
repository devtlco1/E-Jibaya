-- إصلاح constraint للـ role في جدول users
-- هذا الملف يصلح المشكلة في قاعدة البيانات الموجودة

-- حذف الـ constraint القديم
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- إضافة الـ constraint الجديد مع دعم 'employee'
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
CHECK (role IN ('admin', 'field_agent', 'employee'));

-- التحقق من النتيجة
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'users_role_check';
