-- 移除三条测试/试点 PBL 挑战及其关联数据（参与者、提交、阶段产出、导师对话等随 FK CASCADE 删除）。
-- 关联项目的 challenge_id 会 SET NULL，项目本身保留。

DELETE FROM public.challenges
 WHERE title IN (
   '校园遮阳休息站挑战',
   '北京春季常见鸟类观察',
   '14天蚂蚁观察挑战'
 );
