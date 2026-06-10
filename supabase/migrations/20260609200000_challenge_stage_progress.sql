-- Per-stage PBL progress: each user records their own artifact for每个挑战阶段。
-- 阶段产出(notes/images/data/video)会在提交作品时汇总预填，最终作品仍走 challenge_submissions。

CREATE TABLE IF NOT EXISTS public.challenge_stage_progress (
  id bigserial PRIMARY KEY,
  challenge_id bigint NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage_index smallint NOT NULL CHECK (stage_index >= 0),
  status varchar(20) NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed')),
  notes text,
  images text[] NOT NULL DEFAULT '{}'::text[],
  data jsonb,
  video_url text,
  ai_feedback jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id, stage_index)
);

CREATE INDEX IF NOT EXISTS idx_challenge_stage_progress_challenge_user
ON public.challenge_stage_progress(challenge_id, user_id);

CREATE INDEX IF NOT EXISTS idx_challenge_stage_progress_user
ON public.challenge_stage_progress(user_id);

ALTER TABLE public.challenge_stage_progress ENABLE ROW LEVEL SECURITY;

-- 本人可读写自己的阶段进度；管理员/审核员可读全部。
CREATE POLICY "challenge_stage_progress_select"
ON public.challenge_stage_progress FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'moderator')
  )
);

CREATE POLICY "challenge_stage_progress_insert"
ON public.challenge_stage_progress FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "challenge_stage_progress_update"
ON public.challenge_stage_progress FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "challenge_stage_progress_delete"
ON public.challenge_stage_progress FOR DELETE
USING (auth.uid() = user_id);

-- 给示例挑战补上阶段类型(kind)，让阶段工作台展示分类型的结构化产出字段。
-- 仅按标题匹配，幂等，不影响其它挑战。
UPDATE public.challenges
   SET stages = '[
     {"title":"观察真实需求","description":"选择一个校园或社区角落，记录谁会在那里停留、什么时候最晒、需要遮住多大范围。","hint":"先画一张简单场地平面图，不急着开始做模型。","kind":"observe"},
     {"title":"提出结构方案","description":"画出至少两种遮阳结构草图，比较立柱、屋顶形状和支撑方式。","hint":"注意屋顶越大，支撑和抗倾倒要求越高。","kind":"design"},
     {"title":"制作并测试原型","description":"用低成本材料制作一个可站立模型，测试承重、抗倾倒和遮阳范围。","hint":"每次测试只改一个变量，方便判断原因。","kind":"build_test"},
     {"title":"迭代并说明取舍","description":"根据测试结果改进模型，写清楚你保留、放弃或调整了哪些设计。","hint":"优秀作品应该能解释为什么这样设计。","kind":"iterate"}
   ]'::jsonb
 WHERE title = '校园遮阳休息站挑战';
