-- Auto interaction accounts and action queue.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_auto_interaction_account boolean NOT NULL DEFAULT false;

INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
VALUES
  ('a1000001-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'auto-linyu@steamx.local', crypt(encode(gen_random_bytes(18), 'hex'), gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"林予","avatar_url":"/avatars/default-1.svg"}', now(), now(), '', '', '', ''),
  ('a1000002-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'auto-xiaozhou@steamx.local', crypt(encode(gen_random_bytes(18), 'hex'), gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"小舟","avatar_url":"/avatars/default-2.svg"}', now(), now(), '', '', '', ''),
  ('a1000003-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'auto-acheng@steamx.local', crypt(encode(gen_random_bytes(18), 'hex'), gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"阿澄","avatar_url":"/avatars/default-3.svg"}', now(), now(), '', '', '', ''),
  ('a1000004-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'auto-nanqiao@steamx.local', crypt(encode(gen_random_bytes(18), 'hex'), gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"南乔","avatar_url":"/avatars/default-4.svg"}', now(), now(), '', '', '', ''),
  ('a1000005-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'auto-xinghe@steamx.local', crypt(encode(gen_random_bytes(18), 'hex'), gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"星河","avatar_url":"/avatars/default-5.svg"}', now(), now(), '', '', '', ''),
  ('a1000006-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'auto-lizi@steamx.local', crypt(encode(gen_random_bytes(18), 'hex'), gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"一颗栗子","avatar_url":"/avatars/default-6.svg"}', now(), now(), '', '', '', ''),
  ('a1000007-0000-4000-8000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'auto-paperplane@steamx.local', crypt(encode(gen_random_bytes(18), 'hex'), gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"晴天纸飞机","avatar_url":"/avatars/default-7.svg"}', now(), now(), '', '', '', ''),
  ('a1000008-0000-4000-8000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'auto-mumu@steamx.local', crypt(encode(gen_random_bytes(18), 'hex'), gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"木木","avatar_url":"/avatars/default-8.svg"}', now(), now(), '', '', '', ''),
  ('a1000009-0000-4000-8000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'auto-wanxing@steamx.local', crypt(encode(gen_random_bytes(18), 'hex'), gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"晚星","avatar_url":"/avatars/default-9.svg"}', now(), now(), '', '', '', ''),
  ('a1000010-0000-4000-8000-000000000010', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'auto-xiaoman@steamx.local', crypt(encode(gen_random_bytes(18), 'hex'), gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"小满","avatar_url":"/avatars/default-10.svg"}', now(), now(), '', '', '', ''),
  ('a1000011-0000-4000-8000-000000000011', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'auto-orange@steamx.local', crypt(encode(gen_random_bytes(18), 'hex'), gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"橙子同学","avatar_url":"/avatars/default-11.svg"}', now(), now(), '', '', '', ''),
  ('a1000012-0000-4000-8000-000000000012', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'auto-blueberry@steamx.local', crypt(encode(gen_random_bytes(18), 'hex'), gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"蓝莓实验室","avatar_url":"/avatars/default-12.svg"}', now(), now(), '', '', '', ''),
  ('a1000013-0000-4000-8000-000000000013', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'auto-zhiliao@steamx.local', crypt(encode(gen_random_bytes(18), 'hex'), gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"知了","avatar_url":"/avatars/default-1.svg"}', now(), now(), '', '', '', ''),
  ('a1000014-0000-4000-8000-000000000014', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'auto-xiaobei@steamx.local', crypt(encode(gen_random_bytes(18), 'hex'), gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"小北","avatar_url":"/avatars/default-2.svg"}', now(), now(), '', '', '', ''),
  ('a1000015-0000-4000-8000-000000000015', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'auto-pencil@steamx.local', crypt(encode(gen_random_bytes(18), 'hex'), gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"会飞的铅笔","avatar_url":"/avatars/default-3.svg"}', now(), now(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (
  id,
  username,
  display_name,
  role,
  avatar_url,
  bio,
  xp,
  coins,
  level,
  age_confirmed_at,
  is_auto_interaction_account
)
VALUES
  ('a1000001-0000-4000-8000-000000000001', 'linyu_notes', '林予', 'user', '/avatars/default-1.svg', '喜欢做小实验，也会记录路边看到的植物。', 180, 12, 3, now(), true),
  ('a1000002-0000-4000-8000-000000000002', 'xiaozhou_lab', '小舟', 'user', '/avatars/default-2.svg', '周末常在家折腾纸板、传感器和小模型。', 240, 18, 4, now(), true),
  ('a1000003-0000-4000-8000-000000000003', 'acheng_makes', '阿澄', 'user', '/avatars/default-3.svg', '喜欢把普通材料改造成能动的小装置。', 120, 9, 2, now(), true),
  ('a1000004-0000-4000-8000-000000000004', 'nanqiao_sketch', '南乔', 'user', '/avatars/default-4.svg', '画图和手作都想试试，最近在看自然观察。', 300, 21, 5, now(), true),
  ('a1000005-0000-4000-8000-000000000005', 'xinghe_try', '星河', 'user', '/avatars/default-5.svg', '喜欢先做个粗糙版本，再慢慢调好。', 210, 15, 4, now(), true),
  ('a1000006-0000-4000-8000-000000000006', 'one_lizi', '一颗栗子', 'user', '/avatars/default-6.svg', '收集有意思的项目，偶尔写一点观察笔记。', 160, 10, 3, now(), true),
  ('a1000007-0000-4000-8000-000000000007', 'paperplane_sun', '晴天纸飞机', 'user', '/avatars/default-7.svg', '喜欢轻量的小挑战，尤其是能马上动手的。', 260, 19, 4, now(), true),
  ('a1000008-0000-4000-8000-000000000008', 'mumu_builder', '木木', 'user', '/avatars/default-8.svg', '做东西时总想把结构弄得更稳一点。', 140, 8, 2, now(), true),
  ('a1000009-0000-4000-8000-000000000009', 'wanxing_map', '晚星', 'user', '/avatars/default-9.svg', '喜欢地图、星空和各种需要细看的细节。', 330, 24, 5, now(), true),
  ('a1000010-0000-4000-8000-000000000010', 'xiaoman_daily', '小满', 'user', '/avatars/default-10.svg', '把每天一点点发现攒起来，也挺有成就感。', 190, 13, 3, now(), true),
  ('a1000011-0000-4000-8000-000000000011', 'orange_classmate', '橙子同学', 'user', '/avatars/default-11.svg', '偏爱颜色好看、步骤清楚的创作。', 280, 20, 4, now(), true),
  ('a1000012-0000-4000-8000-000000000012', 'blueberry_lab', '蓝莓实验室', 'user', '/avatars/default-12.svg', '会把看到的好点子先收藏起来慢慢做。', 360, 27, 6, now(), true),
  ('a1000013-0000-4000-8000-000000000013', 'zhiliao_notes', '知了', 'user', '/avatars/default-1.svg', '自然观察新手，最近在认昆虫和树叶。', 110, 7, 2, now(), true),
  ('a1000014-0000-4000-8000-000000000014', 'north_corner', '小北', 'user', '/avatars/default-2.svg', '喜欢简洁但能看出想法的项目。', 230, 16, 4, now(), true),
  ('a1000015-0000-4000-8000-000000000015', 'flying_pencil', '会飞的铅笔', 'user', '/avatars/default-3.svg', '爱看别人怎么解决同一个小问题。', 310, 22, 5, now(), true)
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  display_name = EXCLUDED.display_name,
  avatar_url = EXCLUDED.avatar_url,
  bio = EXCLUDED.bio,
  is_auto_interaction_account = true,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.auto_interaction_jobs (
  id bigserial PRIMARY KEY,
  target_type text NOT NULL,
  target_id bigint NOT NULL,
  source_author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  scheduled_for timestamptz NOT NULL,
  generated_content text,
  attempt_count integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auto_interaction_jobs_target_type_check
    CHECK (target_type IN ('project', 'completion', 'observation')),
  CONSTRAINT auto_interaction_jobs_action_type_check
    CHECK (action_type IN ('reply', 'like', 'collection')),
  CONSTRAINT auto_interaction_jobs_status_check
    CHECK (status IN ('queued', 'running', 'done', 'skipped', 'error')),
  CONSTRAINT auto_interaction_jobs_attempt_count_check
    CHECK (attempt_count >= 0),
  CONSTRAINT auto_interaction_jobs_unique_action
    UNIQUE (target_type, target_id, actor_user_id, action_type)
);

CREATE INDEX IF NOT EXISTS idx_auto_interaction_jobs_due
  ON public.auto_interaction_jobs (scheduled_for, id)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS idx_auto_interaction_jobs_target
  ON public.auto_interaction_jobs (target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_profiles_auto_interaction
  ON public.profiles (id)
  WHERE is_auto_interaction_account = true;

CREATE OR REPLACE FUNCTION public.set_auto_interaction_jobs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_interaction_jobs_updated_at ON public.auto_interaction_jobs;
CREATE TRIGGER trg_auto_interaction_jobs_updated_at
  BEFORE UPDATE ON public.auto_interaction_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_auto_interaction_jobs_updated_at();

ALTER TABLE public.auto_interaction_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages auto interaction jobs" ON public.auto_interaction_jobs;
CREATE POLICY "Service role manages auto interaction jobs"
  ON public.auto_interaction_jobs
  FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

COMMENT ON TABLE public.auto_interaction_jobs IS 'Internal queue for delayed automatic replies, likes, and project collections.';
COMMENT ON COLUMN public.profiles.is_auto_interaction_account IS 'Internal flag for accounts that may perform automatic community interactions.';
