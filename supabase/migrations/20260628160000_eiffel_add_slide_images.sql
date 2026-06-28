-- 补丁：20260628150000 在被记录为「已执行」之后才追加了 slideImageUrls/videoSlideIndex，
-- 已迁移的库不会重跑那条迁移，故用本迁移单独把这两个字段合并进学前课「埃菲尔铁塔」的 building3d。
-- 用 jsonb_set 合并，不影响 building3d 其它字段；可重复执行（幂等）。
UPDATE public.course_lessons AS l
SET content = jsonb_set(
    jsonb_set(
        l.content,
        '{building3d,videoSlideIndex}',
        '5'::jsonb,
        true
    ),
    '{building3d,slideImageUrls}',
    '[
        "/courses/eiffel-tower/slides/slide-01.png","/courses/eiffel-tower/slides/slide-02.png",
        "/courses/eiffel-tower/slides/slide-03.png","/courses/eiffel-tower/slides/slide-04.png",
        "/courses/eiffel-tower/slides/slide-05.png","/courses/eiffel-tower/slides/slide-06.png",
        "/courses/eiffel-tower/slides/slide-07.png","/courses/eiffel-tower/slides/slide-08.png",
        "/courses/eiffel-tower/slides/slide-09.png","/courses/eiffel-tower/slides/slide-10.png",
        "/courses/eiffel-tower/slides/slide-11.png","/courses/eiffel-tower/slides/slide-12.png",
        "/courses/eiffel-tower/slides/slide-13.png","/courses/eiffel-tower/slides/slide-14.png",
        "/courses/eiffel-tower/slides/slide-15.png","/courses/eiffel-tower/slides/slide-16.png"
    ]'::jsonb,
    true
)
FROM public.courses AS c
WHERE l.course_id = c.id
  AND c.title = '小小积木工程师：学前大颗粒启蒙'
  AND l.title = '埃菲尔铁塔'
  AND l.content ? 'building3d';
