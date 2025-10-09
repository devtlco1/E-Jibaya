# إصلاح مشكلة Role Constraint

## المشكلة
```
new row for relation "users" violates check constraint "users_role_check"
```

## السبب
الـ constraint في جدول `users` يسمح فقط بـ:
- `admin`
- `field_agent`

لكن الكود يحاول استخدام:
- `employee`

## الحل

### 1. تشغيل ملف الإصلاح
```sql
-- تشغيل هذا الملف في Supabase SQL Editor
\i fix_role_constraint.sql
```

### 2. أو تشغيل الأوامر يدوياً
```sql
-- حذف الـ constraint القديم
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- إضافة الـ constraint الجديد مع دعم 'employee'
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
CHECK (role IN ('admin', 'field_agent', 'employee'));
```

### 3. التحقق من النتيجة
```sql
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'users_role_check';
```

## النتيجة المتوقعة
```
constraint_name    | check_clause
users_role_check   | (role = ANY (ARRAY['admin'::character varying, 'field_agent'::character varying, 'employee'::character varying]))
```

## ملاحظة
بعد تطبيق هذا الإصلاح، ستعمل جميع وظائف إدارة المستخدمين بشكل طبيعي.
