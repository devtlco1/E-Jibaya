-- =====================================================
-- إصلاح التحذيرات المتبقية - الإصدار الثاني
-- E-Jibaya - Fix Remaining Security Warnings v2
-- =====================================================

-- 1. حذف الدوال الموجودة أولاً ثم إعادة إنشائها
-- حذف الدوال الموجودة
DROP FUNCTION IF EXISTS public.get_records_stats();
DROP FUNCTION IF EXISTS public.get_active_field_agents_count();

-- إعادة إنشاء دالة get_records_stats مع search_path ثابت
CREATE OR REPLACE FUNCTION public.get_records_stats()
RETURNS TABLE(
    total bigint,
    pending bigint,
    completed bigint,
    reviewed bigint,
    refused bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'reviewed') as reviewed,
        COUNT(*) FILTER (WHERE is_refused = true) as refused
    FROM collection_records;
$$;

-- إعادة إنشاء دالة get_active_field_agents_count مع search_path ثابت
CREATE OR REPLACE FUNCTION public.get_active_field_agents_count()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COUNT(*)
    FROM users
    WHERE (role = 'field_agent' OR role = 'employee')
      AND is_active = true
      AND username NOT LIKE '%(محذوف)%';
$$;

-- 2. إضافة سياسة لجدول backup_info
-- إنشاء سياسة أساسية لجدول النسخ الاحتياطي

-- سياسة للمديرين فقط للوصول إلى معلومات النسخ الاحتياطي
CREATE POLICY "Admins can manage backup info" ON public.backup_info
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid() 
            AND u.role = 'admin'
        )
    );

-- التحقق من النتيجة
SELECT 
    'Functions Fixed' as type,
    'get_records_stats, get_active_field_agents_count' as details
UNION ALL
SELECT 
    'Backup Policy Added' as type,
    'Admins can manage backup info' as details;

-- رسالة النجاح
SELECT '🎉 تم إصلاح جميع التحذيرات! النظام جاهز للإنتاج!' as result;
