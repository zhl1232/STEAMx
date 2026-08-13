-- =============================================================================
-- 2026-08-13 owner content triage: HARD DELETE curated STEAMx projects
-- =============================================================================
-- Date: 2026-08-13
-- Requested by: owner zhl1232 after live-catalog review
-- Reason: kids+parents audience; live class later. These catalog entries are
--         not a fit for the current product. This is a HARD DELETE, not an
--         unpublish / archive / status flip. Related rows go with the projects.
--         OSS/image objects are purged separately by
--         scripts/purge-triaged-project-assets.mjs (dry-run by default).
--
-- Canonical ID list: scripts/lib/content-triage-2026-08-13.mjs
-- Do NOT delete any other project. KEEP (merge winners / still-pending, still
-- live): 52, 73, 119, 120, 177, 352, and all other approved projects not in
-- the delete list. Do not re-seed the IDs below.
--
-- IDs to DELETE (105):
-- 30, 34, 35, 37, 49, 80, 100, 103, 123, 130, 131, 135, 136, 137, 138, 139,
-- 140, 141, 142, 143, 144, 145, 146, 147, 148, 161, 162, 163, 164, 165, 167,
-- 168, 181, 182, 185, 186, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197,
-- 198, 199, 200, 201, 202, 203, 204, 206, 207, 221, 230, 234, 236, 238, 239,
-- 241, 242, 244, 248, 252, 265, 275, 282, 287, 304, 305, 306, 324, 325, 327,
-- 329, 330, 344, 347, 367, 368, 370, 371, 372, 377, 382, 384, 391, 393, 394,
-- 396, 397, 398, 399, 403, 404, 405, 406, 408, 409, 410, 424, 457, 461
--
-- Idempotent: deleting already-missing rows is a no-op. Tables are not dropped.
-- Child/related rows are removed first so FK order is explicit even where
-- ON DELETE CASCADE would also work.
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

-- Completions / works attached to these projects (needed before child deletes)
CREATE TEMP TABLE triaged_completion_ids AS
SELECT cp.id
FROM public.completed_projects cp
WHERE cp.project_id IN (SELECT id FROM triaged_project_ids);

-- Historical project comments (replies first because of parent_id)
CREATE TEMP TABLE triaged_comment_ids AS
SELECT c.id
FROM public.comments c
WHERE c.project_id IN (SELECT id FROM triaged_project_ids);

CREATE TEMP TABLE triaged_completion_comment_ids AS
SELECT cc.id
FROM public.completion_comments cc
WHERE cc.completed_project_id IN (SELECT id FROM triaged_completion_ids);

--------------------------------------------------------------------------------
-- Auto-interaction queue (projects + their completions)
--------------------------------------------------------------------------------
DELETE FROM public.auto_interaction_jobs
WHERE (target_type = 'project' AND target_id IN (SELECT id FROM triaged_project_ids))
   OR (target_type = 'completion' AND target_id IN (SELECT id FROM triaged_completion_ids));

--------------------------------------------------------------------------------
-- Reports + moderation cases for projects, project comments, completion comments
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
-- Notifications pointing at these projects (no FK, but dangling otherwise)
--------------------------------------------------------------------------------
DELETE FROM public.notifications
WHERE project_id IN (SELECT id FROM triaged_project_ids)
   OR (related_type = 'project' AND related_id IN (SELECT id FROM triaged_project_ids));

--------------------------------------------------------------------------------
-- Coin / tip rows for the projects and their completions
--------------------------------------------------------------------------------
DELETE FROM public.coin_logs
WHERE resource_id IN (
  SELECT 'project:' || id::text FROM triaged_project_ids
  UNION ALL
  SELECT 'completion:' || id::text FROM triaged_completion_ids
);

--------------------------------------------------------------------------------
-- Completion children, then completions, then explorations
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
-- Project comments (likes, then replies, then roots)
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
-- Direct project children
--------------------------------------------------------------------------------
DELETE FROM public.likes
WHERE project_id IN (SELECT id FROM triaged_project_ids);

DELETE FROM public.collections
WHERE project_id IN (SELECT id FROM triaged_project_ids);

DELETE FROM public.project_steps
WHERE project_id IN (SELECT id FROM triaged_project_ids);

DELETE FROM public.project_materials
WHERE project_id IN (SELECT id FROM triaged_project_ids);

DELETE FROM public.project_species
WHERE project_id IN (SELECT id FROM triaged_project_ids);

DELETE FROM public.challenge_ratings
WHERE project_id IN (SELECT id FROM triaged_project_ids);

DELETE FROM public.challenge_submission_projects
WHERE project_id IN (SELECT id FROM triaged_project_ids);

DELETE FROM public.legacy_course_work_projects
WHERE project_id IN (SELECT id FROM triaged_project_ids);

--------------------------------------------------------------------------------
-- Nullable FKs: keep the observation / challenge-completion rows, drop the link
--------------------------------------------------------------------------------
UPDATE public.observation_events
SET project_id = NULL
WHERE project_id IN (SELECT id FROM triaged_project_ids);

UPDATE public.challenge_completions
SET project_id = NULL
WHERE project_id IN (SELECT id FROM triaged_project_ids);

--------------------------------------------------------------------------------
-- PBL resources JSON that deep-links to a deleted project
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
-- Projects themselves
--------------------------------------------------------------------------------
DELETE FROM public.projects
WHERE id IN (SELECT id FROM triaged_project_ids);
