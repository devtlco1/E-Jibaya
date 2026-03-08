-- =====================================================
-- Migration: القطاع، الوظيفة، دور الأحمال العالية، صورة الفاتورة الخلفية
-- =====================================================

-- 1. إضافة دور الأحمال العالية
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('admin', 'field_agent', 'employee', 'branch_manager', 'high_loads'));

-- 2. إضافة حقل القطاع للمستخدمين
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS sector VARCHAR(50);

COMMENT ON COLUMN public.users.sector IS 'القطاع: الزهراء، داموك، الخاجية، الهورة، الكفاءات، تموز';

-- 3. إضافة حقل الوظيفة للمستخدمين
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS job_title VARCHAR(100);

COMMENT ON COLUMN public.users.job_title IS 'الوظيفة: مدقق، مرحل، مدقق ومرحل، إلخ';

-- 4. إضافة صورة الفاتورة الخلفية لسجلات الجباية
ALTER TABLE public.collection_records 
ADD COLUMN IF NOT EXISTS invoice_photo_back_url TEXT;

COMMENT ON COLUMN public.collection_records.invoice_photo_back_url IS 'صورة ظهر الفاتورة';

-- 5. فهرس للقطاع لتسريع الفلترة
CREATE INDEX IF NOT EXISTS idx_users_sector ON public.users(sector) WHERE sector IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_job_title ON public.users(job_title) WHERE job_title IS NOT NULL;
