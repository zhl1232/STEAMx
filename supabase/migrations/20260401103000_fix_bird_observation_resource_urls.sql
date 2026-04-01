-- 鸟类观察静态资源页已移除，更新挑战 resources 中的外链
UPDATE public.challenges
SET resources = '[
  {"title":"鸟类观察频道","url":"/bird-observation","type":"guide"},
  {"title":"提交观察记录","url":"/bird-observation/submit","type":"template"}
]'::jsonb
WHERE resources::text LIKE '%/bird-observation/resources/%';
