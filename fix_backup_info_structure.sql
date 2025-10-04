-- =====================================================
-- إصلاح هيكل جدول backup_info
-- E-Jibaya - Fix Backup Info Table Structure
-- =====================================================

-- المشكلة: جدول backup_info لا يحتوي على العمود backup_name
-- الحل: التحقق من هيكل الجدول وإصلاحه

-- 1. التحقق من هيكل الجدول الحالي
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'backup_info'
ORDER BY ordinal_position;

-- 2. إضافة الأعمدة المفقودة إذا لم تكن موجودة
DO $$ 
BEGIN
    -- إضافة عمود backup_name إذا لم يكن موجوداً
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'backup_info' 
        AND column_name = 'backup_name'
    ) THEN
        ALTER TABLE public.backup_info ADD COLUMN backup_name VARCHAR(255);
    END IF;

    -- إضافة عمود backup_type إذا لم يكن موجوداً
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'backup_info' 
        AND column_name = 'backup_type'
    ) THEN
        ALTER TABLE public.backup_info ADD COLUMN backup_type VARCHAR(50) DEFAULT 'manual';
    END IF;

    -- إضافة عمود file_size إذا لم يكن موجوداً
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'backup_info' 
        AND column_name = 'file_size'
    ) THEN
        ALTER TABLE public.backup_info ADD COLUMN file_size BIGINT;
    END IF;

    -- إضافة عمود file_path إذا لم يكن موجوداً
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'backup_info' 
        AND column_name = 'file_path'
    ) THEN
        ALTER TABLE public.backup_info ADD COLUMN file_path TEXT;
    END IF;

    -- إضافة عمود created_by إذا لم يكن موجوداً
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'backup_info' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE public.backup_info ADD COLUMN created_by UUID REFERENCES public.users(id);
    END IF;

    -- إضافة عمود status إذا لم يكن موجوداً
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'backup_info' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.backup_info ADD COLUMN status VARCHAR(50) DEFAULT 'completed';
    END IF;

    -- إضافة عمود description إذا لم يكن موجوداً
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'backup_info' 
        AND column_name = 'description'
    ) THEN
        ALTER TABLE public.backup_info ADD COLUMN description TEXT;
    END IF;
END $$;

-- 3. التحقق من الهيكل الجديد
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'backup_info'
ORDER BY ordinal_position;

-- 4. إصلاح السياسات
DROP POLICY IF EXISTS "Admins can manage backup info" ON public.backup_info;
DROP POLICY IF EXISTS "Allow read access to backup info" ON public.backup_info;
DROP POLICY IF EXISTS "Allow insert access to backup info" ON public.backup_info;

-- إعادة إنشاء السياسات
CREATE POLICY "Admins can manage backup info" ON public.backup_info
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid() 
            AND u.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid() 
            AND u.role = 'admin'
        )
    );

CREATE POLICY "Allow read access to backup info" ON public.backup_info
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow insert access to backup info" ON public.backup_info
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 5. اختبار إنشاء سجل تجريبي
INSERT INTO public.backup_info (
    backup_name,
    backup_type,
    file_size,
    file_path,
    created_by,
    status,
    description
) VALUES (
    'Test Backup',
    'manual',
    1024,
    '/test/path',
    'ba7a2d56-daa7-44d5-9b90-80a9843be1c1',
    'completed',
    'Test backup entry'
);

-- 6. اختبار القراءة
SELECT 
    'Backup Info Test' as test_name,
    COUNT(*) as record_count
FROM public.backup_info;

-- 7. حذف السجل التجريبي
DELETE FROM public.backup_info WHERE backup_name = 'Test Backup';

-- رسالة النجاح
SELECT '🎉 تم إصلاح هيكل جدول backup_info! النسخ الاحتياطي يعمل الآن!' as result;
