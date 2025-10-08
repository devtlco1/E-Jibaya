-- =====================================================
-- التحقق من constraint الأدوار (استعلام مبسط)
-- =====================================================

-- طريقة بسيطة للتحقق من constraint
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.users'::regclass 
    AND conname = 'users_role_check';

-- أو طريقة أخرى للتحقق
SELECT 
    constraint_name,
    constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'users' 
    AND constraint_name = 'users_role_check';
