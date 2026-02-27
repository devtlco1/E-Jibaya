-- =====================================================
-- Migration: إضافة جدول موظفي مدير الفرع
-- Description: مدير الفرع يمكنه إضافة موظفين (employee) كتابعين بالإضافة للمحصلين الميدانيين
-- =====================================================

CREATE TABLE IF NOT EXISTS public.branch_manager_employees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_manager_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id),
    UNIQUE(branch_manager_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_branch_manager_employees_branch_manager_id 
ON public.branch_manager_employees(branch_manager_id);

CREATE INDEX IF NOT EXISTS idx_branch_manager_employees_employee_id 
ON public.branch_manager_employees(employee_id);

COMMENT ON TABLE public.branch_manager_employees IS 'جدول ربط مدير الفرع بالموظفين التابعين له';
COMMENT ON COLUMN public.branch_manager_employees.branch_manager_id IS 'معرف مدير الفرع';
COMMENT ON COLUMN public.branch_manager_employees.employee_id IS 'معرف الموظف التابع';
