-- ============================================================================
-- 自然观察位置隐私分级（第 15 条）
--
-- 对正式库的影响（合并发布后会在 prod 执行）：
--   1. observation_events 新增 7 列：place_category（默认 'unknown'）、
--      public_township、public_district、public_city、public_location_name、public_latitude、public_longitude。
--      新增列对已有行为 NULL / 'unknown'，**本迁移不回填、不改历史行的原有列**。
--   2. 新增触发器：写入或修改位置/分类时，由数据库计算对外公开的位置：
--        public_place  → 公开地点名 + 精确点
--        其他/未知     → 只公开「街道/乡镇附近」（退而「区县附近」→ 城市 → 大概区域）
--                         + 约 500m 网格中心点
--        hidden        → 不公开
--   3. 收回 anon / authenticated 对整张表的 SELECT，再按列授予
--      （不含 location_name / latitude / longitude 三个原始列）。
--      之后匿名和普通登录用户都**读不到原始精确坐标和原始地点名**。
--   4. 新增视图 observation_events_public（对外，位置列换成公开值，沿用 RLS）
--      和 observation_events_owner（原始位置，仅本人 + 版主/管理员）。
--   历史数据的公开字段由 scripts/backfill-observation-location-privacy.mjs 回填，
--   需要人工确认后再执行；回填前历史记录对外不显示位置（name 回退为「大概区域」、坐标为空）。
-- ============================================================================

ALTER TABLE public.observation_events
  ADD COLUMN IF NOT EXISTS place_category text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS public_township text,
  ADD COLUMN IF NOT EXISTS public_district text,
  ADD COLUMN IF NOT EXISTS public_city text,
  ADD COLUMN IF NOT EXISTS public_location_name text,
  ADD COLUMN IF NOT EXISTS public_latitude numeric(9, 6),
  ADD COLUMN IF NOT EXISTS public_longitude numeric(9, 6);

ALTER TABLE public.observation_events
  DROP CONSTRAINT IF EXISTS observation_events_place_category_check;
ALTER TABLE public.observation_events
  ADD CONSTRAINT observation_events_place_category_check
  CHECK (place_category IN ('public_place', 'private_area', 'unknown'));

-- 约 500m 的网格中心点：纬度 0.005° ≈ 555m；经度按纬度缩放后同样约 500m。
CREATE OR REPLACE FUNCTION public.observation_fuzz_coordinate(value numeric, step numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN value IS NULL OR step IS NULL OR step <= 0 THEN NULL
    ELSE round((floor(value / step) * step + step / 2)::numeric, 6)
  END;
$$;

CREATE OR REPLACE FUNCTION public.observation_compute_public_location()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  lng_step numeric;
BEGIN
  IF NEW.location_precision = 'hidden' THEN
    NEW.public_location_name := '位置已隐藏';
    NEW.public_latitude := NULL;
    NEW.public_longitude := NULL;
  ELSIF NEW.place_category = 'public_place' THEN
    NEW.public_location_name := NEW.location_name;
    NEW.public_latitude := NEW.latitude;
    NEW.public_longitude := NEW.longitude;
  ELSE
    NEW.public_location_name := COALESCE(
      NULLIF(btrim(NEW.public_township), '') || '附近',
      NULLIF(btrim(NEW.public_district), '') || '附近',
      NULLIF(btrim(NEW.public_city), ''),
      '大概区域'
    );
    NEW.public_latitude := public.observation_fuzz_coordinate(NEW.latitude, 0.005);
    lng_step := CASE
      WHEN NEW.latitude IS NULL THEN NULL
      ELSE 0.005 / GREATEST(cos(radians(NEW.latitude::double precision))::numeric, 0.2)
    END;
    NEW.public_longitude := public.observation_fuzz_coordinate(NEW.longitude, round(lng_step, 6));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS observation_events_public_location ON public.observation_events;
CREATE TRIGGER observation_events_public_location
  BEFORE INSERT OR UPDATE OF location_name, latitude, longitude, location_precision, place_category, public_township, public_district, public_city
  ON public.observation_events
  FOR EACH ROW
  EXECUTE FUNCTION public.observation_compute_public_location();

-- 列级权限：原始地点名和坐标只有 service_role / 视图属主能读。
REVOKE SELECT ON public.observation_events FROM anon, authenticated;
GRANT SELECT (
  id, user_id, project_id, challenge_id, observed_at, location_precision, habitat, weather, notes,
  media_urls, is_public, status, created_at, updated_at, likes_count, comments_count, nature_topic,
  identification_status, observed_at_source, location_source, coordinate_system, lifecycle_stage, sex,
  moderation_state, suggested_species_name, suggested_scientific_name,
  place_category, public_township, public_district, public_city, public_location_name, public_latitude, public_longitude
) ON public.observation_events TO anon, authenticated;

-- 对外视图：列名与原表一致，位置换成公开值；security_invoker 让原有 RLS 照常生效。
DROP VIEW IF EXISTS public.observation_events_public;
CREATE VIEW public.observation_events_public
WITH (security_invoker = true) AS
SELECT
  id, user_id, project_id, challenge_id, observed_at,
  COALESCE(public_location_name, '大概区域') AS location_name,
  public_latitude AS latitude,
  public_longitude AS longitude,
  location_precision, habitat, weather, notes, media_urls, is_public, status, created_at, updated_at,
  likes_count, comments_count, nature_topic, identification_status, observed_at_source, location_source,
  coordinate_system, lifecycle_stage, sex, moderation_state, suggested_species_name, suggested_scientific_name,
  place_category, public_township, public_district, public_city
FROM public.observation_events;

GRANT SELECT ON public.observation_events_public TO anon, authenticated, service_role;

-- 本人视图：原始地点和坐标。没有家长关系表，所以范围是「本人 + 版主/管理员」。
-- 视图以属主权限读取原始列（security_invoker = false），过滤条件写在视图里。
DROP VIEW IF EXISTS public.observation_events_owner;
CREATE VIEW public.observation_events_owner
WITH (security_invoker = false, security_barrier = true) AS
SELECT e.*
FROM public.observation_events AS e
WHERE e.user_id = (SELECT auth.uid())
   OR public.is_moderator_or_admin();

REVOKE ALL ON public.observation_events_owner FROM PUBLIC, anon;
GRANT SELECT ON public.observation_events_owner TO authenticated, service_role;

-- 写入权限：登录用户不能自己改分类和公开位置字段（只能由服务端 service_role 写）。
REVOKE INSERT, UPDATE ON public.observation_events FROM anon, authenticated;
GRANT INSERT (
  user_id, project_id, challenge_id, observed_at, location_name, latitude, longitude, location_precision,
  habitat, weather, notes, media_urls, is_public, status, nature_topic, identification_status,
  observed_at_source, location_source, coordinate_system, lifecycle_stage, sex, moderation_state,
  suggested_species_name, suggested_scientific_name
) ON public.observation_events TO authenticated;
GRANT UPDATE (
  observed_at, location_name, latitude, longitude, location_precision, habitat, weather, notes, media_urls,
  is_public, status, nature_topic, identification_status, observed_at_source, location_source,
  coordinate_system, lifecycle_stage, sex, moderation_state, suggested_species_name, suggested_scientific_name,
  updated_at, likes_count, comments_count
) ON public.observation_events TO authenticated;
