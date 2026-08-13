-- =============================================================================
-- 2026-08-13 站长内容分诊：硬删除一批 STEAMx 目录项目
-- =============================================================================
-- 日期：2026-08-13
-- 提出人：站长 zhl1232（审过线上目录后决定）
-- 原因：面向孩子+家长；直播课以后再做。这些目录条目不适合当前产品定位。
--       这是硬删除，不是下架 / 归档 / 改 status。关联行随项目一起删掉。
--       OSS 图片对象另由 scripts/purge-triaged-project-assets.mjs 清理
--       （默认 --dry-run；加 --execute 才真正删除）。
--
-- 权威 ID 列表：scripts/lib/content-triage-2026-08-13.mjs
-- 不要删除任何其他项目。保留（合并胜出 / 仍待处理、仍然上线）：
-- 52, 73, 119, 120, 177, 352，以及删除名单以外的所有已审核项目。
-- 不要重新 seed 下列 ID。
--
-- 要删除的 ID（105 个）：
-- 30, 34, 35, 37, 49, 80, 100, 103, 123, 130, 131, 135, 136, 137, 138, 139,
-- 140, 141, 142, 143, 144, 145, 146, 147, 148, 161, 162, 163, 164, 165, 167,
-- 168, 181, 182, 185, 186, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197,
-- 198, 199, 200, 201, 202, 203, 204, 206, 207, 221, 230, 234, 236, 238, 239,
-- 241, 242, 244, 248, 252, 265, 275, 282, 287, 304, 305, 306, 324, 325, 327,
-- 329, 330, 344, 347, 367, 368, 370, 371, 372, 377, 382, 384, 391, 393, 394,
-- 396, 397, 398, 399, 403, 404, 405, 406, 408, 409, 410, 424, 457, 461
--
-- 幂等：行已经不存在时删除是空操作。不删表。
-- 先删子表/关联行，外键顺序写清楚；即便有 ON DELETE CASCADE 也显式删除。
-- =============================================================================

CREATE TEMP TABLE triaged_project_ids (
  id bigint PRIMARY KEY
);

INSERT INTO triaged_project_ids (id) VALUES
  (30), (34), (35), (37), (49), (80), (100), (103), (123), (130),
  (131), (135), (136), (137), (138), (139), (140), (141), (142), (143),
  (144), (145), (146), (147), (148), (161), (162), (163), (164), (165),
  (167), (168), (181), (182), (185), (186), (188), (189), (190), (191),
  (192), (193), (194), (195), (196), (197), (198), (199), (200), (201),
  (202), (203), (204), (206), (207), (221), (230), (234), (236), (238),
  (239), (241), (242), (244), (248), (252), (265), (275), (282), (287),
  (304), (305), (306), (324), (325), (327), (329), (330), (344), (347),
  (367), (368), (370), (371), (372), (377), (382), (384), (391), (393),
  (394), (396), (397), (398), (399), (403), (404), (405), (406), (408),
  (409), (410), (424), (457), (461);

-- 这些项目下的完成作品（先取出 ID，再删子行）
CREATE TEMP TABLE triaged_completion_ids AS
SELECT cp.id
FROM public.completed_projects cp
WHERE cp.project_id IN (SELECT id FROM triaged_project_ids);

-- 历史项目评论（因 parent_id 自引用，先删回复）
CREATE TEMP TABLE triaged_comment_ids AS
SELECT c.id
FROM public.comments c
WHERE c.project_id IN (SELECT id FROM triaged_project_ids);

CREATE TEMP TABLE triaged_completion_comment_ids AS
SELECT cc.id
FROM public.completion_comments cc
WHERE cc.completed_project_id IN (SELECT id FROM triaged_completion_ids);

--------------------------------------------------------------------------------
-- 自动互动队列（项目及其完成作品）
--------------------------------------------------------------------------------
DELETE FROM public.auto_interaction_jobs
WHERE (target_type = 'project' AND target_id IN (SELECT id FROM triaged_project_ids))
   OR (target_type = 'completion' AND target_id IN (SELECT id FROM triaged_completion_ids));

--------------------------------------------------------------------------------
-- 举报与审核案件（项目、项目评论、作品评论）
--------------------------------------------------------------------------------
DELETE FROM public.reports
WHERE (content_type = 'project' AND content_id IN (SELECT id FROM triaged_project_ids))
   OR (content_type = 'comment' AND content_id IN (SELECT id FROM triaged_comment_ids))
   OR (content_type = 'completion_comment' AND content_id IN (SELECT id FROM triaged_completion_comment_ids));

DELETE FROM public.moderation_cases
WHERE (content_type = 'project' AND content_id IN (SELECT id FROM triaged_project_ids))
   OR (content_type = 'comment' AND content_id IN (SELECT id FROM triaged_comment_ids))
   OR (content_type = 'completion_comment' AND content_id IN (SELECT id FROM triaged_completion_comment_ids));

--------------------------------------------------------------------------------
-- 指向这些项目的通知（无外键，不删会留下死链）
--------------------------------------------------------------------------------
DELETE FROM public.notifications
WHERE project_id IN (SELECT id FROM triaged_project_ids)
   OR (related_type = 'project' AND related_id IN (SELECT id FROM triaged_project_ids));

--------------------------------------------------------------------------------
-- 这些项目及其完成作品的金币 / 投币流水
--------------------------------------------------------------------------------
DELETE FROM public.coin_logs
WHERE resource_id IN (
  SELECT 'project:' || id::text FROM triaged_project_ids
  UNION ALL
  SELECT 'completion:' || id::text FROM triaged_completion_ids
);

--------------------------------------------------------------------------------
-- 先删完成作品的子行，再删完成作品，再删探索会话
--------------------------------------------------------------------------------
DELETE FROM public.completion_likes
WHERE completed_project_id IN (SELECT id FROM triaged_completion_ids);

DELETE FROM public.completion_comments
WHERE completed_project_id IN (SELECT id FROM triaged_completion_ids)
  AND parent_id IS NOT NULL;

DELETE FROM public.completion_comments
WHERE completed_project_id IN (SELECT id FROM triaged_completion_ids);

DELETE FROM public.completion_moderation_logs
WHERE completion_id IN (SELECT id FROM triaged_completion_ids);

DELETE FROM public.completed_projects
WHERE id IN (SELECT id FROM triaged_completion_ids)
   OR project_id IN (SELECT id FROM triaged_project_ids);

DELETE FROM public.project_explorations
WHERE project_id IN (SELECT id FROM triaged_project_ids);

--------------------------------------------------------------------------------
-- 项目评论（先赞，再回复，再根评论）
--------------------------------------------------------------------------------
DELETE FROM public.comment_likes
WHERE comment_id IN (SELECT id FROM triaged_comment_ids);

DELETE FROM public.comments
WHERE id IN (SELECT id FROM triaged_comment_ids)
  AND parent_id IS NOT NULL;

DELETE FROM public.comments
WHERE id IN (SELECT id FROM triaged_comment_ids)
   OR project_id IN (SELECT id FROM triaged_project_ids);

--------------------------------------------------------------------------------
-- 直接挂在项目上的子表
--------------------------------------------------------------------------------
DELETE FROM public.likes
WHERE project_id IN (SELECT id FROM triaged_project_ids);

DELETE FROM public.collections
WHERE project_id IN (SELECT id FROM triaged_project_ids);

DELETE FROM public.project_steps
WHERE project_id IN (SELECT id FROM triaged_project_ids);

DELETE FROM public.project_materials
WHERE project_id IN (SELECT id FROM triaged_project_ids);

-- project_species 已在 20260331120000 删除，生产库没有此表，这里不再 DELETE。

DELETE FROM public.challenge_ratings
WHERE project_id IN (SELECT id FROM triaged_project_ids);

DELETE FROM public.challenge_submission_projects
WHERE project_id IN (SELECT id FROM triaged_project_ids);

DELETE FROM public.legacy_course_work_projects
WHERE project_id IN (SELECT id FROM triaged_project_ids);

--------------------------------------------------------------------------------
-- 可空外键：保留观察记录 / 挑战完成行，只断开项目关联
-- observation_events.project_id 已在 20260331120000 删除，这里不再 UPDATE。
--------------------------------------------------------------------------------
UPDATE public.challenge_completions
SET project_id = NULL
WHERE project_id IN (SELECT id FROM triaged_project_ids);

--------------------------------------------------------------------------------
-- 挑战 resources JSON 里指向已删项目的深链
--------------------------------------------------------------------------------
UPDATE public.challenges
SET resources = COALESCE((
  SELECT jsonb_agg(elem)
  FROM jsonb_array_elements(COALESCE(challenges.resources, '[]'::jsonb)) AS elem
  WHERE NOT (
    COALESCE(elem->>'type', '') = 'project'
    AND substring(elem->>'url' FROM '/project/([0-9]+)') IS NOT NULL
    AND substring(elem->>'url' FROM '/project/([0-9]+)')::bigint IN (SELECT id FROM triaged_project_ids)
  )
), '[]'::jsonb)
WHERE resources IS NOT NULL
  AND jsonb_typeof(resources) = 'array'
  AND resources::text ~ '/project/[0-9]+';

--------------------------------------------------------------------------------
-- 最后删除项目本身
--------------------------------------------------------------------------------
DELETE FROM public.projects
WHERE id IN (SELECT id FROM triaged_project_ids);
