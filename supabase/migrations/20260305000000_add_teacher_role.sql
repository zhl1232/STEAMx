-- 添加 teacher（认证导师）角色
-- 用于支持 PBL（项目式学习）体验中的专家评审和官方认证

-- 1. 删除现有的 role_check 约束
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS role_check;

-- 2. 添加新的约束，允许 teacher 角色
ALTER TABLE public.profiles ADD CONSTRAINT role_check
  CHECK (role IN ('user', 'teacher', 'moderator', 'admin'));
