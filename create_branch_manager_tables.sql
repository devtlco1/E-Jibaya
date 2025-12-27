-- =====================================================
-- Migration: إضافة نظام مدير الفرع
-- Date: 2024-12-27
-- Description: 
-- 1. إنشاء جدول branch_manager_field_agents لربط مدير الفرع بالمحصلين الميدانيين
-- 2. إضافة فهارس لتحسين الأداء
-- =====================================================

-- جدول ربط مدير الفرع بالمحصلين الميدانيين
CREATE TABLE IF NOT EXISTS public.branch_manager_field_agents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_manager_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    field_agent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id),
    UNIQUE(branch_manager_id, field_agent_id)
);

-- فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_branch_manager_field_agents_branch_manager_id 
ON public.branch_manager_field_agents(branch_manager_id);

CREATE INDEX IF NOT EXISTS idx_branch_manager_field_agents_field_agent_id 
ON public.branch_manager_field_agents(field_agent_id);

-- تعليقات
COMMENT ON TABLE public.branch_manager_field_agents IS 'جدول ربط مدير الفرع بالمحصلين الميدانيين الذين يمكنه رؤية سجلاتهم';
COMMENT ON COLUMN public.branch_manager_field_agents.branch_manager_id IS 'معرف مدير الفرع';
COMMENT ON COLUMN public.branch_manager_field_agents.field_agent_id IS 'معرف المحصل الميداني';

-- =====================================================
-- Migration completed successfully
-- =====================================================

