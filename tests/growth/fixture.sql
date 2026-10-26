ALTER TABLE public.completion_comments ADD COLUMN moderation_state text DEFAULT 'approved', ADD COLUMN parent_id bigint REFERENCES public.completion_comments(id) ON DELETE SET NULL, ADD COLUMN reply_to_user_id uuid;
INSERT INTO profiles(id,role,xp) VALUES ('00000000-0000-0000-0000-000000000001','admin',0),('00000000-0000-0000-0000-000000000002','user',1000),('00000000-0000-0000-0000-000000000003','user',0),('00000000-0000-0000-0000-000000000004','user',0),('00000000-0000-0000-0000-000000000005','user',0);
INSERT INTO completed_projects(id,user_id,project_id,status,moderation_state) VALUES(1,'00000000-0000-0000-0000-000000000002',1,'approved','approved');
INSERT INTO completion_likes(user_id,completed_project_id) VALUES('00000000-0000-0000-0000-000000000003',1);
INSERT INTO completion_comments(id,completed_project_id,author_id,content) VALUES(1,1,'00000000-0000-0000-0000-000000000003','old comment');
