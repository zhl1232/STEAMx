-- ============================================
-- 初始数据库 Schema
-- ============================================
-- 从旧项目导出的完整数据库结构
-- 包含所有表、RLS 策略和触发器
-- ============================================

-- ============================================
-- 1. 项目表 (projects)
-- ============================================
CREATE TABLE IF NOT EXISTS public.projects (
  id bigserial PRIMARY KEY,
  title text NOT NULL,
  description text,
  author_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url text,
  category text,
  difficulty text,
  duration int,
  likes_count int DEFAULT 0,
  views_count int DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 启用 RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_projects_author ON public.projects(author_id);
CREATE INDEX IF NOT EXISTS idx_projects_category ON public.projects(category);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at DESC);

-- RLS 策略
CREATE POLICY "Projects are viewable by everyone"
  ON public.projects FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "Users can delete their own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = author_id);

-- ============================================
-- 2. 项目材料表 (project_materials)
-- ============================================
CREATE TABLE IF NOT EXISTS public.project_materials (
  id bigserial PRIMARY KEY,
  project_id bigint REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  material text NOT NULL,
  sort_order int
);

ALTER TABLE public.project_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Materials viewable by everyone"
  ON public.project_materials FOR SELECT
  USING (true);

CREATE POLICY "Authors can manage their project materials"
  ON public.project_materials FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_materials.project_id
      AND author_id = auth.uid()
    )
  );

-- ============================================
-- 3. 项目步骤表 (project_steps)
-- ============================================
CREATE TABLE IF NOT EXISTS public.project_steps (
  id bigserial PRIMARY KEY,
  project_id bigint REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  image_url text,
  sort_order int
);

ALTER TABLE public.project_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Steps viewable by everyone"
  ON public.project_steps FOR SELECT
  USING (true);

CREATE POLICY "Authors can manage their project steps"
  ON public.project_steps FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_steps.project_id
      AND author_id = auth.uid()
    )
  );

-- ============================================
-- 4. 评论表 (comments)
-- ============================================
CREATE TABLE IF NOT EXISTS public.comments (
  id bigserial PRIMARY KEY,
  project_id bigint REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  parent_id bigint REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_comments_project ON public.comments(project_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON public.comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON public.comments(parent_id);

CREATE POLICY "Comments viewable by everyone"
  ON public.comments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create comments"
  ON public.comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete own comments"
  ON public.comments FOR DELETE
  USING (auth.uid() = author_id);

-- ============================================
-- 5. 点赞表 (likes)
-- ============================================
CREATE TABLE IF NOT EXISTS public.likes (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id bigint REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (user_id, project_id)
);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Likes viewable by everyone"
  ON public.likes FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their own likes"
  ON public.likes FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- 6. 完成项目记录表 (completed_projects)
-- ============================================
CREATE TABLE IF NOT EXISTS public.completed_projects (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id bigint REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  completed_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (user_id, project_id)
);

ALTER TABLE public.completed_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Completed projects viewable by everyone"
  ON public.completed_projects FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their own completions"
  ON public.completed_projects FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- 7. 讨论表 (discussions)
-- ============================================
CREATE TABLE IF NOT EXISTS public.discussions (
  id bigserial PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tags text[],
  likes_count int DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.discussions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_discussions_author ON public.discussions(author_id);
CREATE INDEX IF NOT EXISTS idx_discussions_created_at ON public.discussions(created_at DESC);

CREATE POLICY "Discussions viewable by everyone"
  ON public.discussions FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create discussions"
  ON public.discussions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own discussions"
  ON public.discussions FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "Users can delete their own discussions"
  ON public.discussions FOR DELETE
  USING (auth.uid() = author_id);

-- ============================================
-- 8. 讨论回复表 (discussion_replies)
-- ============================================
CREATE TABLE IF NOT EXISTS public.discussion_replies (
  id bigserial PRIMARY KEY,
  discussion_id bigint REFERENCES public.discussions(id) ON DELETE CASCADE NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.discussion_replies ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_discussion_replies_discussion_id ON public.discussion_replies(discussion_id);
CREATE INDEX IF NOT EXISTS idx_discussion_replies_author ON public.discussion_replies(author_id);

CREATE POLICY "Discussion replies viewable by everyone"
  ON public.discussion_replies FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create discussion replies"
  ON public.discussion_replies FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own discussion replies"
  ON public.discussion_replies FOR DELETE
  USING (auth.uid() = author_id);

-- ============================================
-- 9. 挑战表 (challenges)
-- ============================================
CREATE TABLE IF NOT EXISTS public.challenges (
  id bigserial PRIMARY KEY,
  title text NOT NULL,
  description text,
  image_url text,
  tags text[],
  participants_count int DEFAULT 0,
  end_date timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Challenges viewable by everyone"
  ON public.challenges FOR SELECT
  USING (true);

-- ============================================
-- 10. 挑战参与者表 (challenge_participants)
-- ============================================
CREATE TABLE IF NOT EXISTS public.challenge_participants (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  challenge_id bigint REFERENCES public.challenges(id) ON DELETE CASCADE NOT NULL,
  joined_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (user_id, challenge_id)
);

ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Challenge participants viewable by everyone"
  ON public.challenge_participants FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their own challenge participation"
  ON public.challenge_participants FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- 11. 徽章表 (badges)
-- ============================================
CREATE TABLE IF NOT EXISTS public.badges (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  icon text,
  condition jsonb
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Badges viewable by everyone"
  ON public.badges FOR SELECT
  USING (true);

-- ============================================
-- 12. 用户徽章表 (user_badges)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_badges (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  badge_id text REFERENCES public.badges(id) ON DELETE CASCADE NOT NULL,
  unlocked_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User badges viewable by everyone"
  ON public.user_badges FOR SELECT
  USING (true);

-- ============================================
-- 13. 项目统计函数
-- ============================================

-- 增加项目点赞计数
CREATE OR REPLACE FUNCTION public.increment_project_likes(project_id bigint)
RETURNS void AS $$
BEGIN
  UPDATE public.projects
  SET likes_count = likes_count + 1
  WHERE id = project_id;
END;
$$ LANGUAGE plpgsql;

-- 减少项目点赞计数
CREATE OR REPLACE FUNCTION public.decrement_project_likes(project_id bigint)
RETURNS void AS $$
BEGIN
  UPDATE public.projects
  SET likes_count = likes_count - 1
  WHERE id = project_id AND likes_count > 0;
END;
$$ LANGUAGE plpgsql;

-- 增加项目浏览数
CREATE OR REPLACE FUNCTION public.increment_project_views(project_id bigint)
RETURNS void AS $$
BEGIN
  UPDATE public.projects
  SET views_count = views_count + 1
  WHERE id = project_id;
END;
$$ LANGUAGE plpgsql;

-- 增加挑战参与者数量
CREATE OR REPLACE FUNCTION public.increment_challenge_participants(challenge_id bigint)
RETURNS void AS $$
BEGIN
  UPDATE public.challenges
  SET participants_count = participants_count + 1
  WHERE id = challenge_id;
END;
$$ LANGUAGE plpgsql;

-- 减少挑战参与者数量
CREATE OR REPLACE FUNCTION public.decrement_challenge_participants(challenge_id bigint)
RETURNS void AS $$
BEGIN
  UPDATE public.challenges
  SET participants_count = participants_count - 1
  WHERE id = challenge_id AND participants_count > 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================
--完成提示
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ 初始数据库结构创建完成！';
  RAISE NOTICE '📊 已创建所有核心表';
  RAISE NOTICE '🔒 已配置 RLS 策略';
  RAISE NOTICE '⚡ 已添加辅助函数';
END $$;
-- Create a table for public profiles
create table if not exists profiles (
  id uuid references auth.users on delete cascade not null primary key,
  updated_at timestamp with time zone,
  username text unique,
  display_name text,
  bio text,
  avatar_url text,
  created_at timestamp with time zone default now(),

  constraint username_length check (char_length(username) >= 3)
);

-- Set up Row Level Security (RLS)
-- See https://supabase.com/docs/guides/auth/row-level-security for more details.
alter table profiles enable row level security;

-- 删除已存在的策略（如果有）
drop policy if exists "Public profiles are viewable by everyone." on profiles;
drop policy if exists "Users can insert their own profile." on profiles;
drop policy if exists "Users can update own profile." on profiles;

-- 重新创建策略
create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- This trigger automatically creates a profile entry when a new user signs up via Supabase Auth.
-- See https://supabase.com/docs/guides/auth/managing-user-data#using-triggers for more details.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id, 
    new.raw_user_meta_data->>'username', 
    new.raw_user_meta_data->>'full_name', 
    '/avatars/default-1.svg'
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill for existing users (optional, run only if needed)
-- insert into public.profiles (id, username, display_name, avatar_url)
-- select 
--   id, 
--   raw_user_meta_data->>'username', 
--   raw_user_meta_data->>'full_name', 
--   '/avatars/default-1.svg'
-- from auth.users
-- on conflict (id) do nothing;
-- Add xp column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS xp int DEFAULT 0;

-- Add login tracking columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_check_in date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS login_streak int DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_login_days int DEFAULT 0;

COMMENT ON COLUMN public.profiles.xp IS '用户经验值';
COMMENT ON COLUMN public.profiles.last_check_in IS '上次登录打卡日期';
COMMENT ON COLUMN public.profiles.login_streak IS '连续登录天数';
COMMENT ON COLUMN public.profiles.total_login_days IS '累计登录天数';

-- ============================================
-- Daily Check-in Function
-- ============================================
CREATE OR REPLACE FUNCTION public.daily_check_in()
RETURNS jsonb AS $$
DECLARE
  current_date date := CURRENT_DATE;
  user_last_check_in date;
  user_streak int;
  user_total_days int;
  result jsonb;
BEGIN
  -- 获取用户当前状态
  SELECT last_check_in, login_streak, total_login_days
  INTO user_last_check_in, user_streak, user_total_days
  FROM public.profiles
  WHERE id = auth.uid();

  -- 如果已经打卡，直接返回
  IF user_last_check_in = current_date THEN
    RETURN jsonb_build_object(
      'streak', user_streak,
      'total_days', user_total_days,
      'checked_in_today', true,
      'is_new_day', false
    );
  END IF;

  -- 计算新的连续天数
  IF user_last_check_in = current_date - 1 THEN
    -- 昨天打卡了，连续 + 1
    user_streak := COALESCE(user_streak, 0) + 1;
  ELSE
    -- 昨天没打卡（或者从未打卡），重置为 1
    user_streak := 1;
  END IF;

  -- 累计天数 + 1
  user_total_days := COALESCE(user_total_days, 0) + 1;

  -- 更新数据库
  UPDATE public.profiles
  SET 
    last_check_in = current_date,
    login_streak = user_streak,
    total_login_days = user_total_days
  WHERE id = auth.uid();

  -- 返回新状态
  RETURN jsonb_build_object(
    'streak', user_streak,
    'total_days', user_total_days,
    'checked_in_today', true,
    'is_new_day', true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.daily_check_in() IS '每日签到函数，自动处理连续登录和累计登录逻辑';

-- ============================================
-- 权限系统迁移脚本
-- ============================================
-- 创建日期: 2025-11-25
-- 说明: 添加用户角色、项目审核状态等权限相关字段
-- ============================================

-- ============================================
-- 1. 用户角色系统
-- ============================================

-- 添加角色字段到 profiles 表
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';

-- 添加角色约束
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'role_check' AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles 
    ADD CONSTRAINT role_check 
    CHECK (role IN ('user', 'moderator', 'admin'));
  END IF;
END $$;

-- 添加索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

COMMENT ON COLUMN public.profiles.role IS '用户角色: user/moderator/admin';

-- ============================================
-- 2. 项目审核系统
-- ============================================

-- 添加项目状态字段
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- 添加审核信息字段
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id);

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone;

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- 添加状态约束
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'status_check' AND conrelid = 'public.projects'::regclass
  ) THEN
    ALTER TABLE public.projects 
    ADD CONSTRAINT status_check 
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected'));
  END IF;
END $$;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);

COMMENT ON COLUMN public.projects.status IS '项目状态: draft/pending/approved/rejected';
COMMENT ON COLUMN public.projects.reviewed_by IS '审核人ID';
COMMENT ON COLUMN public.projects.reviewed_at IS '审核时间';
COMMENT ON COLUMN public.projects.rejection_reason IS '拒绝原因';

-- ============================================
-- 3. 标签系统
-- ============================================

-- 标签定义表
CREATE TABLE IF NOT EXISTS public.tags (
  id bigserial PRIMARY KEY,
  name text UNIQUE NOT NULL,
  category text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT now()
);

COMMENT ON TABLE public.tags IS '标签定义表';
COMMENT ON COLUMN public.tags.category IS '标签分类（如学科、难度等）';

-- 项目标签关联表
CREATE TABLE IF NOT EXISTS public.project_tags (
  project_id bigint REFERENCES public.projects(id) ON DELETE CASCADE,
  tag_id bigint REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, tag_id)
);

COMMENT ON TABLE public.project_tags IS '项目标签关联表';

-- 启用 RLS
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tags ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. 权限检查函数
-- ============================================

-- 检查用户是否为管理员
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 检查用户是否为审核员或管理员
CREATE OR REPLACE FUNCTION public.is_moderator_or_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('moderator', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.is_admin() IS '检查当前用户是否为管理员';
COMMENT ON FUNCTION public.is_moderator_or_admin() IS '检查当前用户是否为审核员或管理员';

-- ============================================
-- 5. 更新 RLS 策略
-- ============================================

-- 删除旧的项目查看策略
DROP POLICY IF EXISTS "Projects are viewable by everyone" ON public.projects;

-- 新策略：只显示已批准的项目给所有人，作者可以看到自己的所有项目
CREATE POLICY "Approved projects viewable by everyone"
  ON public.projects FOR SELECT
  USING (
    status = 'approved' 
    OR auth.uid() = author_id 
    OR is_moderator_or_admin()
  );

-- 更新评论删除策略
DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;

CREATE POLICY "Users can delete own comments or moderators can delete any"
  ON public.comments FOR DELETE
  USING (
    auth.uid() = author_id 
    OR is_moderator_or_admin()
  );

-- 标签策略
CREATE POLICY "Tags viewable by everyone"
  ON public.tags FOR SELECT
  USING (true);

CREATE POLICY "Moderators can manage tags"
  ON public.tags FOR ALL
  USING (is_moderator_or_admin())
  WITH CHECK (is_moderator_or_admin());

-- 项目标签策略
CREATE POLICY "Project tags viewable by everyone"
  ON public.project_tags FOR SELECT
  USING (true);

CREATE POLICY "Project authors can manage their project tags"
  ON public.project_tags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_tags.project_id 
      AND author_id = auth.uid()
    )
  );

-- ============================================
-- 6. 审核相关函数
-- ============================================

-- 批准项目
CREATE OR REPLACE FUNCTION public.approve_project(
  project_id bigint
)
RETURNS void AS $$
BEGIN
  -- 检查权限
  IF NOT is_moderator_or_admin() THEN
    RAISE EXCEPTION 'Permission denied: only moderators and admins can approve projects';
  END IF;

  -- 更新项目状态
  UPDATE public.projects
  SET 
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    rejection_reason = NULL
  WHERE id = project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 拒绝项目
CREATE OR REPLACE FUNCTION public.reject_project(
  project_id bigint,
  reason text
)
RETURNS void AS $$
BEGIN
  -- 检查权限
  IF NOT is_moderator_or_admin() THEN
    RAISE EXCEPTION 'Permission denied: only moderators and admins can reject projects';
  END IF;

  -- 更新项目状态
  UPDATE public.projects
  SET 
    status = 'rejected',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    rejection_reason = reason
  WHERE id = project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.approve_project(bigint) IS '批准项目（仅审核员/管理员）';
COMMENT ON FUNCTION public.reject_project(bigint, text) IS '拒绝项目（仅审核员/管理员）';

-- ============================================
-- 7. 将现有项目设置为已批准状态
-- ============================================

-- 将所有现有项目设置为 'approved' 状态，避免影响现有内容
UPDATE public.projects
SET status = 'approved'
WHERE status IS NULL OR status = 'pending';

-- ============================================
-- 完成提示
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ 权限系统迁移完成！';
  RAISE NOTICE '📊 添加了用户角色系统';
  RAISE NOTICE '🔍 添加了项目审核流程';
  RAISE NOTICE '🏷️ 添加了标签管理系统';
  RAISE NOTICE '🔒 更新了 RLS 策略';
  RAISE NOTICE '🚀 可以开始使用权限功能了！';
END $$;
-- 允许用户插入自己的徽章记录
CREATE POLICY "Users can insert own badges"
  ON public.user_badges FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 允许用户更新自己的 XP (在 profiles 表)
-- 注意：现有的 "Users can update own profile" 策略已经覆盖了 UPDATE，
-- 但我们需要确保前端传递的 payload 包含 id 且与 auth.uid() 匹配。
-- 另外，为了安全起见，通常 XP 应该由服务端控制，但目前架构是前端计算。
-- 我们需要检查是否因为 RLS 限制导致 update 失败。

-- 检查现有的 profiles UPDATE 策略：
-- CREATE POLICY "Users can update own profile"
--   ON public.profiles FOR UPDATE
--   USING (auth.uid() = id);

-- 这个策略应该是足够的。
-- 让我们再添加一个针对 user_badges 的策略，因为之前只有 SELECT。
-- ============================================
-- 修复存储桶 (Storage Buckets)
-- ============================================

-- 1. 创建存储桶
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('avatars', 'avatars', true),
  ('project-images', 'project-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. 设置 Avatars 桶权限

-- 允许公开读取
DROP POLICY IF EXISTS "Avatar images are publicly accessible." ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible." ON storage.objects FOR SELECT USING ( bucket_id = 'avatars' );

-- 允许登录用户上传
DROP POLICY IF EXISTS "Anyone can upload an avatar." ON storage.objects;
CREATE POLICY "Anyone can upload an avatar." ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

-- 允许登录用户更新 (覆盖)
DROP POLICY IF EXISTS "Anyone can update their own avatar." ON storage.objects;
CREATE POLICY "Anyone can update their own avatar." ON storage.objects FOR UPDATE USING ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

-- 3. 设置 Project Images 桶权限

-- 允许公开读取
DROP POLICY IF EXISTS "Project images are publicly accessible." ON storage.objects;
CREATE POLICY "Project images are publicly accessible." ON storage.objects FOR SELECT USING ( bucket_id = 'project-images' );

-- 允许登录用户上传
DROP POLICY IF EXISTS "Anyone can upload project images." ON storage.objects;
CREATE POLICY "Anyone can upload project images." ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'project-images' AND auth.role() = 'authenticated' );

-- 4. 提示
DO $$
BEGIN
  RAISE NOTICE '✅ 存储桶修复完成！';
  RAISE NOTICE '📦 已确保 avatars 和 project-images 桶存在';
  RAISE NOTICE '🔒 已重置访问策略';
END $$;
-- ============================================
-- 修复删除权限和 RLS 策略
-- ============================================
-- 创建日期: 2025-11-26
-- 说明: 补全缺失的 RLS 策略,支持安全的删除操作
-- ============================================

-- ============================================
-- 1. 更新评论删除策略
-- ============================================

-- 删除旧策略(如果存在)
DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;
DROP POLICY IF EXISTS "Users can delete own comments or moderators can delete any" ON public.comments;

-- 创建新的删除策略:作者或管理员/版主可以删除
CREATE POLICY "Authors and moderators can delete comments"
  ON public.comments FOR DELETE
  USING (
    auth.uid() = author_id 
    OR is_moderator_or_admin()
  );

COMMENT ON POLICY "Authors and moderators can delete comments" ON public.comments 
  IS '评论作者或管理员/版主可以删除评论';

-- ============================================
-- 2. 讨论回复删除策略
-- ============================================

-- 检查表是否存在
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'discussion_replies'
  ) THEN
    -- 删除旧策略
    DROP POLICY IF EXISTS "Users can delete own replies" ON public.discussion_replies;
    DROP POLICY IF EXISTS "Authors and moderators can delete replies" ON public.discussion_replies;
    
    -- 创建新策略
    EXECUTE 'CREATE POLICY "Authors and moderators can delete discussion replies"
      ON public.discussion_replies FOR DELETE
      USING (
        auth.uid() = author_id 
        OR is_moderator_or_admin()
      )';
    
    EXECUTE 'COMMENT ON POLICY "Authors and moderators can delete discussion replies" ON public.discussion_replies 
      IS ''讨论回复作者或管理员/版主可以删除回复''';
  END IF;
END $$;

-- ============================================
-- 3. 补全 user_badges 策略
-- ============================================

-- UPDATE 策略:用户可以更新自己的徽章
DROP POLICY IF EXISTS "Users can update own badges" ON public.user_badges;
CREATE POLICY "Users can update own badges"
  ON public.user_badges FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE 策略:只有管理员可以删除徽章
DROP POLICY IF EXISTS "Admins can delete badges" ON public.user_badges;
CREATE POLICY "Admins can delete badges"
  ON public.user_badges FOR DELETE
  USING (is_admin());

COMMENT ON POLICY "Users can update own badges" ON public.user_badges 
  IS '用户可以更新自己的徽章记录';
COMMENT ON POLICY "Admins can delete badges" ON public.user_badges 
  IS '只有管理员可以删除徽章';

-- ============================================
-- 4. Storage 删除策略 (需要手动在 Dashboard 配置)
-- ============================================
-- 注意: storage.objects 表属于 storage schema,需要在 Supabase Dashboard 中配置  
-- 无法通过普通迁移脚本直接修改
--
-- 请在 Supabase Dashboard 中手动配置以下策略:
-- 
-- Storage → Policies → avatars bucket:
--   1. 添加 DELETE 策略
--      名称: Users can delete own avatars
--      操作: DELETE
--      策略表达式: bucket_id = 'avatars' AND auth.role() = 'authenticated'
--
-- Storage → Policies → project-images bucket:
--   1. 添加 DELETE 策略  
--      名称: Users can delete project images
--      操作: DELETE
--      策略表达式: bucket_id = 'project-images' AND auth.role() = 'authenticated'

-- ============================================
-- 5. 验证关键策略
-- ============================================

-- 检查 is_moderator_or_admin 函数是否存在
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'is_moderator_or_admin'
  ) THEN
    RAISE WARNING '警告: is_moderator_or_admin() 函数不存在,请先运行权限系统迁移脚本';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'is_admin'
  ) THEN
    RAISE WARNING '警告: is_admin() 函数不存在,请先运行权限系统迁移脚本';
  END IF;
END $$;

-- ============================================
-- 完成提示
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ RLS 策略修复完成！';
  RAISE NOTICE '🗑️  已更新评论和讨论回复的删除策略';
  RAISE NOTICE '🏅 已补全 user_badges 的 UPDATE 和 DELETE 策略';
  RAISE NOTICE '⚠️  Storage DELETE 策略需要在 Supabase Dashboard 中手动配置';
  RAISE NOTICE '🔒 现在可以安全地移除 API 中的 admin 客户端使用';
  RAISE NOTICE '';
  RAISE NOTICE '📋 下一步操作:';
  RAISE NOTICE '   1. 登录 Supabase Dashboard';
  RAISE NOTICE '   2. 进入 Storage → Policies';
  RAISE NOTICE '   3. 为 avatars 和 project-images 添加 DELETE 策略';
  RAISE NOTICE '   详见迁移脚本中的注释说明';
END $$;
-- ============================================
-- 添加性能优化索引
-- ============================================
-- 创建日期: 2025-11-26
-- 说明: 为常用查询字段添加索引,提升查询性能
-- ============================================

-- ============================================
-- 1. Projects 表索引
-- ============================================

-- 作者和状态复合索引(用于用户查看自己的项目)
CREATE INDEX IF NOT EXISTS idx_projects_author_status 
  ON public.projects(author_id, status);

-- 分类和状态复合索引(用于按分类筛选)
CREATE INDEX IF NOT EXISTS idx_projects_category_status 
  ON public.projects(category, status);

-- 创建时间降序索引(用于按时间排序)
CREATE INDEX IF NOT EXISTS idx_projects_created_at_desc 
  ON public.projects(created_at DESC);

-- 状态索引(用于管理员查看待审核项目)
-- 注意: idx_projects_status 已在权限系统迁移中创建,这里跳过

COMMENT ON INDEX idx_projects_author_status IS '项目作者和状态复合索引';
COMMENT ON INDEX idx_projects_category_status IS '项目分类和状态复合索引';
COMMENT ON INDEX idx_projects_created_at_desc IS '项目创建时间降序索引';

-- ============================================
-- 2. Likes 表索引
-- ============================================

-- 用户和项目复合索引(用于检查是否已点赞)
CREATE INDEX IF NOT EXISTS idx_likes_user_project 
  ON public.likes(user_id, project_id);

-- 项目索引(用于统计项目的点赞数)
CREATE INDEX IF NOT EXISTS idx_likes_project 
  ON public.likes(project_id);

COMMENT ON INDEX idx_likes_user_project IS '点赞用户和项目复合索引';
COMMENT ON INDEX idx_likes_project IS '点赞项目索引';

-- ============================================
-- 3. Comments 表索引
-- ============================================

-- 项目和创建时间复合索引(用于按时间排序项目评论)
CREATE INDEX IF NOT EXISTS idx_comments_project_created 
  ON public.comments(project_id, created_at DESC);

-- 作者索引(用于查询用户的所有评论)
CREATE INDEX IF NOT EXISTS idx_comments_author 
  ON public.comments(author_id);

COMMENT ON INDEX idx_comments_project_created IS '评论项目和创建时间复合索引';
COMMENT ON INDEX idx_comments_author IS '评论作者索引';

-- ============================================
-- 4. Discussion Replies 表索引
-- ============================================

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'discussion_replies'
  ) THEN
    -- 讨论和创建时间复合索引
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_discussion_replies_discussion_created 
      ON public.discussion_replies(discussion_id, created_at DESC)';
    
    -- 作者索引
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_discussion_replies_author 
      ON public.discussion_replies(author_id)';
    
    EXECUTE 'COMMENT ON INDEX idx_discussion_replies_discussion_created 
      IS ''讨论回复和创建时间复合索引''';
    EXECUTE 'COMMENT ON INDEX idx_discussion_replies_author 
      IS ''讨论回复作者索引''';
  END IF;
END $$;

-- ============================================
-- 5. User Badges 表索引
-- ============================================

-- 用户索引(用于查询用户的所有徽章)
CREATE INDEX IF NOT EXISTS idx_user_badges_user 
  ON public.user_badges(user_id);

-- 用户和徽章复合唯一索引(防止重复徽章)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_badges_user_badge_unique 
  ON public.user_badges(user_id, badge_id);

COMMENT ON INDEX idx_user_badges_user IS '用户徽章用户索引';
COMMENT ON INDEX idx_user_badges_user_badge_unique IS '用户徽章唯一索引';

-- ============================================
-- 6. Profiles 表索引
-- ============================================

-- username 唯一索引(应该已存在)
-- role 索引(已在权限系统迁移中创建)

-- ============================================
-- 完成提示
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ 性能优化索引创建完成！';
  RAISE NOTICE '📊 为 projects 表添加了 3 个索引';
  RAISE NOTICE '👍 为 likes 表添加了 2 个索引';
  RAISE NOTICE '💬 为 comments 表添加了 2 个索引';
  RAISE NOTICE '🗨️  为 discussion_replies 表添加了 2 个索引';
  RAISE NOTICE '🏅 为 user_badges 表添加了 2 个索引';
  RAISE NOTICE '🚀 查询性能将得到显著提升！';
END $$;
-- ============================================
-- 紧急修复: 补充 discussion_replies 的 INSERT 和 SELECT 策略
-- ============================================
-- 说明: 之前的迁移只创建了 DELETE 策略,导致无法插入和查看回复
-- ============================================

-- 1. 允许所有人查看讨论回复 (SELECT)
DROP POLICY IF EXISTS "Anyone can view discussion replies" ON public.discussion_replies;
CREATE POLICY "Anyone can view discussion replies"
  ON public.discussion_replies FOR SELECT
  USING (true);

-- 2. 允许登录用户添加回复 (INSERT)
DROP POLICY IF EXISTS "Authenticated users can add replies" ON public.discussion_replies;
CREATE POLICY "Authenticated users can add replies"
  ON public.discussion_replies FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = author_id);

-- 3. 同时为 comments 表补充策略(如果缺失)
DROP POLICY IF EXISTS "Anyone can view comments" ON public.comments;
CREATE POLICY "Anyone can view comments"
  ON public.comments FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can add comments" ON public.comments;
CREATE POLICY "Authenticated users can add comments"
  ON public.comments FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = author_id);

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '✅ 紧急修复完成!';
  RAISE NOTICE '👀 已添加 SELECT 策略 - 允许查看回复和评论';
  RAISE NOTICE '✍️  已添加 INSERT 策略 - 允许登录用户添加回复和评论';
  RAISE NOTICE '🔧 现在应该可以正常回复了';
END $$;
-- Migration: Add reply nesting support for discussions and comments
-- This allows users to reply to specific comments/replies and shows conversation threads

-- Add reply relationship fields to discussion_replies table
ALTER TABLE discussion_replies
ADD COLUMN IF NOT EXISTS parent_id BIGINT REFERENCES discussion_replies(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS reply_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reply_to_username TEXT;

-- Add reply relationship fields to comments table
ALTER TABLE comments
ADD COLUMN IF NOT EXISTS parent_id BIGINT REFERENCES comments(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS reply_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reply_to_username TEXT;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_discussion_replies_parent ON discussion_replies(parent_id);
CREATE INDEX IF NOT EXISTS idx_discussion_replies_discussion ON discussion_replies(discussion_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_project ON comments(project_id);

-- Add comments to document the schema
COMMENT ON COLUMN discussion_replies.parent_id IS 'ID of the parent reply if this is a nested reply';
COMMENT ON COLUMN discussion_replies.reply_to_user_id IS 'User ID being replied to';
COMMENT ON COLUMN discussion_replies.reply_to_username IS 'Username being replied to (denormalized for display)';
COMMENT ON COLUMN comments.parent_id IS 'ID of the parent comment if this is a nested reply';
COMMENT ON COLUMN comments.reply_to_user_id IS 'User ID being replied to';
COMMENT ON COLUMN comments.reply_to_username IS 'Username being replied to (denormalized for display)';
-- Migration: Create notifications system
-- Allows users to receive notifications for mentions, replies, and other events

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('mention', 'reply', 'like', 'follow', 'system')),
  content TEXT NOT NULL,
  related_type TEXT CHECK (related_type IN ('comment', 'discussion_reply', 'project', 'discussion')),
  related_id BIGINT,
  from_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  from_username TEXT,
  is_read BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Anyone can create notifications (for system/backend)
CREATE POLICY "Anyone can create notifications"
  ON notifications
  FOR INSERT
  WITH CHECK (true);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON notifications
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE notifications IS 'Stores user notifications for various events like mentions, replies, etc.';
-- Migration: Add navigation fields to notifications
-- This allows notifications to include project_id and discussion_id for proper navigation

-- Add project_id and discussion_id columns to notifications table
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS project_id BIGINT,
ADD COLUMN IF NOT EXISTS discussion_id BIGINT;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_notifications_project ON notifications(project_id);
CREATE INDEX IF NOT EXISTS idx_notifications_discussion ON notifications(discussion_id);

-- Add comments to document the schema
COMMENT ON COLUMN notifications.project_id IS 'Project ID for comment notifications (to enable navigation)';
COMMENT ON COLUMN notifications.discussion_id IS 'Discussion ID for discussion_reply notifications (to enable navigation)';
-- Migration: Add avatar URL to notifications
-- This allows notifications to display the correct user avatar

-- Add from_avatar column to notifications table
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS from_avatar TEXT;

-- Add comment
COMMENT ON COLUMN notifications.from_avatar IS 'Avatar URL of the user who triggered the notification';
-- ============================================
-- 添加搜索功能相关字段
-- ============================================
-- 创建日期: 2025-11-28
-- 说明: 为 projects 表添加难度、时长、标签和全文搜索支持
-- ============================================

-- ============================================
-- 1. 添加新字段
-- ============================================

-- 添加难度等级字段
ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard'));

-- 添加预计时长字段（分钟）
ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS duration INTEGER CHECK (duration > 0 AND duration <= 1440);

-- 添加标签数组字段
ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- 添加全文搜索字段
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

COMMENT ON COLUMN public.projects.difficulty IS '项目难度等级: easy/medium/hard';
COMMENT ON COLUMN public.projects.duration IS '预计完成时长（分钟）';
COMMENT ON COLUMN public.projects.tags IS '项目标签数组';
COMMENT ON COLUMN public.projects.search_vector IS '全文搜索向量';

-- ============================================
-- 2. 创建索引
-- ============================================

-- 创建全文搜索索引（GIN 索引）
CREATE INDEX IF NOT EXISTS idx_projects_search 
  ON public.projects USING GIN(search_vector);

-- 创建难度索引（部分索引，只索引非空值）
CREATE INDEX IF NOT EXISTS idx_projects_difficulty 
  ON public.projects(difficulty) WHERE difficulty IS NOT NULL;

-- 创建时长索引（部分索引）
CREATE INDEX IF NOT EXISTS idx_projects_duration 
  ON public.projects(duration) WHERE duration IS NOT NULL;

-- 创建标签索引（GIN 索引用于数组）
CREATE INDEX IF NOT EXISTS idx_projects_tags 
  ON public.projects USING GIN(tags);

COMMENT ON INDEX idx_projects_search IS '项目全文搜索索引';
COMMENT ON INDEX idx_projects_difficulty IS '项目难度索引';
COMMENT ON INDEX idx_projects_duration IS '项目时长索引';
COMMENT ON INDEX idx_projects_tags IS '项目标签GIN索引';

-- ============================================
-- 3. 创建触发器函数
-- ============================================

-- 创建或替换触发器函数：自动更新搜索向量
CREATE OR REPLACE FUNCTION update_projects_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  -- 组合标题、描述和标签到搜索向量
  -- 标题权重最高 (A)，描述次之 (B)，标签第三 (C)
  NEW.search_vector := 
    setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_projects_search_vector() IS '自动更新项目搜索向量的触发器函数';

-- ============================================
-- 4. 创建触发器
-- ============================================

-- 删除旧触发器（如果存在）
DROP TRIGGER IF EXISTS projects_search_vector_update ON public.projects;

-- 创建触发器：在插入或更新时自动更新搜索向量
CREATE TRIGGER projects_search_vector_update
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION update_projects_search_vector();

COMMENT ON TRIGGER projects_search_vector_update ON public.projects IS '自动更新项目搜索向量';

-- ============================================
-- 5. 为现有数据初始化搜索向量
-- ============================================

-- 为所有现有项目生成搜索向量
UPDATE public.projects
SET search_vector = 
  setweight(to_tsvector('simple', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE(description, '')), 'B')
WHERE search_vector IS NULL;

-- ============================================
-- 完成提示
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ 搜索功能字段添加完成！';
  RAISE NOTICE '📊 已添加字段: difficulty, duration, tags, search_vector';
  RAISE NOTICE '🔍 已创建 4 个索引';
  RAISE NOTICE '⚡ 已创建自动更新搜索向量的触发器';
  RAISE NOTICE '🚀 搜索功能已就绪！';
END $$;
-- 添加回复计数和最后回复时间字段到discussions表
-- 这将提高"回复最多"和"回复最新"排序的性能

-- 1. 添加回复计数字段和最后回复时间字段
ALTER TABLE discussions ADD COLUMN IF NOT EXISTS replies_count INTEGER DEFAULT 0;
ALTER TABLE discussions ADD COLUMN IF NOT EXISTS last_reply_at TIMESTAMP WITH TIME ZONE;

-- 2. 初始化现有数据的回复数和最后回复时间
-- 统计每个讨论的回复数并更新
UPDATE discussions SET replies_count = (
    SELECT COUNT(*) FROM discussion_replies 
    WHERE discussion_replies.discussion_id = discussions.id
);

-- 更新最后回复时间为该讨论最新回复的创建时间
UPDATE discussions SET last_reply_at = (
    SELECT MAX(created_at) FROM discussion_replies 
    WHERE discussion_replies.discussion_id = discussions.id
);

-- 3. 创建触发器函数:新增回复时增加计数并更新最后回复时间
CREATE OR REPLACE FUNCTION increment_discussion_replies_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE discussions 
    SET replies_count = replies_count + 1,
        last_reply_at = NEW.created_at
    WHERE id = NEW.discussion_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. 创建触发器函数:删除回复时减少计数并重新计算最后回复时间
CREATE OR REPLACE FUNCTION decrement_discussion_replies_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE discussions 
    SET replies_count = replies_count - 1,
        last_reply_at = (
            SELECT MAX(created_at) FROM discussion_replies 
            WHERE discussion_id = OLD.discussion_id
        )
    WHERE id = OLD.discussion_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 5. 绑定触发器到discussion_replies表
DROP TRIGGER IF EXISTS discussion_replies_insert_trigger ON discussion_replies;
CREATE TRIGGER discussion_replies_insert_trigger
    AFTER INSERT ON discussion_replies
    FOR EACH ROW
    EXECUTE FUNCTION increment_discussion_replies_count();

DROP TRIGGER IF EXISTS discussion_replies_delete_trigger ON discussion_replies;
CREATE TRIGGER discussion_replies_delete_trigger
    AFTER DELETE ON discussion_replies
    FOR EACH ROW
    EXECUTE FUNCTION decrement_discussion_replies_count();

-- 6. 添加索引以优化排序性能
CREATE INDEX IF NOT EXISTS idx_discussions_replies_count ON discussions(replies_count DESC);
CREATE INDEX IF NOT EXISTS idx_discussions_likes_count ON discussions(likes_count DESC);
CREATE INDEX IF NOT EXISTS idx_discussions_created_at ON discussions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discussions_last_reply_at ON discussions(last_reply_at DESC NULLS LAST);

-- 说明:
-- - replies_count字段会自动通过触发器保持同步
-- - last_reply_at字段记录最后一次回复的时间,用于"回复最新"排序
-- - 添加了索引以优化四种排序方式的性能(最新发布、最热门、回复最多、回复最新)
-- - 触发器确保数据一致性
-- - 删除回复时会重新计算last_reply_at,确保准确性
-- 修复 PostgREST 缺失的关系并保留孤儿项目

DO $$
DECLARE
  -- ⚠️⚠️⚠️ 请将下面的 ID 替换为您的真实 User ID (作为管理员接收所有孤儿项目) ⚠️⚠️⚠️
  -- 您可以在 Supabase Dashboard -> Authentication -> Users 中找到您的 ID
  target_admin_id uuid := 'fc9f4384-2bb5-418e-a2e2-8c29bff6e7c5'; 
BEGIN
  -- 1. 检查是否替换了 ID
  IF target_admin_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
     RAISE EXCEPTION '❌ 请先在脚本第 6 行填入有效的管理员 User ID！';
  END IF;

  -- 2. 尝试为目标管理员回填 profile (确保管理员有 profile)
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  SELECT 
    id, 
    raw_user_meta_data->>'username', 
    raw_user_meta_data->>'full_name', 
    '/avatars/default-1.svg'
  FROM auth.users
  WHERE id = target_admin_id
  ON CONFLICT (id) DO NOTHING;

  -- 3. 将孤儿项目（作者不存在的项目）重新分配给管理员
  UPDATE public.projects
  SET author_id = target_admin_id
  WHERE author_id NOT IN (SELECT id FROM public.profiles);

  RAISE NOTICE '✅ 已将所有孤儿项目重新分配给用户: %', target_admin_id;
END $$;

-- 4. 添加外键约束
-- 现在所有项目都有有效的 author_id 了，可以安全添加约束
ALTER TABLE public.projects
ADD CONSTRAINT projects_author_id_fkey_profiles
FOREIGN KEY (author_id)
REFERENCES public.profiles(id);
-- 确保 project_materials 和 project_steps 与 projects 的外键关系存在
-- 同时也强制刷新 PostgREST schema 缓存

DO $$
BEGIN
    -- 0. 清理孤儿数据 (防止添加外键时报错)
    -- 删除那些指向不存在项目的材料和步骤
    DELETE FROM public.project_materials WHERE project_id NOT IN (SELECT id FROM public.projects);
    DELETE FROM public.project_steps WHERE project_id NOT IN (SELECT id FROM public.projects);

    -- 1. 检查并修复 project_materials 的外键
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'project_materials_project_id_fkey'
    ) THEN
        -- 如果约束不存在（可能是自动生成的名称不同，或者根本没有），尝试添加
        -- 先尝试删除可能存在的旧约束（为了安全）
        BEGIN
            ALTER TABLE public.project_materials DROP CONSTRAINT IF EXISTS project_materials_project_id_fkey;
        EXCEPTION WHEN OTHERS THEN NULL; END;

        ALTER TABLE public.project_materials
        ADD CONSTRAINT project_materials_project_id_fkey
        FOREIGN KEY (project_id)
        REFERENCES public.projects(id)
        ON DELETE CASCADE;
        
        RAISE NOTICE '✅ 已修复 project_materials 外键';
    ELSE
        RAISE NOTICE 'ℹ️ project_materials 外键已存在';
    END IF;

    -- 2. 检查并修复 project_steps 的外键
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'project_steps_project_id_fkey'
    ) THEN
        BEGIN
            ALTER TABLE public.project_steps DROP CONSTRAINT IF EXISTS project_steps_project_id_fkey;
        EXCEPTION WHEN OTHERS THEN NULL; END;

        ALTER TABLE public.project_steps
        ADD CONSTRAINT project_steps_project_id_fkey
        FOREIGN KEY (project_id)
        REFERENCES public.projects(id)
        ON DELETE CASCADE;

        RAISE NOTICE '✅ 已修复 project_steps 外键';
    ELSE
        RAISE NOTICE 'ℹ️ project_steps 外键已存在';
    END IF;

END $$;

-- 3. 强制刷新 PostgREST 缓存
NOTIFY pgrst, 'reload config';
-- 修复社交功能表（讨论、评论等）的缺失关系
-- 同样是为了解决 PGRST200 错误，允许查询作者详情

DO $$
BEGIN
    -- 1. 修复 discussions (讨论)
    -- 清理孤儿数据
    DELETE FROM public.discussions WHERE author_id NOT IN (SELECT id FROM public.profiles);
    
    -- 添加外键 (如果不存在)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discussions_author_id_fkey_profiles') THEN
        ALTER TABLE public.discussions
        ADD CONSTRAINT discussions_author_id_fkey_profiles
        FOREIGN KEY (author_id)
        REFERENCES public.profiles(id);
    END IF;

    -- 2. 修复 comments (评论)
    DELETE FROM public.comments WHERE author_id NOT IN (SELECT id FROM public.profiles);
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comments_author_id_fkey_profiles') THEN
        ALTER TABLE public.comments
        ADD CONSTRAINT comments_author_id_fkey_profiles
        FOREIGN KEY (author_id)
        REFERENCES public.profiles(id);
    END IF;

    -- 3. 修复 discussion_replies (讨论回复)
    DELETE FROM public.discussion_replies WHERE author_id NOT IN (SELECT id FROM public.profiles);
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discussion_replies_author_id_fkey_profiles') THEN
        ALTER TABLE public.discussion_replies
        ADD CONSTRAINT discussion_replies_author_id_fkey_profiles
        FOREIGN KEY (author_id)
        REFERENCES public.profiles(id);
    END IF;

    RAISE NOTICE '✅ 已修复所有社交表的外键关系';
END $$;

-- 强制刷新 PostgREST 缓存
NOTIFY pgrst, 'reload config';
-- 修复 comments 表缺失的外键关系
-- 确保 Supabase PostgREST 能正确识别关系

DO $$
BEGIN
    -- 1. 修复 comments 表的 project_id 外键（如果不存在则添加）
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'comments_project_id_fkey' 
        AND conrelid = 'public.comments'::regclass
    ) THEN
        -- 清理孤儿数据
        DELETE FROM public.comments 
        WHERE project_id NOT IN (SELECT id FROM public.projects);
        
        -- 添加外键
        ALTER TABLE public.comments
        ADD CONSTRAINT comments_project_id_fkey
        FOREIGN KEY (project_id)
        REFERENCES public.projects(id)
        ON DELETE CASCADE;
        
        RAISE NOTICE '✅ 已添加 comments.project_id 外键';
    ELSE
        RAISE NOTICE '✅ comments.project_id 外键已存在';
    END IF;

    -- 2. 确保 comments 表的 author_id 外键指向 profiles（不是 auth.users）
    -- 这样 PostgREST 才能通过 profiles 关联查询
    
    -- 首先删除旧的指向 auth.users 的外键（如果存在）
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'comments_author_id_fkey' 
        AND conrelid = 'public.comments'::regclass
    ) THEN
        ALTER TABLE public.comments
        DROP CONSTRAINT comments_author_id_fkey;
        
        RAISE NOTICE '🗑️  已删除旧的 comments.author_id 外键';
    END IF;
    
    -- 添加新的外键指向 profiles 表
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'comments_author_id_fkey_profiles' 
        AND conrelid = 'public.comments'::regclass
    ) THEN
        -- 清理孤儿数据
        DELETE FROM public.comments 
        WHERE author_id NOT IN (SELECT id FROM public.profiles);
        
        -- 添加外键
        ALTER TABLE public.comments
        ADD CONSTRAINT comments_author_id_fkey_profiles
        FOREIGN KEY (author_id)
        REFERENCES public.profiles(id)
        ON DELETE CASCADE;
        
        RAISE NOTICE '✅ 已添加 comments.author_id 外键指向 profiles';
    ELSE
        RAISE NOTICE '✅ comments.author_id 外键已存在';
    END IF;

    RAISE NOTICE '🎉 comments 表外键关系修复完成';
END $$;

-- 刷新 PostgREST 缓存
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
-- 修复 discussion_replies 表的外键关系
-- 确保 PostgREST 能正确识别关联

DO $$
BEGIN
    -- 1. 修复 discussion_replies 的 discussion_id 外键
    -- 检查并确保外键存在
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'discussion_replies_discussion_id_fkey' 
        AND conrelid = 'public.discussion_replies'::regclass
    ) THEN
        -- 清理孤儿数据
        DELETE FROM public.discussion_replies 
        WHERE discussion_id NOT IN (SELECT id FROM public.discussions);
        
        -- 添加外键
        ALTER TABLE public.discussion_replies
        ADD CONSTRAINT discussion_replies_discussion_id_fkey
        FOREIGN KEY (discussion_id)
        REFERENCES public.discussions(id)
        ON DELETE CASCADE;
        
        RAISE NOTICE '✅ 已添加 discussion_replies.discussion_id 外键';
    ELSE
        RAISE NOTICE '✅ discussion_replies.discussion_id 外键已存在';
    END IF;

    -- 2. 修复 discussion_replies 的 author_id 外键（指向 profiles）
    -- 首先删除旧的指向 auth.users 的外键
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'discussion_replies_author_id_fkey' 
        AND conrelid = 'public.discussion_replies'::regclass
    ) THEN
        ALTER TABLE public.discussion_replies
        DROP CONSTRAINT discussion_replies_author_id_fkey;
        
        RAISE NOTICE '🗑️  已删除旧的 discussion_replies.author_id 外键';
    END IF;
    
    -- 添加新的外键指向 profiles 表
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'discussion_replies_author_id_fkey_profiles' 
        AND conrelid = 'public.discussion_replies'::regclass
    ) THEN
        -- 清理孤儿数据
        DELETE FROM public.discussion_replies 
        WHERE author_id NOT IN (SELECT id FROM public.profiles);
        
        -- 添加外键
        ALTER TABLE public.discussion_replies
        ADD CONSTRAINT discussion_replies_author_id_fkey_profiles
        FOREIGN KEY (author_id)
        REFERENCES public.profiles(id)
        ON DELETE CASCADE;
        
        RAISE NOTICE '✅ 已添加 discussion_replies.author_id 外键指向 profiles';
    ELSE
        RAISE NOTICE '✅ discussion_replies.author_id 外键已存在';
    END IF;

    -- 3. 同时检查 discussions 表的 author_id 外键
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'discussions_author_id_fkey' 
        AND conrelid = 'public.discussions'::regclass
    ) THEN
        ALTER TABLE public.discussions
        DROP CONSTRAINT discussions_author_id_fkey;
        
        RAISE NOTICE '🗑️  已删除旧的 discussions.author_id 外键';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'discussions_author_id_fkey_profiles' 
        AND conrelid = 'public.discussions'::regclass
    ) THEN
        -- 清理孤儿数据
        DELETE FROM public.discussions 
        WHERE author_id NOT IN (SELECT id FROM public.profiles);
        
        -- 添加外键
        ALTER TABLE public.discussions
        ADD CONSTRAINT discussions_author_id_fkey_profiles
        FOREIGN KEY (author_id)
        REFERENCES public.profiles(id)
        ON DELETE CASCADE;
        
        RAISE NOTICE '✅ 已添加 discussions.author_id 外键指向 profiles';
    ELSE
        RAISE NOTICE '✅ discussions.author_id 外键已存在';
    END IF;

    RAISE NOTICE '🎉 discussion_replies 表外键关系修复完成';
END $$;

-- 强制刷新 PostgREST 缓存
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
-- ============================================
-- 完成项目验证机制迁移
-- ============================================
-- 创建日期: 2024-11-30
-- 说明: 为 completed_projects 表添加证明字段，防止无限刷经验
-- ============================================

DO $$
BEGIN
    -- 1. 添加 ID 主键（如果还没有）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'completed_projects' 
        AND column_name = 'id'
    ) THEN
        -- 先删除旧的主键约束
        ALTER TABLE public.completed_projects DROP CONSTRAINT IF EXISTS completed_projects_pkey;
        
        -- 添加 ID 列
        ALTER TABLE public.completed_projects ADD COLUMN id bigserial;
        
        -- 设置为主键
        ALTER TABLE public.completed_projects ADD PRIMARY KEY (id);
        
        -- 添加唯一约束（user_id, project_id）
        ALTER TABLE public.completed_projects 
        ADD CONSTRAINT completed_projects_user_project_unique 
        UNIQUE (user_id, project_id);
        
        RAISE NOTICE '✅ 已添加 ID 主键列';
    END IF;

    -- 2. 添加证明图片字段（数组）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'completed_projects' 
        AND column_name = 'proof_images'
    ) THEN
        ALTER TABLE public.completed_projects 
        ADD COLUMN proof_images text[];
        
        RAISE NOTICE '✅ 已添加 proof_images 字段';
    END IF;

    -- 3. 添加证明视频字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'completed_projects' 
        AND column_name = 'proof_video_url'
    ) THEN
        ALTER TABLE public.completed_projects 
        ADD COLUMN proof_video_url text;
        
        RAISE NOTICE '✅ 已添加 proof_video_url 字段';
    END IF;

    -- 4. 添加完成笔记字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'completed_projects' 
        AND column_name = 'notes'
    ) THEN
        ALTER TABLE public.completed_projects 
        ADD COLUMN notes text;
        
        RAISE NOTICE '✅ 已添加 notes 字段';
    END IF;

    -- 5. 添加验证状态字段（可选）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'completed_projects' 
        AND column_name = 'is_verified'
    ) THEN
        ALTER TABLE public.completed_projects 
        ADD COLUMN is_verified boolean DEFAULT false;
        
        RAISE NOTICE '✅ 已添加 is_verified 字段';
    END IF;

    -- 6. 添加验证人字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'completed_projects' 
        AND column_name = 'verified_by'
    ) THEN
        ALTER TABLE public.completed_projects 
        ADD COLUMN verified_by uuid REFERENCES auth.users(id);
        
        RAISE NOTICE '✅ 已添加 verified_by 字段';
    END IF;

    -- 7. 添加点赞数字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'completed_projects' 
        AND column_name = 'likes_count'
    ) THEN
        ALTER TABLE public.completed_projects 
        ADD COLUMN likes_count int DEFAULT 0;
        
        RAISE NOTICE '✅ 已添加 likes_count 字段';
    END IF;

    -- 8. 添加举报数字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'completed_projects' 
        AND column_name = 'report_count'
    ) THEN
        ALTER TABLE public.completed_projects 
        ADD COLUMN report_count int DEFAULT 0;
        
        RAISE NOTICE '✅ 已添加 report_count 字段';
    END IF;

END $$;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_completed_projects_user 
ON public.completed_projects(user_id);

CREATE INDEX IF NOT EXISTS idx_completed_projects_project 
ON public.completed_projects(project_id);

CREATE INDEX IF NOT EXISTS idx_completed_projects_verified 
ON public.completed_projects(is_verified);

-- 添加注释
COMMENT ON COLUMN public.completed_projects.id IS '主键ID';
COMMENT ON COLUMN public.completed_projects.proof_images IS '完成证明图片数组';
COMMENT ON COLUMN public.completed_projects.proof_video_url IS '完成证明视频URL';
COMMENT ON COLUMN public.completed_projects.notes IS '完成笔记或心得';
COMMENT ON COLUMN public.completed_projects.is_verified IS '是否已验证（审核员）';
COMMENT ON COLUMN public.completed_projects.verified_by IS '验证人ID';
COMMENT ON COLUMN public.completed_projects.likes_count IS '点赞数';
COMMENT ON COLUMN public.completed_projects.report_count IS '举报数';

-- ============================================
-- 完成提示
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '🎉 完成项目验证机制迁移完成！';
  RAISE NOTICE '📸 现在需要上传证明图片才能完成项目';
  RAISE NOTICE '🛡️ 可选的审核员验证机制已就绪';
  RAISE NOTICE '❤️ 支持社区点赞和举报';
END $$;
-- ============================================
-- 审核员申请系统迁移
-- ============================================
-- 创建日期: 2024-11-30
-- 说明: 创建审核员申请表和行为日志表
-- ============================================

-- ============================================
-- 1. 审核员申请表
-- ============================================
CREATE TABLE IF NOT EXISTS public.moderator_applications (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- 申请时的用户数据快照（用于审核参考）
  level_at_application int NOT NULL,
  xp_at_application int NOT NULL,
  projects_published int NOT NULL,
  projects_completed int NOT NULL,
  comments_count int NOT NULL,
  badges_count int NOT NULL,
  account_age_days int NOT NULL,
  
  -- 申请信息
  motivation text NOT NULL, -- 申请动机（为什么想成为审核员）
  
  -- 审核信息
  status text DEFAULT 'pending', -- pending, approved, rejected
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamp with time zone,
  rejection_reason text,
  
  -- 时间戳
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT status_check CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_moderator_applications_user 
  ON public.moderator_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_moderator_applications_status 
  ON public.moderator_applications(status);
CREATE INDEX IF NOT EXISTS idx_moderator_applications_created_at 
  ON public.moderator_applications(created_at DESC);

-- 注释
COMMENT ON TABLE public.moderator_applications IS '审核员申请表';
COMMENT ON COLUMN public.moderator_applications.level_at_application IS '申请时的等级';
COMMENT ON COLUMN public.moderator_applications.xp_at_application IS '申请时的经验值';
COMMENT ON COLUMN public.moderator_applications.motivation IS '申请动机说明';
COMMENT ON COLUMN public.moderator_applications.status IS '申请状态: pending/approved/rejected';

-- ============================================
-- 2. 审核员行为日志表
-- ============================================
CREATE TABLE IF NOT EXISTS public.moderator_actions (
  id bigserial PRIMARY KEY,
  moderator_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action_type text NOT NULL, -- approve_project, reject_project, delete_comment, verify_completion, reject_completion
  target_type text NOT NULL, -- project, comment, completion
  target_id bigint NOT NULL,
  reason text,
  metadata jsonb, -- 额外的元数据
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT action_type_check CHECK (
    action_type IN (
      'approve_project', 
      'reject_project', 
      'delete_comment', 
      'delete_discussion_reply',
      'verify_completion', 
      'reject_completion'
    )
  ),
  CONSTRAINT target_type_check CHECK (
    target_type IN ('project', 'comment', 'discussion_reply', 'completion')
  )
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_moderator_actions_moderator 
  ON public.moderator_actions(moderator_id);
CREATE INDEX IF NOT EXISTS idx_moderator_actions_created_at 
  ON public.moderator_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderator_actions_action_type 
  ON public.moderator_actions(action_type);

-- 注释
COMMENT ON TABLE public.moderator_actions IS '审核员行为日志表';
COMMENT ON COLUMN public.moderator_actions.action_type IS '操作类型';
COMMENT ON COLUMN public.moderator_actions.target_type IS '目标类型';
COMMENT ON COLUMN public.moderator_actions.target_id IS '目标ID';
COMMENT ON COLUMN public.moderator_actions.metadata IS '额外元数据（JSON格式）';

-- ============================================
-- 3. RLS 策略
-- ============================================

-- moderator_applications 表的 RLS
ALTER TABLE public.moderator_applications ENABLE ROW LEVEL SECURITY;

-- 用户可以查看自己的申请
CREATE POLICY "Users can view own applications"
  ON public.moderator_applications FOR SELECT
  USING (auth.uid() = user_id);

-- 用户可以创建申请（但有限制：每人只能有一个pending申请）
CREATE POLICY "Users can create applications"
  ON public.moderator_applications FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND NOT EXISTS (
      SELECT 1 FROM public.moderator_applications
      WHERE user_id = auth.uid() AND status = 'pending'
    )
  );

-- 管理员可以查看所有申请
CREATE POLICY "Admins can view all applications"
  ON public.moderator_applications FOR SELECT
  USING (is_admin());

-- 管理员可以更新申请状态
CREATE POLICY "Admins can update applications"
  ON public.moderator_applications FOR UPDATE
  USING (is_admin());

-- moderator_actions 表的 RLS
ALTER TABLE public.moderator_actions ENABLE ROW LEVEL SECURITY;

-- 审核员和管理员可以查看所有行为日志
CREATE POLICY "Moderators can view all actions"
  ON public.moderator_actions FOR SELECT
  USING (is_moderator_or_admin());

-- 审核员和管理员可以创建行为日志
CREATE POLICY "Moderators can create actions"
  ON public.moderator_actions FOR INSERT
  WITH CHECK (
    is_moderator_or_admin() AND auth.uid() = moderator_id
  );

-- ============================================
-- 4. 辅助函数
-- ============================================

-- 记录审核员行为
CREATE OR REPLACE FUNCTION public.log_moderator_action(
  p_action_type text,
  p_target_type text,
  p_target_id bigint,
  p_reason text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- 检查权限
  IF NOT is_moderator_or_admin() THEN
    RAISE EXCEPTION 'Permission denied: only moderators and admins can log actions';
  END IF;

  -- 插入日志
  INSERT INTO public.moderator_actions (
    moderator_id,
    action_type,
    target_type,
    target_id,
    reason,
    metadata
  ) VALUES (
    auth.uid(),
    p_action_type,
    p_target_type,
    p_target_id,
    p_reason,
    p_metadata
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.log_moderator_action IS '记录审核员行为日志';

-- 检查用户是否有待审核的申请
CREATE OR REPLACE FUNCTION public.has_pending_moderator_application(p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.moderator_applications
    WHERE user_id = p_user_id AND status = 'pending'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.has_pending_moderator_application IS '检查用户是否有待审核的审核员申请';

-- ============================================
-- 完成提示
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ 审核员申请系统迁移完成！';
  RAISE NOTICE '📝 创建了 moderator_applications 表';
  RAISE NOTICE '📊 创建了 moderator_actions 日志表';
  RAISE NOTICE '🔒 配置了 RLS 策略';
  RAISE NOTICE '🚀 可以开始接受审核员申请了！';
END $$;
-- ============================================
-- 拆分点赞与收藏功能
-- ============================================
-- 创建日期: 2024-11-30
-- 说明: 创建 collections 表，并迁移现有的 likes 数据
-- ============================================

-- 1. 创建 collections 表
CREATE TABLE IF NOT EXISTS public.collections (
    id bigserial PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    project_id bigint REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, project_id)
);

-- 2. 添加索引
CREATE INDEX IF NOT EXISTS idx_collections_user_id ON public.collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_project_id ON public.collections(project_id);

-- 3. 启用 RLS
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

-- 4. 添加 RLS 策略
-- 用户可以查看自己的收藏
CREATE POLICY "Users can view own collections"
    ON public.collections FOR SELECT
    USING (auth.uid() = user_id);

-- 用户可以添加收藏
CREATE POLICY "Users can create collections"
    ON public.collections FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 用户可以取消收藏
CREATE POLICY "Users can delete own collections"
    ON public.collections FOR DELETE
    USING (auth.uid() = user_id);

-- 5. 数据迁移：将现有的 likes 数据复制到 collections
-- 这样用户之前点赞的项目会自动成为收藏
INSERT INTO public.collections (user_id, project_id, created_at)
SELECT user_id, project_id, created_at
FROM public.likes
ON CONFLICT (user_id, project_id) DO NOTHING;

-- 6. 添加注释
COMMENT ON TABLE public.collections IS '用户收藏表';
-- Create xp_logs table to track XP history and prevent farming
create table if not exists public.xp_logs (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    action_type text not null,
    resource_id text,
    xp_amount integer not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    
    -- Prevent duplicate XP for the same action on the same resource
    constraint unique_user_action_resource unique (user_id, action_type, resource_id)
);

-- Enable RLS
alter table public.xp_logs enable row level security;

-- Policies
create policy "Users can view their own XP logs"
    on public.xp_logs for select
    using (auth.uid() = user_id);

create policy "Users can insert their own XP logs"
    on public.xp_logs for insert
    with check (auth.uid() = user_id);

-- Add indexes
create index idx_xp_logs_user_id on public.xp_logs(user_id);
create index idx_xp_logs_action_type on public.xp_logs(action_type);
-- ============================================
-- Supabase Storage 配置
-- ============================================
-- 创建项目图片存储桶并配置权限
-- ============================================

-- 创建 project-images 存储桶
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-images', 'project-images', true)
ON CONFLICT (id) DO NOTHING;

-- 允许所有人查看图片（因为是公开bucket）
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-images');

-- 允许认证用户上传图片到自己的文件夹
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-images' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 允许用户删除自己上传的图片
CREATE POLICY "Users can delete own images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'project-images'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 允许用户更新自己上传的图片
CREATE POLICY "Users can update own images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'project-images'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- 完成提示
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Storage 配置完成！';
  RAISE NOTICE '📦 已创建 project-images 存储桶';
  RAISE NOTICE '🔒 已配置存储策略';
END $$;
-- ============================================
-- 分类管理表
-- ============================================
-- 创建主分类表和子分类表，用于项目的分类管理
-- ============================================

-- ============================================
-- 1. 主分类表 (categories)
-- ============================================
CREATE TABLE IF NOT EXISTS public.categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 启用 RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- RLS 策略：所有人可读
CREATE POLICY "Categories are viewable by everyone"
  ON public.categories FOR SELECT
  USING (true);

-- 管理员可以管理分类
CREATE POLICY "Admins can manage categories"
  ON public.categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 2. 子分类表 (sub_categories)
-- ============================================
CREATE TABLE IF NOT EXISTS public.sub_categories (
  id SERIAL PRIMARY KEY,
  category_id INT REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(category_id, name)
);

-- 启用 RLS
ALTER TABLE public.sub_categories ENABLE ROW LEVEL SECURITY;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_sub_categories_category ON public.sub_categories(category_id);

-- RLS 策略：所有人可读
CREATE POLICY "Sub categories are viewable by everyone"
  ON public.sub_categories FOR SELECT
  USING (true);

-- 管理员可以管理子分类
CREATE POLICY "Admins can manage sub categories"
  ON public.sub_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 3. 插入初始分类数据
-- ============================================

-- 主分类
INSERT INTO public.categories (name, icon, sort_order) VALUES
  ('科学', '🔬', 1),
  ('技术', '💻', 2),
  ('工程', '🔧', 3),
  ('艺术', '🎨', 4),
  ('数学', '📐', 5),
  ('其他', '📦', 6);

-- 子分类
INSERT INTO public.sub_categories (category_id, name, sort_order) VALUES
  -- 科学 (category_id = 1)
  ((SELECT id FROM public.categories WHERE name = '科学'), '物理实验', 1),
  ((SELECT id FROM public.categories WHERE name = '科学'), '化学实验', 2),
  ((SELECT id FROM public.categories WHERE name = '科学'), '生物观察', 3),
  ((SELECT id FROM public.categories WHERE name = '科学'), '天文地理', 4),
  -- 技术 (category_id = 2)
  ((SELECT id FROM public.categories WHERE name = '技术'), '编程入门', 1),
  ((SELECT id FROM public.categories WHERE name = '技术'), '电子制作', 2),
  ((SELECT id FROM public.categories WHERE name = '技术'), '机器人', 3),
  ((SELECT id FROM public.categories WHERE name = '技术'), '3D打印', 4),
  -- 工程 (category_id = 3)
  ((SELECT id FROM public.categories WHERE name = '工程'), '机械结构', 1),
  ((SELECT id FROM public.categories WHERE name = '工程'), '桥梁建造', 2),
  ((SELECT id FROM public.categories WHERE name = '工程'), '简易机器', 3),
  ((SELECT id FROM public.categories WHERE name = '工程'), '模型制作', 4),
  -- 艺术 (category_id = 4)
  ((SELECT id FROM public.categories WHERE name = '艺术'), '绘画', 1),
  ((SELECT id FROM public.categories WHERE name = '艺术'), '手工', 2),
  ((SELECT id FROM public.categories WHERE name = '艺术'), '雕塑', 3),
  -- 数学 (category_id = 5)
  ((SELECT id FROM public.categories WHERE name = '数学'), '几何探索', 1),
  ((SELECT id FROM public.categories WHERE name = '数学'), '逻辑游戏', 2),
  ((SELECT id FROM public.categories WHERE name = '数学'), '数学魔术', 3),
  ((SELECT id FROM public.categories WHERE name = '数学'), '统计实验', 4),
  -- 其他 (category_id = 6)
  ((SELECT id FROM public.categories WHERE name = '其他'), '生活技能', 1),
  ((SELECT id FROM public.categories WHERE name = '其他'), '户外探索', 2);

-- ============================================
-- 完成提示
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ 分类表创建完成！';
  RAISE NOTICE '📊 已创建 categories 和 sub_categories 表';
  RAISE NOTICE '🔒 已配置 RLS 策略';
  RAISE NOTICE '📝 已插入初始分类数据';
END $$;
-- ============================================
-- 更新项目表结构
-- ============================================
-- 添加子分类关联和星级难度字段
-- ============================================

-- ============================================
-- 1. 添加子分类关联字段
-- ============================================
ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS sub_category_id INT 
  REFERENCES public.sub_categories(id) ON DELETE SET NULL;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_projects_sub_category ON public.projects(sub_category_id);

-- ============================================
-- 2. 添加星级难度字段
-- ============================================
-- 难度星级: 1-5 普通, 6 传说级
ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS difficulty_stars INT DEFAULT 3
  CHECK (difficulty_stars >= 1 AND difficulty_stars <= 6);

-- ============================================
-- 3. 迁移现有 difficulty 数据
-- ============================================
UPDATE public.projects 
SET difficulty_stars = 
  CASE 
    WHEN difficulty = 'easy' THEN 2
    WHEN difficulty = 'medium' THEN 3
    WHEN difficulty = 'hard' THEN 4
    ELSE 3
  END
WHERE difficulty IS NOT NULL AND difficulty_stars = 3;

-- ============================================
-- 4. 迁移现有 category 数据到 sub_category_id
-- ============================================
-- 尝试将旧的 category 文本匹配到新的 categories 表
-- 如果匹配到主分类，则关联到该分类下的第一个子分类
UPDATE public.projects p
SET sub_category_id = (
  SELECT sc.id 
  FROM public.sub_categories sc
  JOIN public.categories c ON sc.category_id = c.id
  WHERE c.name = p.category
  ORDER BY sc.sort_order
  LIMIT 1
)
WHERE p.category IS NOT NULL 
  AND p.sub_category_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.categories WHERE name = p.category
  );

-- ============================================
-- 完成提示
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ 项目表结构更新完成！';
  RAISE NOTICE '📊 已添加 sub_category_id 字段';
  RAISE NOTICE '⭐ 已添加 difficulty_stars 字段 (1-6)';
  RAISE NOTICE '🔄 已迁移现有数据';
END $$;
