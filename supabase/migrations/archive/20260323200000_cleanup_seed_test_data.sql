-- ============================================
-- 清理种子测试数据 (Cleanup Seed Test Data)
-- ============================================
-- 删除示例项目及所有假互动数据（评论、讨论、私信、点赞等）。
-- 保留：所有用户（含测试用户）、徽章定义、分类。
-- ============================================

BEGIN;

DO $$
DECLARE
  v_seed_users UUID[] := ARRAY[
    '66020423-0000-0000-0000-000000000000',  -- Admin
    '11111111-0000-0000-0000-000000000000',  -- Student
    '22222222-0000-0000-0000-000000000000',  -- Teacher
    'a1111111-0000-0000-0000-000000000000',  -- Alice
    'b2222222-0000-0000-0000-000000000000',  -- Bob
    'c3333333-0000-0000-0000-000000000000',  -- Charlie
    'd4444444-0000-0000-0000-000000000000',  -- David
    'e5555555-0000-0000-0000-000000000000'   -- Eve
  ];
  v_admin_id UUID := '66020423-0000-0000-0000-000000000000';
  v_proj_id BIGINT;
BEGIN

  -- ========================================
  -- 1. 删除种子用户产生的假互动数据
  -- ========================================

  -- 私信
  DELETE FROM public.messages
  WHERE sender_id = ANY(v_seed_users) OR receiver_id = ANY(v_seed_users);

  -- 讨论回复
  DELETE FROM public.discussion_replies WHERE author_id = ANY(v_seed_users);

  -- 讨论主题
  DELETE FROM public.discussions WHERE author_id = ANY(v_seed_users);

  -- 评论
  DELETE FROM public.comments WHERE author_id = ANY(v_seed_users);

  -- 点赞
  DELETE FROM public.likes WHERE user_id = ANY(v_seed_users);

  -- 收藏
  DELETE FROM public.collections WHERE user_id = ANY(v_seed_users);

  -- 完成作品点赞
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='completion_likes') THEN
    DELETE FROM public.completion_likes WHERE user_id = ANY(v_seed_users);
  END IF;

  -- 完成作品评论
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='completion_comments') THEN
    DELETE FROM public.completion_comments WHERE author_id = ANY(v_seed_users);
  END IF;

  -- 完成记录
  DELETE FROM public.completed_projects WHERE user_id = ANY(v_seed_users);

  -- ========================================
  -- 2. 删除 Admin 发布的 5 个示例项目及其关联数据
  -- ========================================

  FOR v_proj_id IN
    SELECT id FROM public.projects
    WHERE author_id = v_admin_id
      AND title IN ('磁铁钓鱼游戏', '制作不倒翁', '感官盲盒挑战', '金鱼观察日记', '手工杯垫制作')
  LOOP
    DELETE FROM public.completed_projects WHERE project_id = v_proj_id;
    DELETE FROM public.comments WHERE project_id = v_proj_id;
    DELETE FROM public.likes WHERE project_id = v_proj_id;
    DELETE FROM public.collections WHERE project_id = v_proj_id;
    DELETE FROM public.project_steps WHERE project_id = v_proj_id;
    DELETE FROM public.project_materials WHERE project_id = v_proj_id;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='project_tags') THEN
      DELETE FROM public.project_tags WHERE project_id = v_proj_id;
    END IF;
    DELETE FROM public.projects WHERE id = v_proj_id;
  END LOOP;

  RAISE NOTICE '✅ 已清理 5 个示例项目及所有假互动数据。用户账号已保留。';

END $$;

COMMIT;
