-- 归一化 challenges.resources 历史数据：
-- 1. type 收敛为三分类（project / skill / reference）；
--    旧值 guide / article / video / pdf / link 等统一归为 reference。
-- 2. 剔除 CTA 型条目（template / entry / internal），它们是操作入口而非学习资料，
--    详情页 CTA 已由独立按钮承载。
-- 3. 剔除缺 title 或 url 的脏数据。

UPDATE public.challenges c
   SET resources = COALESCE(
     (
       SELECT jsonb_agg(
         jsonb_build_object(
           'title', elem->>'title',
           'url', elem->>'url',
           'type', CASE
             WHEN elem->>'type' IN ('project', 'skill', 'reference') THEN elem->>'type'
             ELSE 'reference'
           END
         )
         || CASE
              WHEN COALESCE(elem->>'description', '') <> ''
                THEN jsonb_build_object('description', elem->>'description')
              ELSE '{}'::jsonb
            END
       )
       FROM jsonb_array_elements(c.resources) AS elem
       WHERE COALESCE(elem->>'title', '') <> ''
         AND COALESCE(elem->>'url', '') <> ''
         AND COALESCE(elem->>'type', '') NOT IN ('template', 'entry', 'internal')
     ),
     '[]'::jsonb
   )
 WHERE jsonb_typeof(c.resources) = 'array'
   AND jsonb_array_length(c.resources) > 0;
