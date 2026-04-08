DO $$
DECLARE
    v_sub_id INT;
    v_project_id BIGINT;
    v_author_id UUID;
BEGIN
    SELECT id INTO v_author_id FROM public.profiles WHERE role = 'admin' LIMIT 1;
    IF v_author_id IS NULL THEN
        SELECT id INTO v_author_id FROM public.profiles LIMIT 1;
    END IF;
    IF v_author_id IS NULL THEN
        RAISE EXCEPTION 'No users found in profiles table';
    END IF;
    SELECT id INTO v_sub_id FROM public.sub_categories WHERE name = '3D打印' LIMIT 1;
    IF v_sub_id IS NULL THEN RAISE EXCEPTION '找不到子分类: 3D打印'; END IF;

    -- Project 1: 设计你的名字标牌
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('设计你的名字标牌', '使用TinkerCAD软件设计一个带有自己名字的个性化标牌，并用3D打印机打印出来。参与者将学习基础的3D建模操作，理解从数字设计到实体制造的完整流程。', v_author_id, v_sub_id, 1, 40, 'approved', '/projects/tech_3dprint.webp', ARRAY['TinkerCAD','入门','技术','3D打印'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, 'TinkerCAD账号（免费在线工具）', 1),
        (v_project_id, '3D打印机（PLA耗材）', 2),
        (v_project_id, 'PLA线材（任意颜色）', 3),
        (v_project_id, '电脑或平板', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '注册并认识界面', '在TinkerCAD网站注册一个账号，熟悉工作台上的基本形状和操作工具，学习移动、缩放和旋转视角。', 1),
        (v_project_id, '设计底板', '拖入一个长方体作为标牌底板，调整长度约80毫米、宽度30毫米、厚度3毫米。', 2),
        (v_project_id, '添加文字', '使用文字工具输入自己的名字，调整字体大小和位置，将文字放在底板上方并对齐居中。', 3),
        (v_project_id, '导出并打印', '将设计导出为STL文件，导入切片软件设置打印参数（层高0.2毫米、填充20%），开始3D打印。', 4),
        (v_project_id, '后处理展示', '打印完成后小心取下模型，去除支撑材料，用砂纸打磨边缘，完成你的专属名字标牌。', 5);

    -- Project 2: 3D打印手机支架
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('3D打印手机支架', '设计并打印一个实用的手机支架，可以在桌上稳固地放置手机观看视频。参与者将学习考虑实际使用需求来设计产品，理解结构稳定性和重心的关系。', v_author_id, v_sub_id, 1, 45, 'approved', '/projects/tech_3dprint.webp', ARRAY['建模','实用','技术','3D打印'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '3D建模软件（TinkerCAD或Fusion 360）', 1),
        (v_project_id, '3D打印机', 2),
        (v_project_id, 'PLA线材', 3),
        (v_project_id, '手机（用于测量尺寸）', 4),
        (v_project_id, '直尺', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '测量与规划', '用直尺测量手机的宽度和厚度，在纸上画出支架的侧面草图，确定倾斜角度约为60度。', 1),
        (v_project_id, '建模底座', '在建模软件中创建一个足够宽的底座，确保放上手机后重心不会前倾导致翻倒。', 2),
        (v_project_id, '设计支撑结构', '从底座向上延伸一个带有凹槽的支撑面，凹槽宽度略大于手机厚度，用于卡住手机底部。', 3),
        (v_project_id, '打印与测试', '导出STL文件进行切片和打印，打印完成后放上手机测试稳定性，如有问题则调整设计重新打印。', 4);

    -- Project 3: 设计一个骰子
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('设计一个骰子', '用3D建模软件设计一个标准六面骰子，在每个面上刻出正确数量的点数。参与者将练习精确尺寸控制和布尔运算，学习几何体的面、棱、顶点概念。', v_author_id, v_sub_id, 1, 35, 'approved', '/projects/tech_3dprint.webp', ARRAY['建模','几何','技术','3D打印'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, 'TinkerCAD或其他3D建模软件', 1),
        (v_project_id, '3D打印机', 2),
        (v_project_id, 'PLA线材（建议双色打印或后期上色）', 3),
        (v_project_id, '砂纸（细砂）', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '创建立方体', '在建模软件中创建一个边长为16毫米的正方体，将所有棱角进行圆角处理使骰子更美观。', 1),
        (v_project_id, '制作点数凹坑', '创建小球体作为"挖孔"工具，直径约2.5毫米，用来在骰子每个面上刻出对应的点数凹坑。', 2),
        (v_project_id, '布置六面点数', '将1到6的点数分别布置在六个面上，注意相对面的点数之和为7（1对6、2对5、3对4）。', 3),
        (v_project_id, '布尔运算与打印', '对每个面执行布尔差集运算刻出凹坑，导出STL文件并打印，层高设置为0.1毫米以获得更好的细节。', 4),
        (v_project_id, '上色完成', '用丙烯颜料为凹坑上色，让点数更加清晰可见，完成一个漂亮的自制骰子。', 5);

    -- Project 4: 3D打印书签
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('3D打印书签', '设计一个薄而有趣的3D打印书签，可以夹在书页上标记阅读进度。参与者将学习薄壁结构的设计技巧，理解3D打印对最小壁厚的要求。', v_author_id, v_sub_id, 1, 30, 'approved', '/projects/tech_3dprint.webp', ARRAY['建模','薄壁','技术','3D打印'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, 'TinkerCAD或3D建模软件', 1),
        (v_project_id, '3D打印机', 2),
        (v_project_id, 'PLA线材（推荐亮色）', 3);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计书签形状', '在建模软件中创建一个长约120毫米、宽20毫米、厚度仅0.8毫米的薄片作为书签主体。', 1),
        (v_project_id, '添加装饰图案', '在书签顶部添加喜欢的形状装饰（如星星、小动物轮廓），使书签露出书页的部分更加美观。', 2),
        (v_project_id, '设计夹持结构', '在书签底部设计一个回形夹的结构，让书签能牢固地夹在书页上不易滑落。', 3),
        (v_project_id, '切片与打印', '导出STL文件，在切片软件中将层高设为0.12毫米、填充100%以保证薄壁强度，开始打印。', 4),
        (v_project_id, '测试使用', '小心取下打印好的书签，测试夹在不同厚度书页上的效果，体验从设计到使用的成就感。', 5);

    -- Project 5: 3D打印钥匙扣
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('3D打印钥匙扣', '设计一个独一无二的个性化钥匙扣，可以加入自己的名字首字母或喜爱的图案。参与者将深入学习TinkerCAD的组合与分组功能，培养个性化产品设计的创意思维。', v_author_id, v_sub_id, 2, 45, 'approved', '/projects/tech_3dprint.webp', ARRAY['TinkerCAD','个性化','技术','3D打印'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, 'TinkerCAD账号', 1),
        (v_project_id, '3D打印机', 2),
        (v_project_id, 'PLA线材（多种颜色可选）', 3),
        (v_project_id, '钥匙环', 4),
        (v_project_id, '电脑或平板', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '创意构思', '在纸上画出钥匙扣的设计草图，确定整体形状（圆形、方形或自定义轮廓），大小控制在40毫米以内。', 1),
        (v_project_id, '建模主体', '在TinkerCAD中创建钥匙扣的主体形状，厚度设为4毫米以保证强度，添加一个直径5毫米的挂孔。', 2),
        (v_project_id, '添加个性元素', '使用文字工具添加名字首字母，或用基本形状组合出喜欢的图案（如小动物、星星），通过凸起或凹刻方式呈现。', 3),
        (v_project_id, '组合与检查', '将所有元素分组合并，检查模型是否有悬空或过薄的部分，确保打印时不会出现问题。', 4),
        (v_project_id, '打印与组装', '导出并打印模型，完成后穿入钥匙环，一个专属于自己的钥匙扣就完成了。', 5);

    -- Project 6: 定制笔筒设计
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('定制笔筒设计', '设计一个带有多个分隔区域的个性化笔筒，可以分类收纳不同文具。参与者将学习空心体建模技巧，理解壁厚对结构强度的影响以及"挖空"操作的原理。', v_author_id, v_sub_id, 2, 50, 'approved', '/projects/tech_3dprint.webp', ARRAY['建模','空心体','技术','3D打印'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '3D建模软件（TinkerCAD或Fusion 360）', 1),
        (v_project_id, '3D打印机', 2),
        (v_project_id, 'PLA线材', 3),
        (v_project_id, '直尺和铅笔（画草图）', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '需求分析', '清点自己常用的文具类型和数量，规划笔筒需要几个分区，在纸上画出俯视图草图。', 1),
        (v_project_id, '建模外壳', '创建一个圆柱体或多边形柱体作为笔筒外壳，高度约100毫米，直径约80毫米。', 2),
        (v_project_id, '挖空内部', '创建一个略小的相同形状作为"挖孔"对象，从顶部减去形成空心结构，壁厚保留2毫米。', 3),
        (v_project_id, '添加分隔板', '在内部添加薄板将空间分隔成不同区域，方便分类放置笔、尺子、橡皮等文具。', 4),
        (v_project_id, '装饰与导出', '在外壁添加喜欢的图案或纹理装饰，检查模型完整性后导出STL文件。', 5),
        (v_project_id, '打印与使用', '设置合适的打印参数（填充15%、壁厚3层），打印完成后即可用来整理桌面文具。', 6);

    -- Project 7: 3D打印迷宫球
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('3D打印迷宫球', '设计一个透明外壳内含有迷宫轨道的球形玩具，小钢珠需要沿着迷宫路径滚到终点。参与者将学习嵌套结构的设计方法，掌握3D打印一体成型的组装技巧。', v_author_id, v_sub_id, 2, 60, 'approved', '/projects/tech_3dprint.webp', ARRAY['建模','嵌套','技术','3D打印'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '3D建模软件', 1),
        (v_project_id, '3D打印机', 2),
        (v_project_id, '透明或半透明PLA线材', 3),
        (v_project_id, '小钢珠（直径约5毫米）', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计迷宫路径', '在纸上画出迷宫路径草图，包含起点、终点和若干岔路，确保路径宽度足够钢珠通过（约6毫米）。', 1),
        (v_project_id, '建模内部轨道', '在建模软件中创建球形内壁，沿球壁内侧建立迷宫轨道和挡板，形成曲折的滚珠通道。', 2),
        (v_project_id, '创建外壳', '设计两个半球形外壳，与内部轨道保留足够间隙，预留一个放入钢珠的小口。', 3),
        (v_project_id, '打印与组装', '分别打印上下两个半球，放入钢珠后用胶水粘合两半球体，确保密封但钢珠能自由滚动。', 4),
        (v_project_id, '测试游玩', '摇晃和旋转迷宫球，尝试将钢珠引导通过迷宫到达终点，和朋友比赛谁先完成。', 5);

    -- Project 8: 动物模型设计
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('动物模型设计', '用3D建模软件设计一个自己喜爱的小动物模型并打印出来，如小猫、小狗或小兔子。参与者将学习有机形状的建模方法，提升空间想象力和艺术造型能力。', v_author_id, v_sub_id, 2, 55, 'approved', '/projects/tech_3dprint.webp', ARRAY['建模','雕刻','技术','3D打印'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '3D建模软件（推荐SculptGL或TinkerCAD）', 1),
        (v_project_id, '3D打印机', 2),
        (v_project_id, 'PLA线材', 3),
        (v_project_id, '丙烯颜料和画笔（上色用）', 4),
        (v_project_id, '动物参考图片', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '观察与草图', '找到喜欢的动物照片，从正面和侧面观察其外形特征，在纸上画出简化的轮廓草图。', 1),
        (v_project_id, '搭建基础形状', '用球体做头部、椭球体做身体，圆柱体做四肢，通过调整大小和位置拼出动物的基本体态。', 2),
        (v_project_id, '添加细节特征', '添加耳朵、尾巴、鼻子等特征部位，调整形状使动物看起来更加生动可爱。', 3),
        (v_project_id, '合并与优化', '将所有部件合并为一个整体模型，检查是否有悬空部分需要添加支撑，确保可打印性。', 4),
        (v_project_id, '打印与上色', '打印模型后用砂纸打磨表面，再用丙烯颜料为小动物涂上逼真的颜色和表情。', 5);

    -- Project 9: 3D打印齿轮玩具
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('3D打印齿轮玩具', '设计并打印一组能够互相啮合转动的齿轮，安装在底板上制成有趣的机械玩具。参与者将学习齿轮的基本参数（齿数、模数、压力角），理解齿轮传动的速比关系。', v_author_id, v_sub_id, 3, 70, 'approved', '/projects/tech_3dprint.webp', ARRAY['齿轮','啮合','技术','3D打印'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '3D建模软件（推荐Fusion 360或齿轮生成器插件）', 1),
        (v_project_id, '3D打印机', 2),
        (v_project_id, 'PLA线材（两种颜色）', 3),
        (v_project_id, '圆木棍或竹签（做轴）', 4),
        (v_project_id, '硬纸板或木板（做底板）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '学习齿轮知识', '了解齿轮的基本概念：齿数决定大小，模数决定齿的粗细，两个啮合齿轮的模数必须相同。', 1),
        (v_project_id, '设计齿轮组', '使用齿轮生成工具创建一大一小两个齿轮（如20齿和10齿，模数1），确保中心距正确以便顺利啮合。', 2),
        (v_project_id, '建模底板与轴', '设计安装底板，上面留出两个轴孔，间距等于两齿轮的中心距，轴孔直径与竹签匹配。', 3),
        (v_project_id, '打印与组装', '分别打印齿轮和底板，将竹签插入底板轴孔，再把齿轮套在轴上使齿轮啮合。', 4),
        (v_project_id, '测试传动', '转动大齿轮观察小齿轮的转速变化，验证传动比：小齿轮转速 = 大齿轮转速 × 大齿轮齿数 ÷ 小齿轮齿数。', 5),
        (v_project_id, '扩展创造', '尝试添加更多齿轮组成齿轮链，在最后一个齿轮上装上箭头指针，制成一个有趣的机械联动装置。', 6);

    -- Project 10: 可组装积木设计
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('可组装积木设计', '设计一套可以互相拼接的3D打印积木，各部件之间通过凸起和凹槽精确配合。参与者将学习制造公差的概念，理解零件配合精度对组装效果的重要影响。', v_author_id, v_sub_id, 3, 75, 'approved', '/projects/tech_3dprint.webp', ARRAY['公差','配合','技术','3D打印'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '3D建模软件', 1),
        (v_project_id, '3D打印机', 2),
        (v_project_id, 'PLA线材（多种颜色）', 3),
        (v_project_id, '游标卡尺（测量精度）', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计接口标准', '确定积木的连接方式——凸起直径为5毫米、高4毫米，凹槽直径为5.2毫米、深4毫米，预留0.2毫米的配合间隙。', 1),
        (v_project_id, '建模基础块', '设计一个20毫米×20毫米×20毫米的标准积木块，顶面设置凸起，底面设置对应凹槽。', 2),
        (v_project_id, '打印测试件', '先打印一对测试积木，检验凸起和凹槽是否能顺畅插入又不会太松，根据实际情况调整公差。', 3),
        (v_project_id, '设计多种形状', '在标准接口基础上设计不同形状的积木：长条形、L形、T形等，保持连接口规格统一。', 4),
        (v_project_id, '批量打印', '用不同颜色的线材打印完整一套积木（至少10块不同形状），确保每块都能与其他块互相拼接。', 5),
        (v_project_id, '创意搭建', '用自己设计的积木搭建各种造型，体验从设计标准到批量生产的完整制造流程。', 6);

    -- Project 11: 3D打印花瓶
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('3D打印花瓶', '使用参数化建模方法设计一个优雅的曲面花瓶，通过调整参数即可生成不同造型。参与者将学习曲面建模和参数化设计思想，理解数学函数如何塑造美丽的三维形态。', v_author_id, v_sub_id, 3, 65, 'approved', '/projects/tech_3dprint.webp', ARRAY['曲面','参数化','技术','3D打印'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '参数化建模软件（推荐OpenSCAD或Fusion 360）', 1),
        (v_project_id, '3D打印机', 2),
        (v_project_id, 'PLA线材', 3),
        (v_project_id, '砂纸（多种目数）', 4);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '了解参数化设计', '学习参数化设计的概念——通过修改数值参数自动改变模型形状，而不是手动拖拽每个面。', 1),
        (v_project_id, '定义花瓶轮廓', '用数学曲线定义花瓶的侧面轮廓——底部宽、中间收窄、顶部外翻，设置高度、最大直径等参数。', 2),
        (v_project_id, '旋转成体', '将轮廓曲线绕中轴旋转360度生成三维花瓶实体，调整壁厚为2毫米形成空心结构。', 3),
        (v_project_id, '参数调试', '修改不同参数观察花瓶造型变化，如增大波浪幅度让瓶身更有动感，找到最满意的造型。', 4),
        (v_project_id, '螺旋花瓶模式打印', '在切片软件中启用"花瓶模式"（螺旋外壁），一层连续打印出光滑无缝的花瓶。', 5);

    -- Project 12: 建筑模型设计
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('建筑模型设计', '选择一座喜欢的建筑物，按照一定比例缩小设计并3D打印出精美的建筑模型。参与者将学习比例尺的概念和建筑结构的基本知识，提升空间想象力。', v_author_id, v_sub_id, 3, 80, 'approved', '/projects/tech_3dprint.webp', ARRAY['建筑','比例','技术','3D打印'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '3D建模软件', 1),
        (v_project_id, '3D打印机', 2),
        (v_project_id, 'PLA线材（白色或灰色）', 3),
        (v_project_id, '建筑参考图片或照片', 4),
        (v_project_id, '丙烯颜料（上色用）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '选择建筑与确定比例', '选择一座感兴趣的建筑（如学校、塔楼），查找其实际尺寸，确定缩放比例使模型总高约100-150毫米。', 1),
        (v_project_id, '建模主体结构', '按照比例在建模软件中搭建建筑的主体框架——墙壁、楼层、屋顶，注意保持各部分比例协调。', 2),
        (v_project_id, '添加建筑细节', '添加门窗、阳台、台阶等细节元素，用布尔运算在墙壁上开出窗洞和门洞。', 3),
        (v_project_id, '分件设计', '如果建筑模型较大或有悬空结构，将其拆分为多个可独立打印的部件，设计好拼接接口。', 4),
        (v_project_id, '打印与拼装', '分别打印各部件，用胶水拼装组合，必要时用丙烯颜料为建筑模型上色。', 5),
        (v_project_id, '展示与介绍', '将完成的建筑模型放在展示底座上，向家人朋友介绍这座建筑的特点和你的设计过程。', 6);

    -- Project 13: 3D打印机械手指
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('3D打印机械手指', '设计并打印一个带有铰链关节的机械手指，拉动线绳就能像真手指一样弯曲。参与者将学习铰链结构和活动件的设计方法，理解人体手指关节的运动原理。', v_author_id, v_sub_id, 4, 90, 'approved', '/projects/tech_3dprint.webp', ARRAY['铰链','活动件','技术','3D打印'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '3D建模软件（推荐Fusion 360）', 1),
        (v_project_id, '3D打印机', 2),
        (v_project_id, 'PLA线材', 3),
        (v_project_id, '细绳或钓鱼线', 4),
        (v_project_id, '橡皮筋', 5),
        (v_project_id, '小螺丝和螺母（M2规格）', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '研究手指结构', '观察自己的手指弯曲动作，了解手指有三个指节和两个关节，肌腱通过拉伸控制弯曲和伸展。', 1),
        (v_project_id, '设计指节与铰链', '建模三个指节部件，在相邻指节连接处设计铰链结构——一侧为销孔，另一侧为销轴，可绕轴转动。', 2),
        (v_project_id, '设计线绳通道', '在每个指节内部留出一条线绳通道，从指尖贯穿到手指底部，供控制线绳穿过。', 3),
        (v_project_id, '打印与组装', '打印所有指节，用小螺丝将铰链连接起来，穿入线绳，在手指背面粘贴橡皮筋提供回弹力。', 4),
        (v_project_id, '测试与调试', '拉动线绳观察手指弯曲效果，松开后橡皮筋将手指拉回伸直状态，调整线绳长度和橡皮筋张力。', 5),
        (v_project_id, '扩展：机械手', '尝试制作五根机械手指并安装在手掌底座上，用五根线绳分别控制每根手指，制成完整的机械手。', 6);

    -- Project 14: 可活动关节模型
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('可活动关节模型', '设计一个多关节的可动人偶或机器人模型，每个关节都能自由转动摆出各种姿势。参与者将学习旋转关节和球形关节的设计方法，掌握多零件装配的技巧。', v_author_id, v_sub_id, 4, 100, 'approved', '/projects/tech_3dprint.webp', ARRAY['关节','装配','技术','3D打印'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '3D建模软件', 1),
        (v_project_id, '3D打印机', 2),
        (v_project_id, 'PLA线材（多色）', 3),
        (v_project_id, '弹性线材（TPU，用于关节）', 4),
        (v_project_id, '游标卡尺', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计关节类型', '学习两种常见可动关节：球形关节（球窝结构，可全方向转动）和铰链关节（单轴转动），分别绘制草图。', 1),
        (v_project_id, '建模身体部件', '设计人偶的头部、躯干、上臂、前臂、大腿、小腿等各个部件，在连接处预留关节接口。', 2),
        (v_project_id, '设计关节结构', '肩膀和髋部使用球形关节实现多方向活动，肘部和膝盖使用铰链关节实现单向弯曲。', 3),
        (v_project_id, '公差测试', '先打印一组测试关节，检查球头和球窝的配合松紧度，调整间隙至转动顺畅但能保持姿势。', 4),
        (v_project_id, '打印与装配', '打印所有部件，按照从躯干到四肢的顺序逐一装配关节，确保每个关节活动自如。', 5),
        (v_project_id, '摆姿势展示', '为你的可动人偶摆出各种有趣的姿势并拍照，体验从零设计一个玩具的乐趣。', 6);

    -- Project 15: 3D打印桥梁结构
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('3D打印桥梁结构', '设计并打印不同结构类型的桥梁模型，通过加载测试比较哪种结构最坚固。参与者将学习桁架、拱形等经典结构的力学原理，理解结构设计如何用最少材料承受最大荷载。', v_author_id, v_sub_id, 4, 90, 'approved', '/projects/tech_3dprint.webp', ARRAY['结构','力学','技术','3D打印'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '3D建模软件', 1),
        (v_project_id, '3D打印机', 2),
        (v_project_id, 'PLA线材', 3),
        (v_project_id, '重物（硬币或砝码，用于加载测试）', 4),
        (v_project_id, '电子秤', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '学习桥梁结构', '了解三种经典桥梁结构：简支梁桥（平板）、拱桥（弧形）、桁架桥（三角形网格），画出各自的截面草图。', 1),
        (v_project_id, '统一设计规范', '所有桥梁模型使用相同的跨度（150毫米）和材料用量，以便公平比较承载能力。', 2),
        (v_project_id, '建模三种桥梁', '分别设计简支梁桥、拱桥和桁架桥的3D模型，桁架桥使用三角形单元构成网格结构。', 3),
        (v_project_id, '打印桥梁', '用相同的打印参数（填充率、层高）打印三座桥梁模型，确保材料消耗量接近。', 4),
        (v_project_id, '承载测试', '将桥梁架在两个支撑物之间，在桥面中央逐步增加重物，记录每座桥梁断裂时的最大承载重量。', 5),
        (v_project_id, '分析与总结', '比较三种结构的承载能力，分析为什么三角形桁架结构最稳固——三角形不易变形，力沿杆件轴向传递。', 6);

    -- Project 16: 镂空灯罩设计
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('镂空灯罩设计', '设计一个带有精美镂空图案的灯罩，安装LED灯后能投射出美丽的光影效果。参与者将学习镂空建模技巧和图案设计方法，感受光与影的艺术魅力。', v_author_id, v_sub_id, 4, 85, 'approved', '/projects/tech_3dprint.webp', ARRAY['镂空','光影','技术','3D打印'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '3D建模软件', 1),
        (v_project_id, '3D打印机', 2),
        (v_project_id, 'PLA线材（白色或浅色效果最佳）', 3),
        (v_project_id, 'LED小灯泡或灯串', 4),
        (v_project_id, '电池盒', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '设计灯罩外形', '选择灯罩的基本形状——球形、圆柱形或多面体，建模空心薄壁结构，壁厚约1.5毫米。', 1),
        (v_project_id, '绘制镂空图案', '在灯罩壁面上设计镂空图案，可以是几何纹样、星星月亮或自然花纹，图案开口不要太小以确保可打印性。', 2),
        (v_project_id, '布尔运算镂空', '将设计好的图案形状从灯罩壁面上减去，形成贯穿的镂空效果，检查是否有断裂的薄弱处。', 3),
        (v_project_id, '预留灯口', '在灯罩底部留出放入LED灯的开口和固定结构，确保灯泡不会接触到打印件造成过热。', 4),
        (v_project_id, '打印与组装', '打印灯罩，安装LED灯泡，在暗室中点亮，欣赏镂空图案在墙壁和天花板上投射出的美丽光影。', 5);

    -- Project 17: 行星齿轮组
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('行星齿轮组', '设计并打印一套完整的行星齿轮机构——包括太阳轮、行星轮、行星架和齿圈。参与者将深入学习行星齿轮系的传动原理，理解自动变速箱中这一核心机构的工作方式。', v_author_id, v_sub_id, 5, 120, 'approved', '/projects/tech_3dprint.webp', ARRAY['齿轮系','传动','技术','3D打印'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '参数化建模软件（Fusion 360或OpenSCAD）', 1),
        (v_project_id, '3D打印机（精度要求高）', 2),
        (v_project_id, 'PLA线材（至少三种颜色）', 3),
        (v_project_id, '润滑油', 4),
        (v_project_id, '游标卡尺', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '学习行星齿轮原理', '了解行星齿轮系的组成：中心的太阳轮、围绕太阳轮转动的行星轮、承载行星轮的行星架、外圈的齿圈，以及齿数关系。', 1),
        (v_project_id, '计算齿轮参数', '确定模数为1，太阳轮16齿，行星轮8齿，齿圈32齿（满足齿圈齿数=太阳轮齿数+2×行星轮齿数），设计3个均布的行星轮。', 2),
        (v_project_id, '建模各齿轮', '分别建模太阳轮、行星轮、齿圈（内齿轮）和行星架，每个齿轮中心留出轴孔。', 3),
        (v_project_id, '虚拟装配验证', '在软件中将所有零件组装到位，检查齿轮啮合是否正确，旋转仿真验证传动关系。', 4),
        (v_project_id, '高精度打印', '以0.1毫米层高打印所有零件，用不同颜色区分各部件，打印后仔细去除毛刺。', 5),
        (v_project_id, '组装与演示', '涂抹少量润滑油，组装整个行星齿轮系，固定齿圈转动太阳轮，观察行星架的减速输出效果。', 6);

    -- Project 18: 可折叠结构设计
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('可折叠结构设计', '设计一个能够从平面展开为立体结构的折叠机构，如折叠杯、折叠盒或折叠手机架。参与者将学习折叠铰链和活动连杆的设计方法，探索折纸数学在工程中的应用。', v_author_id, v_sub_id, 5, 110, 'approved', '/projects/tech_3dprint.webp', ARRAY['折叠','铰链','技术','3D打印'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '3D建模软件', 1),
        (v_project_id, '3D打印机', 2),
        (v_project_id, 'PLA线材', 3),
        (v_project_id, 'TPU弹性线材（用于活动铰链）', 4),
        (v_project_id, '纸板和胶带（做折叠原型）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '纸板原型验证', '先用纸板制作折叠结构的简易模型，验证折叠和展开的动作是否顺畅，确定铰链位置和折叠方向。', 1),
        (v_project_id, '设计铰链机构', '在建模软件中设计活动铰链——可以采用一体打印的柔性铰链（薄壁弯折处）或分件销轴铰链。', 2),
        (v_project_id, '建模折叠面板', '设计各个折叠面板的形状和尺寸，在面板连接处添加铰链结构，确保折叠后能紧密贴合。', 3),
        (v_project_id, '设计锁定机构', '添加卡扣或磁吸结构，使结构在展开状态下能固定住不会自行折叠。', 4),
        (v_project_id, '打印与测试', '打印所有部件并组装，反复折叠和展开测试耐久性，检查铰链是否有疲劳断裂的风险。', 5),
        (v_project_id, '优化迭代', '根据测试结果调整铰链厚度、间隙和锁定力度，打印改进版本直到满意。', 6);

    -- Project 19: 3D打印乐器
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('3D打印乐器', '设计并打印一个能发出真实音调的简易乐器，如口哨、排箫或小号嘴。参与者将学习声学共鸣的原理，理解乐器的腔体形状和大小如何决定音高和音色。', v_author_id, v_sub_id, 5, 100, 'approved', '/projects/tech_3dprint.webp', ARRAY['声学','共鸣','技术','3D打印'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '3D建模软件', 1),
        (v_project_id, '3D打印机', 2),
        (v_project_id, 'PLA线材', 3),
        (v_project_id, '手机调音器应用（检测音高）', 4),
        (v_project_id, '砂纸（打磨吹口）', 5);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '学习声学原理', '了解乐器发声原理——空气在管腔中振动产生声音，管腔越长音调越低，管腔越短音调越高。', 1),
        (v_project_id, '设计排箫管', '建模一组不同长度的空心管（从60毫米到120毫米），内径统一为10毫米，壁厚1.5毫米，一端封闭一端开放。', 2),
        (v_project_id, '计算音调', '根据管长计算每根管的理论音高（频率 = 声速 ÷ (4 × 管长)），对应到音阶上的do、re、mi等音符。', 3),
        (v_project_id, '打印与打磨', '打印所有管子，仔细打磨开口端使边缘光滑，以获得更清晰的吹奏效果。', 4),
        (v_project_id, '调音测试', '逐根吹奏并用手机调音器检测实际音高，与理论值对比，微调管长直到音准正确。', 5),
        (v_project_id, '组装与演奏', '将所有管子按音高顺序排列并固定在支架上，组装成完整的排箫，学习吹奏简单旋律。', 6);

    -- Project 20: 仿生结构设计
    INSERT INTO public.projects (title, description, author_id, sub_category_id, difficulty_stars, duration, status, image_url, tags, category)
    VALUES ('仿生结构设计', '从自然界中获取灵感，模仿蜂巢、骨骼或贝壳等天然结构设计轻量高强度的3D打印零件。参与者将学习仿生学的核心思想，理解自然界经过亿万年进化出的结构为何如此高效。', v_author_id, v_sub_id, 5, 120, 'approved', '/projects/tech_3dprint.webp', ARRAY['仿生学','优化','技术','3D打印'], '技术')
    RETURNING id INTO v_project_id;

    INSERT INTO public.project_materials (project_id, material, sort_order) VALUES
        (v_project_id, '3D建模软件（推荐Fusion 360或nTopology）', 1),
        (v_project_id, '3D打印机', 2),
        (v_project_id, 'PLA线材', 3),
        (v_project_id, '重物和电子秤（承载测试）', 4),
        (v_project_id, '自然界结构参考图片', 5),
        (v_project_id, '游标卡尺', 6);

    INSERT INTO public.project_steps (project_id, title, description, sort_order) VALUES
        (v_project_id, '研究自然结构', '观察并研究蜂巢的六边形结构、骨骼的中空多孔结构、贝壳的层状结构，了解它们为什么既轻又强。', 1),
        (v_project_id, '选择仿生对象', '选择一种自然结构作为灵感来源（如蜂巢六边形），分析其几何规律和受力特点。', 2),
        (v_project_id, '建模仿生结构', '在建模软件中用六边形蜂窝网格填充一个板状零件的内部，调整蜂窝壁厚和单元大小。', 3),
        (v_project_id, '设计对照组', '同时设计一个相同外形但使用普通实心填充（如直线网格）的对照零件，确保两者材料用量相同。', 4),
        (v_project_id, '打印与测试', '打印仿生结构和对照组零件，分别进行承载测试，记录断裂时的最大荷载并计算强度重量比。', 5),
        (v_project_id, '总结与展望', '比较数据证明仿生结构的优越性，讨论仿生学在航空航天、建筑等领域的实际应用前景。', 6);

END $$;
