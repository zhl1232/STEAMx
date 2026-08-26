-- =============================================================================
-- 2026-08-25 项目目录清理、桥梁项目合并与固定题面补充
-- =============================================================================
-- 这是站长确认后的硬删除：
--   * 删除 59 个重复、方向不清或实践条件过高的项目；
--   * 删除鸡蛋快递保护舱挑战（challenge id = 4）；
--   * 桥梁项目只保留 233 / 243 两个方向；
--   * 沙盘 / 模型项目只保留 120「火山分层模型」；
--   * 358 / 373 / 381 改为固定题面，不再要求学生自行设计题目。
--
-- 图片对象不在数据库迁移中删除。迁移完成后由
-- scripts/purge-triaged-project-assets.mjs --dry-run 检查，再按清单清理。
--
-- 迁移追踪保证本文件只执行一次；临时表和所有数据变更仍保持幂等，便于
-- 在事务失败后安全重试。不要在这里引用 challenge_tutor_messages：当前库没有该表。
-- =============================================================================

BEGIN;

SET LOCAL statement_timeout = '120s';
-- pg-meta executes migrations as the database owner, not through a JWT. Mark
-- this transaction as the trusted service-role path so the existing content,
-- interaction and submission triggers allow the intentional hard delete.
SET LOCAL request.jwt.claim.role = 'service_role';

-- 串行化本次目录清理，并在短事务内阻止项目/挑战内容被并发写入。
SELECT pg_advisory_xact_lock(hashtext('steamx:project-content-cleanup:2026-08-25'));
LOCK TABLE public.projects, public.challenges IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE cleanup_project_ids (
  id bigint PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO cleanup_project_ids (id) VALUES
  -- 课程已有 / 观察已有 / 方向不清 / 明显不适合当前实践条件
  (422), (423), (126), (127), (128), (129), (132), (133), (134), (308),
  (57), (59), (60), (61), (63), (64), (68), (75), (77), (78), (79),
  (101), (104), (187), (205), (297), (301), (387), (388), (390), (401),
  (421), (451),
  -- 桥梁重复项目，只保留 233 / 243
  (229), (231), (232), (235), (237), (240), (245), (246), (247),
  -- 沙盘 / 模型重复项目，只保留 120
  (106), (115), (122), (270), (278), (279), (280), (281), (283), (284),
  (285), (288), (335),
  -- 实践条件过高或范围过大的项目
  (208), (345), (349), (350);

-- 先收集所有会因项目 / Journey / 挑战删除而需要一并清理的 ID。
CREATE TEMP TABLE cleanup_exploration_ids (
  id bigint PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO cleanup_exploration_ids (id)
SELECT id
FROM public.project_explorations
WHERE project_id IN (SELECT id FROM cleanup_project_ids);

CREATE TEMP TABLE cleanup_journey_ids (
  id bigint PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO cleanup_journey_ids (id)
SELECT id
FROM public.project_journeys
WHERE source_type = 'project'
  AND project_id IN (SELECT id FROM cleanup_project_ids)
ON CONFLICT DO NOTHING;

INSERT INTO cleanup_journey_ids (id)
SELECT id
FROM public.project_journeys
WHERE source_type = 'challenge'
  AND challenge_id = 4
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE cleanup_journey_record_ids (
  id bigint PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO cleanup_journey_record_ids (id)
SELECT id
FROM public.project_journey_records
WHERE journey_id IN (SELECT id FROM cleanup_journey_ids);

CREATE TEMP TABLE cleanup_completion_ids (
  id bigint PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO cleanup_completion_ids (id)
SELECT cp.id
FROM public.completed_projects AS cp
WHERE cp.project_id IN (SELECT id FROM cleanup_project_ids)
   OR cp.exploration_id IN (SELECT id FROM cleanup_exploration_ids)
   OR cp.journey_record_id IN (SELECT id FROM cleanup_journey_record_ids);

CREATE TEMP TABLE cleanup_comment_ids (
  id bigint PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO cleanup_comment_ids (id)
SELECT c.id
FROM public.comments AS c
WHERE c.project_id IN (SELECT id FROM cleanup_project_ids);

CREATE TEMP TABLE cleanup_completion_comment_ids (
  id bigint PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO cleanup_completion_comment_ids (id)
SELECT cc.id
FROM public.completion_comments AS cc
WHERE cc.completed_project_id IN (SELECT id FROM cleanup_completion_ids);

CREATE TEMP TABLE cleanup_submission_ids (
  id bigint PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO cleanup_submission_ids (id)
SELECT id
FROM public.challenge_submissions
WHERE challenge_id = 4
   OR journey_record_id IN (SELECT id FROM cleanup_journey_record_ids);

--------------------------------------------------------------------------------
-- 清理无外键的异步任务、通知、举报、审核和分级历史，避免留下死链。
--------------------------------------------------------------------------------

DELETE FROM public.auto_interaction_jobs
WHERE (target_type = 'project'
       AND target_id IN (SELECT id FROM cleanup_project_ids))
   OR (target_type = 'completion'
       AND target_id IN (SELECT id FROM cleanup_completion_ids));

DELETE FROM public.reports
WHERE (content_type = 'project'
       AND content_id IN (SELECT id FROM cleanup_project_ids))
   OR (content_type = 'comment'
       AND content_id IN (SELECT id FROM cleanup_comment_ids))
   OR (content_type = 'completion_comment'
       AND content_id IN (SELECT id FROM cleanup_completion_comment_ids))
   OR (content_type = 'challenge' AND content_id = 4)
   OR (content_type = 'challenge_submission'
       AND content_id IN (SELECT id FROM cleanup_submission_ids));

DELETE FROM public.moderation_cases
WHERE (content_type = 'project'
       AND content_id IN (SELECT id FROM cleanup_project_ids))
   OR (content_type = 'comment'
       AND content_id IN (SELECT id FROM cleanup_comment_ids))
   OR (content_type = 'completion_comment'
       AND content_id IN (SELECT id FROM cleanup_completion_comment_ids))
   OR (content_type = 'challenge' AND content_id = 4)
   OR (content_type = 'challenge_submission'
       AND content_id IN (SELECT id FROM cleanup_submission_ids));

DELETE FROM public.notifications
WHERE project_id IN (SELECT id FROM cleanup_project_ids)
   OR (related_type = 'project'
       AND related_id IN (SELECT id FROM cleanup_project_ids))
   OR (related_type = 'challenge' AND related_id = 4)
   OR (related_type = 'challenge_submission'
       AND related_id IN (SELECT id FROM cleanup_submission_ids));

DELETE FROM public.coin_logs AS cl
WHERE cl.resource_id IN (
    SELECT 'project:' || id::text FROM cleanup_project_ids
    UNION ALL
    SELECT 'completion:' || id::text FROM cleanup_completion_ids
    UNION ALL
    SELECT 'challenge:4'
  )
   OR cl.resource_id IN (
    SELECT 'challenge_submission:' || id::text
    FROM cleanup_submission_ids
  );

--------------------------------------------------------------------------------
-- 先删作品、评论及其子行；Journey 记录和旧兼容投影随后再删。
--------------------------------------------------------------------------------

DELETE FROM public.completion_likes
WHERE completed_project_id IN (SELECT id FROM cleanup_completion_ids);

DELETE FROM public.completion_comments
WHERE completed_project_id IN (SELECT id FROM cleanup_completion_ids)
  AND parent_id IS NOT NULL;

DELETE FROM public.completion_comments
WHERE completed_project_id IN (SELECT id FROM cleanup_completion_ids);

DELETE FROM public.completion_moderation_logs
WHERE completion_id IN (SELECT id FROM cleanup_completion_ids);

DELETE FROM public.completed_projects
WHERE id IN (SELECT id FROM cleanup_completion_ids);

DELETE FROM public.comment_likes
WHERE comment_id IN (SELECT id FROM cleanup_comment_ids);

DELETE FROM public.comments
WHERE id IN (SELECT id FROM cleanup_comment_ids)
  AND parent_id IS NOT NULL;

DELETE FROM public.comments
WHERE id IN (SELECT id FROM cleanup_comment_ids);

--------------------------------------------------------------------------------
-- 删除项目 / 挑战的 Journey 内容。子表的 journey_record_id 是 SET NULL，
-- 这里先显式删掉属于待删除来源的兼容产物，再删 Journey 本身。
--------------------------------------------------------------------------------

DELETE FROM public.challenge_stage_progress
WHERE journey_id IN (SELECT id FROM cleanup_journey_ids)
   OR journey_record_id IN (SELECT id FROM cleanup_journey_record_ids);

DELETE FROM public.challenge_workspaces
WHERE journey_id IN (SELECT id FROM cleanup_journey_ids);

DELETE FROM public.challenge_submission_projects
WHERE submission_id IN (SELECT id FROM cleanup_submission_ids);

DELETE FROM public.challenge_submission_ratings
WHERE submission_id IN (SELECT id FROM cleanup_submission_ids);

DELETE FROM public.challenge_submissions
WHERE id IN (SELECT id FROM cleanup_submission_ids);

DELETE FROM public.project_explorations
WHERE id IN (SELECT id FROM cleanup_exploration_ids)
   OR project_id IN (SELECT id FROM cleanup_project_ids);

DELETE FROM public.project_journey_records
WHERE id IN (SELECT id FROM cleanup_journey_record_ids);

DELETE FROM public.project_journeys
WHERE id IN (SELECT id FROM cleanup_journey_ids);

--------------------------------------------------------------------------------
-- 删除项目直接关联表。挑战完成记录保留，但断开已删除项目的可选关联。
--------------------------------------------------------------------------------

UPDATE public.challenge_completions
SET project_id = NULL
WHERE project_id IN (SELECT id FROM cleanup_project_ids);

DELETE FROM public.challenge_submission_projects
WHERE project_id IN (SELECT id FROM cleanup_project_ids);

DELETE FROM public.challenge_ratings
WHERE project_id IN (SELECT id FROM cleanup_project_ids);

DELETE FROM public.project_tags
WHERE project_id IN (SELECT id FROM cleanup_project_ids);

DELETE FROM public.likes
WHERE project_id IN (SELECT id FROM cleanup_project_ids);

DELETE FROM public.collections
WHERE project_id IN (SELECT id FROM cleanup_project_ids);

DELETE FROM public.legacy_course_work_projects
WHERE project_id IN (SELECT id FROM cleanup_project_ids);

DELETE FROM public.project_steps
WHERE project_id IN (SELECT id FROM cleanup_project_ids);

DELETE FROM public.project_materials
WHERE project_id IN (SELECT id FROM cleanup_project_ids);

--------------------------------------------------------------------------------
-- 所有挑战资源中的项目深链先清掉，再删除挑战 4。
--------------------------------------------------------------------------------

UPDATE public.challenges AS c
SET resources = COALESCE((
  SELECT jsonb_agg(item.elem ORDER BY item.ord)
  FROM jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(c.resources) = 'array' THEN c.resources
      ELSE '[]'::jsonb
    END
  ) WITH ORDINALITY AS item(elem, ord)
  WHERE NOT (
    COALESCE(item.elem ->> 'type', '') = 'project'
    AND CASE
      WHEN COALESCE(item.elem ->> 'url', '') ~ '/project/[0-9]+'
      THEN substring(item.elem ->> 'url' FROM '/project/([0-9]+)')::bigint
      ELSE NULL
    END IN (SELECT id FROM cleanup_project_ids)
)), '[]'::jsonb)
WHERE jsonb_typeof(c.resources) = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(c.resources) AS item(elem)
    WHERE COALESCE(item.elem ->> 'type', '') = 'project'
      AND CASE
        WHEN COALESCE(item.elem ->> 'url', '') ~ '/project/[0-9]+'
        THEN substring(item.elem ->> 'url' FROM '/project/([0-9]+)')::bigint
        ELSE NULL
      END IN (SELECT id FROM cleanup_project_ids)
  );

-- challenge_tutor_messages 不在当前数据库中；其余挑战子表都显式清理。
DELETE FROM public.challenge_participants
WHERE challenge_id = 4;

DELETE FROM public.challenge_completions
WHERE challenge_id = 4;

DELETE FROM public.challenge_stage_progress
WHERE challenge_id = 4;

DELETE FROM public.challenge_workspaces
WHERE challenge_id = 4;

DELETE FROM public.challenges
WHERE id = 4;

--------------------------------------------------------------------------------
-- 最后删除项目本身。内容分级历史是无外键审计表，必须单独清理。
--------------------------------------------------------------------------------

DELETE FROM public.projects
WHERE id IN (SELECT id FROM cleanup_project_ids);

DELETE FROM public.content_classification_reviews
WHERE (content_type = 'project'
       AND content_id IN (SELECT id FROM cleanup_project_ids))
   OR (content_type = 'challenge' AND content_id = 4);

--------------------------------------------------------------------------------
-- 保留的桥梁项目：233 做基础结构与材料对比，243 做限定材料优化挑战。
--------------------------------------------------------------------------------

UPDATE public.projects
SET description = CASE id
  WHEN 233 THEN $project_233$
    用纸张、吸管和纸杯等常见材料，完成桥面结构的基础承重对比实验。先比较平铺、折叠、波浪折、U形槽和卷筒等结构，再观察吸管梁与纸杯支撑怎样改变承重；统一跨度、材料数量和加载方法，记录数据并解释力的传递。
  $project_233$
  WHEN 243 THEN $project_243$
    在限定材料和跨度条件下，设计一座承重效率尽可能高的桥。你可以比较三角桁架、互锁自支撑和大跨度结构，记录桥的自重、最大承重、跨度和下挠量，再通过一次只改一个变量的迭代，找到材料用量与承重能力之间的平衡。
  $project_243$
  ELSE description
END
WHERE id IN (233, 243);

-- 233 的材料清单明确覆盖基础桥梁项目中常见的纸张、吸管和纸杯结构。
DELETE FROM public.project_materials
WHERE project_id = 233;

INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
  (233, 'A4纸 10张', 1),
  (233, '吸管 10根', 2),
  (233, '纸胶带 1卷', 3),
  (233, '一次性纸杯 2个', 4),
  (233, '两摞等高书本', 5),
  (233, '硬币或玻璃弹珠若干', 6),
  (233, '记录本和笔', 7),
  (233, '直尺', 8);

UPDATE public.project_steps
SET description = CASE sort_order
  WHEN 1 THEN $step_233_1$
    第一轮只用 A4 纸制作 4 座桥：平铺、波浪折、U 形槽、卷筒形。每座桥都跨过 15 厘米的空隙，并尽量保持纸张用量相同。
  $step_233_1$
  WHEN 2 THEN $step_233_2$
    第二轮用 10 根吸管和纸胶带制作一座直梁桥与一座三角支撑桥；再用两个纸杯作为桥墩，比较纸杯支撑位置靠近桥端或靠近中部时的差异。不要同时改变跨度。
  $step_233_2$
  WHEN 3 THEN $step_233_3$
    把两摞书的间距固定为 15 厘米，在桥中央放置一个纸杯作为承重容器。每次只增加一枚硬币或一颗弹珠，直到桥面明显塌陷；每种结构至少测试两次。
  $step_233_3$
  WHEN 4 THEN $step_233_4$
    记录每座桥的结构、材料数量、第一次塌陷时的载荷和两次测试平均值，制作一张柱状图，同时标出纸桥与吸管桥的结果。
  $step_233_4$
  WHEN 5 THEN $step_233_5$
    解释哪种结构承重更强，以及折痕、管状截面、三角支撑和桥墩位置如何改变力的传递路径。最后写出一个你会继续测试的变量。
  $step_233_5$
  ELSE description
END
WHERE project_id = 233;

UPDATE public.project_steps
SET description = CASE sort_order
  WHEN 1 THEN $step_243_1$
    固定规则：桥的有效跨度不小于 25 厘米，最多使用 50 根冰棍棒；每一版都记录桥重、最大承重、跨度和承重效率（最大承重 ÷ 桥重）。第一轮分别选择三角桁架、互锁自支撑或大跨度梁中的一种作为方案方向。
  $step_243_1$
  WHEN 2 THEN $step_243_2$
    画出两种草图：一种用三角桁架传力，另一种用互锁或分层结构减少胶水和材料。标出受力点、支撑点、预计最容易变形的位置，并写出每种方案计划使用的木棒数量。
  $step_243_2$
  WHEN 3 THEN $step_243_3$
    选择一个方案制作第一版。桥面必须保持至少 25 厘米跨度，节点连接要尽量整齐；如果采用自锁方案，测试时不使用白胶，并在记录中注明。
  $step_243_3$
  WHEN 4 THEN $step_243_4$
    先称桥的自重，再逐步增加重物，记录最大承重、桥中央下挠量和失效位置。用同一套加载方法完成测试，计算承重效率。
  $step_243_4$
  WHEN 5 THEN $step_243_5$
    只改变一个变量再制作第二版，例如增加一组三角撑、改变节点位置或减少一层材料。把两版的桥重、承重和效率放在同一张表中比较。
  $step_243_5$
  WHEN 6 THEN $step_243_6$
    根据数据判断哪一种结构最适合当前跨度和材料限制，说明大跨度、桁架、自锁、极限测试和材料效率之间的关系。
  $step_243_6$
  ELSE description
END
WHERE project_id = 243;

--------------------------------------------------------------------------------
-- 358 / 373 / 381：固定题面。题目直接写在项目步骤中，学生不需要先设计
-- 轮廓或自行命题，项目才有可重复完成和可检查的结果。
--------------------------------------------------------------------------------

UPDATE public.projects
SET description = CASE id
  WHEN 358 THEN $project_358$
    按项目给出的固定坐标题面完成三道练习：坐标描点、小火箭坐标画图、平移与轴对称变换。题面包含坐标范围、点的顺序和变换规则，不要求另行设计图案。
  $project_358$
  WHEN 373 THEN $project_373$
    按项目给出的固定数字连线题完成小鱼和小火箭图案，再做一次镜像加题。每道题都给出点的编号与坐标，学生只需按顺序连线、核对图案和涂色，不需要自己先画轮廓。
  $project_373$
  WHEN 381 THEN $project_381$
    完成三阶完整幻方、三阶缺数幻方和四阶缺数幻方三道固定题。题面明确规定数字范围与幻和：三阶使用 1—9、幻和 15；四阶使用 1—16、幻和 34。
  $project_381$
  ELSE description
END
WHERE id IN (358, 373, 381);

UPDATE public.project_steps
SET
  title = CASE sort_order
    WHEN 1 THEN '固定题一：建立坐标系'
    WHEN 2 THEN '固定题二：练习描点'
    WHEN 3 THEN '固定题三：画小火箭'
    WHEN 4 THEN '固定题四：平移与翻折'
    WHEN 5 THEN '核对固定题答案'
    ELSE title
  END,
  description = CASE sort_order
    WHEN 1 THEN $step_358_1$
      在方格纸上画出横轴 x 和纵轴 y，原点为 O，两个轴的刻度范围都标到 -10 至 10。本项目后面的题目统一使用这个坐标范围。
    $step_358_1$
    WHEN 2 THEN $step_358_2$
      固定描点题：在坐标系中标出 A(3,5)、B(-2,4)、C(-5,-1)、D(4,-3)、E(6,2)，并从 A→B→C→D→E 依次连线，再从 E 连回 A。
    $step_358_2$
    WHEN 3 THEN $step_358_3$
      固定题面「小火箭」：依次连线 ①(-2,-6)→②(-2,1)→③(0,5)→④(2,1)→⑤(2,-6)→⑥(-2,-6)；抬笔后连左翼 ⑦(-2,-3)→⑧(-5,-5)→⑨(-2,-5)→⑦，再抬笔连右翼 ⑩(2,-3)→⑪(5,-5)→⑫(2,-5)→⑩，最后连火焰 ⑬(-1,-6)→⑭(0,-8)→⑮(1,-6)→⑬。
    $step_358_3$
    WHEN 4 THEN $step_358_4$
      固定变换题：把小火箭外框的每个点向右平移 4 格，使用 (x,y)→(x+4,y)；再把原图关于 x 轴翻折，使用 (x,y)→(x,-y)。比较两次图案的位置和朝向，不添加自选图形。
    $step_358_4$
    WHEN 5 THEN $step_358_5$
      核对标准：点的坐标读写正确、每组连线顺序正确、平移后所有 x 坐标增加 4、关于 x 轴翻折后所有 y 坐标变号。用不同颜色标出原图、平移图和翻折图。
    $step_358_5$
    ELSE description
  END
WHERE project_id = 358;

UPDATE public.project_steps
SET
  title = CASE sort_order
    WHEN 1 THEN '固定题一：小鱼点阵'
    WHEN 2 THEN '固定题二：小火箭点阵'
    WHEN 3 THEN '按编号连线'
    WHEN 4 THEN '涂色并核对'
    WHEN 5 THEN '固定加题：镜像连线'
    ELSE title
  END,
  description = CASE sort_order
    WHEN 1 THEN $step_373_1$
      固定题面「小鱼」共 19 个点。按坐标标点后，连续连线：1(-5,4)→2(-1,8)→3(-2,4)→4(-1,0)→5(-5,4)→6(-1,4)→7(2,7)→8(7,8)→9(11,6)→10(13,4)→11(11,2)→12(7,0)→13(2,1)→14(-1,4)；抬笔后连眼睛 15(8,6)→16(9,6)→17(9,5)→18(8,5)→15。不要自行修改点的位置。
    $step_373_1$
    WHEN 2 THEN $step_373_2$
      固定题面「小火箭」共 18 个点。分别连外框 1(-2,-6)→2(-2,1)→3(0,5)→4(2,1)→5(2,-6)→6(-2,-6)，左翼 7(-2,-3)→8(-5,-5)→9(-2,-5)→7，右翼 10(2,-3)→11(5,-5)→12(2,-5)→10，火焰 13(-1,-6)→14(0,-8)→15(1,-6)→13。每组开始前抬笔。
    $step_373_2$
    WHEN 3 THEN $step_373_3$
      选择上面的固定题一或固定题二，把题面交给同伴；同伴只能按数字从小到大连线，不能先看原图，也不能自行补点。完成后对照标准点序检查是否还原出小鱼或小火箭。
    $step_373_3$
    WHEN 4 THEN $step_373_4$
      只给已经完成的固定图案涂色：小鱼的身体用蓝色、鱼鳍用绿色；小火箭外框用红色、火焰用橙色。检查所有编号和连线后，再写下题目名称与使用的点数。
    $step_373_4$
    WHEN 5 THEN $step_373_5$
      固定加题「镜像小火箭」：把小火箭题中每个点的 x 坐标改为 -x，y 坐标保持不变，再按同样的分组和顺序连线。比较原图与镜像图的左右方向；不要自行设计新的轮廓。
    $step_373_5$
    ELSE description
  END
WHERE project_id = 373;

UPDATE public.project_steps
SET
  title = CASE sort_order
    WHEN 1 THEN '固定题面与规则'
    WHEN 2 THEN '固定题一：计算三阶幻和'
    WHEN 3 THEN '固定题二：三阶缺数题'
    WHEN 4 THEN '固定题三：三阶完整题'
    WHEN 5 THEN '固定题四：四阶缺数题'
    ELSE title
  END,
  description = CASE sort_order
    WHEN 1 THEN $step_381_1$
      幻方要求每行、每列和两条对角线的和都相等，并且每个数字只使用一次。本项目固定使用连续数字：三阶用 1—9，四阶用 1—16；不使用自选数字，也不自行设计阶数。
    $step_381_1$
    WHEN 2 THEN $step_381_2$
      固定规则：三阶数字总和为 1+2+…+9=45，幻和为 45÷3=15；四阶数字总和为 1+2+…+16=136，幻和为 136÷4=34。先把 15 和 34 写在题目旁边，作为检查标准。
    $step_381_2$
    WHEN 3 THEN $step_381_3$
      固定三阶缺数题（使用 1—9，每个数字一次，幻和 15）：\n8 | □ | 6\n□ | 5 | 7\n4 | □ | 2\n请填入 1、3、9，并检查每行、每列和两条对角线都等于 15。
    $step_381_3$
    WHEN 4 THEN $step_381_4$
      固定三阶完整题（使用 1—9，每个数字一次，幻和 15）：\n□ | 1 | 6\n3 | □ | 7\n4 | 9 | □\n请填入 8、5、2，并检查八条线都等于 15；再用数字卡片复现这一题。
    $step_381_4$
    WHEN 5 THEN $step_381_5$
      固定四阶缺数题（使用 1—16，每个数字一次，幻和 34）：\n16 | □ | 2 | 13\n5 | 10 | □ | 8\n□ | 6 | 7 | 12\n4 | □ | 14 | 1\n请填入 3、11、9、15，并检查每行、每列和两条对角线都等于 34。
    $step_381_5$
    ELSE description
  END
WHERE project_id = 381;

-- 删除目标及保留项目的内容都有较大变化，刷新主要目录表统计信息。
ANALYZE public.projects;
ANALYZE public.project_steps;
ANALYZE public.project_materials;
ANALYZE public.project_journeys;
ANALYZE public.project_journey_records;
ANALYZE public.challenges;

COMMIT;
