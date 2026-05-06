-- 项目表冗余评论数：用于探索「最受欢迎」等列表在数据库层排序（避免全表 count 子查询）
-- 由 SECURITY DEFINER 触发器维护；普通客户端更新 projects 时由 protect 触发器禁止篡改

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS comments_count integer NOT NULL DEFAULT 0;

UPDATE public.projects p
SET comments_count = COALESCE(
  (SELECT COUNT(*)::int FROM public.comments c WHERE c.project_id = p.id),
  0
);

CREATE OR REPLACE FUNCTION public.trg_comments_adjust_project_comments_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.projects
    SET comments_count = COALESCE(comments_count, 0) + 1
    WHERE id = NEW.project_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.projects
    SET comments_count = GREATEST(COALESCE(comments_count, 0) - 1, 0)
    WHERE id = OLD.project_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_comments_adjust_project_comments_count ON public.comments;
CREATE TRIGGER trg_comments_adjust_project_comments_count
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_comments_adjust_project_comments_count();

COMMENT ON COLUMN public.projects.comments_count IS '项目评论总数（冗余，由 comments 表触发器同步）';

-- 禁止客户端直接改点赞/浏览/投币/评论计数（与 likes 增量 RPC 一致：RPC 为 postgres 用户可写）
CREATE OR REPLACE FUNCTION public.protect_projects_sensitive_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin') THEN
    NEW.likes_count := COALESCE(OLD.likes_count, 0);
    NEW.views_count := COALESCE(OLD.views_count, 0);
    NEW.coins_count := COALESCE(OLD.coins_count, 0);
    NEW.comments_count := COALESCE(OLD.comments_count, 0);
    NEW.status := OLD.status;
    NEW.reviewed_by := OLD.reviewed_by;
    NEW.reviewed_at := OLD.reviewed_at;
    NEW.rejection_reason := OLD.rejection_reason;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
