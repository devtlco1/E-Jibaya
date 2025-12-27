-- كود بسيط لإنشاء جدول مدير الفرع
-- فقط انسخ والصق في Supabase SQL Editor

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

