\set ON_ERROR_STOP on
-- 服务端写入：公园精确公开；小区只给区县 + 模糊点
INSERT INTO public.observation_events (user_id, location_name, latitude, longitude, location_precision, place_category, public_district)
VALUES ('00000000-0000-0000-0000-00000000000a', '玉渊潭公园', 39.916620, 116.319932, 'exact', 'public_place', '海淀区'),
       ('00000000-0000-0000-0000-00000000000a', '某某小区3号楼', 39.990001, 116.300001, 'exact', 'private_area', '海淀区');
SELECT id, location_name, place_category, public_location_name, public_latitude, public_longitude FROM public.observation_events ORDER BY id;

SET ROLE anon;
\echo '--- anon 读原始列（应报 permission denied）'
\set ON_ERROR_STOP off
SELECT latitude FROM public.observation_events LIMIT 1;
SELECT * FROM public.observation_events LIMIT 1;
SELECT * FROM public.observation_events_owner LIMIT 1;
\set ON_ERROR_STOP on
\echo '--- anon 读公开视图'
SELECT id, location_name, latitude, longitude FROM public.observation_events_public ORDER BY id;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
\echo '--- 他人：owner 视图应为空，公开视图只有模糊值'
SELECT count(*) AS owner_rows_for_other FROM public.observation_events_owner;
SELECT id, location_name, latitude FROM public.observation_events_public ORDER BY id;
\set ON_ERROR_STOP off
\echo '--- 他人不能写分类字段（应报 permission denied）'
INSERT INTO public.observation_events (user_id, location_name, place_category) VALUES ('00000000-0000-0000-0000-00000000000b', 'x', 'public_place');
\set ON_ERROR_STOP on
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
\echo '--- 本人：owner 视图有原始坐标'
SELECT id, location_name, latitude, longitude FROM public.observation_events_owner ORDER BY id;
\echo '--- 本人用普通列插入（API 路径）+ RETURNING 安全列'
INSERT INTO public.observation_events (user_id, location_name, latitude, longitude, location_precision)
VALUES ('00000000-0000-0000-0000-00000000000a', '家门口', 31.230416, 121.473701, 'exact') RETURNING id, public_location_name, public_latitude, public_longitude;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', false);
\echo '--- 管理员：owner 视图可见全部'
SELECT count(*) AS admin_owner_rows FROM public.observation_events_owner;
RESET ROLE;
\echo '--- service_role 改分类后触发器重算'
SET ROLE service_role;
UPDATE public.observation_events SET place_category = 'unknown', public_district = '大同市平城区' WHERE location_name = '大同恒大绿洲';
RESET ROLE;
SELECT id, public_location_name, public_latitude, public_longitude FROM public.observation_events ORDER BY id;
