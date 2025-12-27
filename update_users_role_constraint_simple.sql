-- كود بسيط لتحديث constraint role في جدول users
-- فقط انسخ والصق في Supabase SQL Editor

-- حذف constraint القديم
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- إضافة constraint جديد يتضمن branch_manager
ALTER TABLE public.users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('admin', 'field_agent', 'employee', 'branch_manager'));

