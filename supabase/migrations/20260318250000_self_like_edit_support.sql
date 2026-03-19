-- ============================================================
-- #18: 禁止自赞（API 层校验，无需 DB 级约束）
-- #14: 项目编辑区分重大/微调，仅重大修改重置审核状态
-- #15: 评论/讨论/回复支持编辑（添加 updated_at 字段）
-- ============================================================

-- #14: 项目作者请求重新审核（仅在当前状态为 approved 时重置为 pending）
CREATE OR REPLACE FUNCTION public.request_project_re_review(p_project_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_author_id uuid;
  v_status text;
BEGIN
  SELECT author_id, status INTO v_author_id, v_status
  FROM public.projects
  WHERE id = p_project_id;

  IF v_author_id IS NULL THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  IF v_author_id != auth.uid() THEN
    RAISE EXCEPTION 'Not the project author';
  END IF;

  IF v_status = 'approved' THEN
    UPDATE public.projects
    SET status = 'pending', updated_at = now()
    WHERE id = p_project_id;
  END IF;
END;
$$;

-- #15: 评论/讨论/回复添加 updated_at 字段，用于编辑标记
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE public.discussions ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE public.discussion_replies ADD COLUMN IF NOT EXISTS updated_at timestamptz;
