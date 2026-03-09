-- =====================================================
-- حذف البيانات قبل ١٧ فبراير ٢٠٢٦ (فما دون)
-- =====================================================

-- 1. record_changes_log
DELETE FROM public.record_changes_log
WHERE (changed_at AT TIME ZONE 'Asia/Baghdad')::date <= '2026-02-17';

-- 2. record_photos
DELETE FROM public.record_photos
WHERE (created_at AT TIME ZONE 'Asia/Baghdad')::date <= '2026-02-17';

-- 3. record_locations
DELETE FROM public.record_locations
WHERE (created_at AT TIME ZONE 'Asia/Baghdad')::date <= '2026-02-17';

-- 4. activity_logs
DELETE FROM public.activity_logs
WHERE (created_at AT TIME ZONE 'Asia/Baghdad')::date <= '2026-02-17';

-- 5. collection_records
DELETE FROM public.collection_records
WHERE (COALESCE(updated_at, submitted_at) AT TIME ZONE 'Asia/Baghdad')::date <= '2026-02-17';

-- 6. user_sessions
DELETE FROM public.user_sessions
WHERE (created_at AT TIME ZONE 'Asia/Baghdad')::date <= '2026-02-17';

-- 7. backup_logs (يستخدم backup_date وليس created_at)
DELETE FROM public.backup_logs
WHERE (backup_date AT TIME ZONE 'Asia/Baghdad')::date <= '2026-02-17';

-- 8. branch_manager_employees
DELETE FROM public.branch_manager_employees
WHERE (created_at AT TIME ZONE 'Asia/Baghdad')::date <= '2026-02-17';

-- 9. branch_manager_field_agents
DELETE FROM public.branch_manager_field_agents
WHERE (created_at AT TIME ZONE 'Asia/Baghdad')::date <= '2026-02-17';

-- 10. users — لا يُحذف أي مستخدم (يبقى جدول users كما هو)
