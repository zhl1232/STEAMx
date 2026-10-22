-- 本地临时库验证用的最小 Supabase 环境（仅用于验证，不会进入正式库）。
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
CREATE TABLE public.profiles (id uuid PRIMARY KEY, role text DEFAULT 'user');
GRANT SELECT ON public.profiles TO anon, authenticated, service_role;
CREATE FUNCTION public.is_moderator_or_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('moderator','admin')) $$;
GRANT EXECUTE ON FUNCTION public.is_moderator_or_admin() TO anon, authenticated, service_role;
CREATE TABLE public.observation_events (
  id bigserial PRIMARY KEY, user_id uuid NOT NULL REFERENCES public.profiles(id), project_id bigint, challenge_id bigint,
  observed_at timestamptz NOT NULL DEFAULT now(), location_name text NOT NULL, latitude numeric(9,6), longitude numeric(9,6),
  location_precision text DEFAULT 'approximate', habitat text, weather text, notes text, media_urls text[] NOT NULL DEFAULT '{}',
  is_public boolean NOT NULL DEFAULT true, status text NOT NULL DEFAULT 'approved', created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), likes_count int NOT NULL DEFAULT 0, comments_count int NOT NULL DEFAULT 0,
  nature_topic text, identification_status text NOT NULL DEFAULT 'needs_id', observed_at_source text, location_source text,
  coordinate_system text, lifecycle_stage text, sex text, moderation_state text NOT NULL DEFAULT 'approved',
  suggested_species_name text, suggested_scientific_name text);
ALTER TABLE public.observation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY observation_events_select ON public.observation_events FOR SELECT USING (
  (is_public AND status = 'approved' AND moderation_state = 'approved') OR (SELECT auth.uid()) = user_id OR public.is_moderator_or_admin());
CREATE POLICY observation_events_insert_own ON public.observation_events FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY observation_events_update_own ON public.observation_events FOR UPDATE USING ((SELECT auth.uid()) = user_id);
GRANT ALL ON public.observation_events TO anon, authenticated, service_role;
GRANT USAGE ON SEQUENCE public.observation_events_id_seq TO authenticated, service_role;
INSERT INTO public.profiles VALUES ('00000000-0000-0000-0000-00000000000a','user'),('00000000-0000-0000-0000-00000000000b','user'),('00000000-0000-0000-0000-0000000000ad','admin');
-- 迁移前已有的历史行
INSERT INTO public.observation_events (user_id, location_name, latitude, longitude, location_precision)
VALUES ('00000000-0000-0000-0000-00000000000a', '大同恒大绿洲', 40.051313, 113.339775, 'exact');
