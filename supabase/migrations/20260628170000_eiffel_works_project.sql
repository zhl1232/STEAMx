-- A1：给积木「埃菲尔铁塔」课时接入「作品墙」。
-- 课程负责教学（PPT/动画/13 步/3D），作品上传复用项目侧能力：建一个背书项目作为该课时的作品墙，
-- 学员搭完后在课程工作区点「上传我的作品」→ /api/projects/[id]/completions 提交实物照片，进社区/个人主页展示。
-- 课时通过 content.building3d.worksProjectId 指向该项目（见 building-3d-workspace 的 LessonWorkUpload）。
-- 幂等：项目按标题查重，课时字段用 jsonb_set 合并。

DO $$
DECLARE
    v_author_id UUID;
    v_category_id INT;
    v_sub_id INT;
    v_project_id BIGINT;
    v_project_title TEXT := '我的积木埃菲尔铁塔';
BEGIN
    -- 作品归属作者用管理员账号（仅作背书项目的拥有者，学员作品各自归各自 user_id）。
    SELECT id INTO v_author_id
      FROM public.profiles
     WHERE role = 'admin'
     ORDER BY created_at ASC
     LIMIT 1;

    IF v_author_id IS NULL THEN
        SELECT id INTO v_author_id FROM public.profiles ORDER BY created_at ASC LIMIT 1;
    END IF;

    IF v_author_id IS NULL THEN
        RAISE NOTICE '跳过：profiles 表暂无用户，无法创建背书项目';
        RETURN;
    END IF;

    SELECT id INTO v_category_id FROM public.categories WHERE name = '工程' LIMIT 1;
    IF v_category_id IS NULL THEN
        RAISE EXCEPTION '找不到分类: 工程';
    END IF;

    SELECT id INTO v_sub_id
      FROM public.sub_categories
     WHERE category_id = v_category_id AND name = '模型制作'
     LIMIT 1;
    IF v_sub_id IS NULL THEN
        RAISE EXCEPTION '找不到子分类: 模型制作';
    END IF;

    SELECT id INTO v_project_id FROM public.projects WHERE title = v_project_title LIMIT 1;

    IF v_project_id IS NULL THEN
        INSERT INTO public.projects (
            title, description, author_id, image_url,
            category, sub_category_id, difficulty, difficulty_stars,
            status, steam_weights, tags
        ) VALUES (
            v_project_title,
            '跟着「小小积木工程师」课程搭出你的积木埃菲尔铁塔后，拍下作品上传到这里，和小伙伴们比一比谁搭得更稳更高！欢迎写下你搭建时的小发现或遇到的难题。',
            v_author_id,
            '/courses/eiffel-tower/finished.png',
            '工程',
            v_sub_id,
            'easy',
            2,
            'approved',
            '{"S":5,"T":5,"E":40,"A":20,"M":10}'::jsonb,
            ARRAY['乐高', '得宝', '大颗粒', '积木', '埃菲尔铁塔', '结构', '作品展示']
        )
        RETURNING id INTO v_project_id;
    ELSE
        UPDATE public.projects
           SET description = '跟着「小小积木工程师」课程搭出你的积木埃菲尔铁塔后，拍下作品上传到这里，和小伙伴们比一比谁搭得更稳更高！欢迎写下你搭建时的小发现或遇到的难题。',
               image_url = '/courses/eiffel-tower/finished.png',
               category = '工程',
               sub_category_id = v_sub_id,
               status = 'approved',
               updated_at = NOW()
         WHERE id = v_project_id;
    END IF;

    -- 把背书项目 ID 写回课时 content.building3d.worksProjectId。
    UPDATE public.course_lessons AS l
       SET content = jsonb_set(
               l.content,
               '{building3d,worksProjectId}',
               to_jsonb(v_project_id),
               true
           )
      FROM public.courses AS c
     WHERE l.course_id = c.id
       AND c.title = '小小积木工程师：学前大颗粒启蒙'
       AND l.title = '埃菲尔铁塔';

    RAISE NOTICE '埃菲尔作品墙项目 id=% 已就绪并写回课时', v_project_id;
END $$;
