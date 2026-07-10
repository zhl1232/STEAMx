-- 内测期间：为所有已有账号补发「测试先锋」徽章。
-- 新用户由客户端 checkBadges（GRANT_BETA_TESTER_BADGE）在登录后自动发放。
-- 结束后将 lib/gamification/badges.ts 中 GRANT_BETA_TESTER_BADGE 改为 false 即可停发新人。

INSERT INTO public.user_badges (user_id, badge_id, unlocked_at)
SELECT p.id, 'beta_tester', now()
FROM public.profiles p
WHERE EXISTS (
  SELECT 1 FROM public.badges b WHERE b.id = 'beta_tester'
)
AND NOT EXISTS (
  SELECT 1
  FROM public.user_badges ub
  WHERE ub.user_id = p.id
    AND ub.badge_id = 'beta_tester'
)
ON CONFLICT (user_id, badge_id) DO NOTHING;
