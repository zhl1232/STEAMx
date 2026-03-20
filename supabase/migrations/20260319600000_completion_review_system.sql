-- ============================================
-- 作品提交审核系统
-- ============================================
-- 创建日期: 2026-03-19
-- 说明: 为 completed_projects 添加审核流程，
--       与项目审核机制保持一致
-- ============================================

-- ============================================
-- 1. 添加审核相关字段
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'completed_projects'
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.completed_projects
        ADD COLUMN status text DEFAULT 'pending';
        RAISE NOTICE '✅ 已添加 status 字段';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'completed_projects'
        AND column_name = 'reviewed_by'
    ) THEN
        ALTER TABLE public.completed_projects
        ADD COLUMN reviewed_by uuid REFERENCES auth.users(id);
        RAISE NOTICE '✅ 已添加 reviewed_by 字段';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'completed_projects'
        AND column_name = 'reviewed_at'
    ) THEN
        ALTER TABLE public.completed_projects
        ADD COLUMN reviewed_at timestamp with time zone;
        RAISE NOTICE '✅ 已添加 reviewed_at 字段';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'completed_projects'
        AND column_name = 'rejection_reason'
    ) THEN
        ALTER TABLE public.completed_projects
        ADD COLUMN rejection_reason text;
        RAISE NOTICE '✅ 已添加 rejection_reason 字段';
    END IF;
END $$;

-- 添加状态约束
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'completed_projects_status_check'
        AND conrelid = 'public.completed_projects'::regclass
    ) THEN
        ALTER TABLE public.completed_projects
        ADD CONSTRAINT completed_projects_status_check
        CHECK (status IN ('pending', 'approved', 'rejected'));
    END IF;
END $$;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_completed_projects_status
ON public.completed_projects(status);

COMMENT ON COLUMN public.completed_projects.status IS '审核状态: pending/approved/rejected';
COMMENT ON COLUMN public.completed_projects.reviewed_by IS '审核人ID';
COMMENT ON COLUMN public.completed_projects.reviewed_at IS '审核时间';
COMMENT ON COLUMN public.completed_projects.rejection_reason IS '拒绝原因';

-- ============================================
-- 2. 将所有现有记录设为已通过
-- ============================================

UPDATE public.completed_projects
SET status = 'approved'
WHERE status IS NULL;

-- ============================================
-- 3. 更新 RLS 策略
-- ============================================

DROP POLICY IF EXISTS "Completed projects visibility policy" ON public.completed_projects;
DROP POLICY IF EXISTS "Completed projects viewable by everyone" ON public.completed_projects;
DROP POLICY IF EXISTS "Completed projects visibility with review" ON public.completed_projects;

CREATE POLICY "Completed projects visibility with review"
ON public.completed_projects FOR SELECT
USING (
    (status = 'approved' AND is_public = true)
    OR auth.uid() = user_id
    OR is_moderator_or_admin()
);

-- ============================================
-- 4. 审核 RPC 函数
-- ============================================

CREATE OR REPLACE FUNCTION public.approve_completion(
    completion_id bigint
)
RETURNS void AS $$
BEGIN
    IF NOT is_moderator_or_admin() THEN
        RAISE EXCEPTION 'Permission denied: only moderators and admins can approve completions';
    END IF;

    UPDATE public.completed_projects
    SET
        status = 'approved',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        rejection_reason = NULL
    WHERE id = completion_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Completion % not found', completion_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.reject_completion(
    completion_id bigint,
    reason text
)
RETURNS void AS $$
BEGIN
    IF NOT is_moderator_or_admin() THEN
        RAISE EXCEPTION 'Permission denied: only moderators and admins can reject completions';
    END IF;

    UPDATE public.completed_projects
    SET
        status = 'rejected',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        rejection_reason = reason
    WHERE id = completion_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Completion % not found', completion_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.approve_completion(bigint) IS '批准完成作品（仅审核员/管理员）';
COMMENT ON FUNCTION public.reject_completion(bigint, text) IS '拒绝完成作品（仅审核员/管理员）';

-- ============================================
-- 完成提示
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ 作品审核系统迁移完成！';
    RAISE NOTICE '📋 已添加 status/reviewed_by/reviewed_at/rejection_reason 字段';
    RAISE NOTICE '🔒 已更新 RLS 策略';
    RAISE NOTICE '🔧 已创建 approve_completion / reject_completion 函数';
END $$;
