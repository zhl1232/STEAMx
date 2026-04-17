-- 阳台小菜园需要持续播种、养护、记录到收获，复杂度更接近 3 星进阶项目
UPDATE public.projects
   SET difficulty_stars = 3
 WHERE title = '阳台小菜园'
   AND difficulty_stars = 2;
