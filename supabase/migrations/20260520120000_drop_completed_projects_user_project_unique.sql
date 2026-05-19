-- 允许多条过程帖：删除「每用户每项目仅一条 completed_projects」的旧唯一约束
-- 终稿唯一性由部分唯一索引 completed_projects_one_final_per_user_project 保证

ALTER TABLE public.completed_projects
    DROP CONSTRAINT IF EXISTS completed_projects_user_project_unique;

-- 常见自动命名（PostgreSQL / 手工迁移）
ALTER TABLE public.completed_projects
    DROP CONSTRAINT IF EXISTS completed_projects_user_id_project_id_key;

DROP INDEX IF EXISTS public.completed_projects_user_project_unique;
DROP INDEX IF EXISTS public.completed_projects_user_id_project_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS completed_projects_one_final_per_user_project
    ON public.completed_projects (user_id, project_id)
    WHERE record_kind = 'final' AND status IN ('pending', 'approved');
