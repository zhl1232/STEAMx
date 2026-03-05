# Supabase 安全告警清单：function_search_path_mutable

基于 Supabase Performance Security Lints 导出（Function Search Path Mutable），对所有被标记的 `public` schema 函数按风险分级，并统一通过迁移脚本修复。

## 风险分级说明

- **高**：权限/提权相关，或直接涉及资产（硬币、积分、购买、打赏）；被滥用可导致越权或资产异常。
- **中**：触发器、计数/统计类 RPC、排行榜读取；多为内部或只读，风险较低但仍需固定 search_path。
- **低**：纯展示/报表类 RPC；建议修复以消除告警并统一规范。

## 函数清单

| 函数名 | 风险 | 说明 |
|--------|------|------|
| `is_admin` | 高 | 权限判断，用于 RLS/策略 |
| `is_moderator_or_admin` | 高 | 权限判断，用于 RLS/策略 |
| `approve_project` | 高 | 审核员/管理员操作项目状态 |
| `reject_project` | 高 | 审核员/管理员拒绝项目 |
| `log_moderator_action` | 高 | 记录审核行为，权限相关 |
| `has_pending_moderator_application` | 高 | 审核申请状态，与权限流程相关 |
| `protect_projects_sensitive_fields` | 高 | 触发器，保护 likes_count/views_count 等 |
| `protect_profiles_sensitive_fields` | 高 | 触发器，保护 profile 敏感字段 |
| `purchase_item` | 高 | 购买商品，扣硬币 |
| `tip_resource` | 高 | 打赏资源，涉及硬币流转 |
| `get_shop_item_price` | 中 | 只读价格，但属资产相关 |
| `get_my_tip_for_resource` | 中 | 查询当前用户对某资源的打赏额 |
| `get_tip_received_for_resource` | 中 | 查询某资源收到的打赏 |
| `get_project_total_coins_received` | 中 | 项目总收币，只读 |
| `get_projects_total_coins_received_batch` | 中 | 批量项目总收币，只读 |
| `increment_client_xp` | 高 | 增加用户 XP，可被滥用刷分 |
| `daily_check_in` | 高 | 签到发硬币/积分 |
| `equip_avatar_frame` | 中 | 装备头像框，消耗/装备类 |
| `equip_name_color` | 中 | 装备名字颜色，消耗/装备类 |
| `increment_project_likes` | 中 | 点赞计数，由触发器/ RPC 调用 |
| `decrement_project_likes` | 中 | 取消点赞计数 |
| `increment_challenge_participants` | 中 | 挑战参与人数 +1 |
| `decrement_challenge_participants` | 中 | 挑战参与人数 -1 |
| `increment_discussion_replies_count` | 中 | 讨论回复数 +1（触发器） |
| `decrement_discussion_replies_count` | 中 | 讨论回复数 -1（触发器） |
| `handle_new_completion_like` | 中 | 完成作品点赞触发器 |
| `handle_remove_completion_like` | 中 | 完成作品取消点赞触发器 |
| `handle_new_completion_comment` | 中 | 完成作品评论数触发器 |
| `handle_remove_completion_comment` | 中 | 完成作品评论数触发器 |
| `handle_new_user` | 中 | 新用户注册触发器 |
| `update_projects_search_vector` | 中 | 项目搜索向量触发器 |
| `get_user_stats_summary` | 低 | 用户统计汇总 RPC |
| `get_user_login_stats` | 低 | 登录统计 |
| `get_badge_leaderboard` | 低 | 徽章排行榜 |
| `get_project_leaderboard` | 低 | 项目排行榜 |
| `get_leaderboard_xp_weekly` | 低 | 本周 XP 排行榜 |
| `get_leaderboard_xp_monthly` | 低 | 本月 XP 排行榜 |
| `refresh_leaderboard_mvs` | 低 | 刷新排行榜物化视图 |
| `get_projects_comments_count_batch` | 低 | 批量评论数，只读 |

## 修复方式

- 所有上述函数若为 `SECURITY DEFINER`，均在迁移中执行：  
  `ALTER FUNCTION public.<name>(<args>) SET search_path = public;`
- 新增迁移脚本：`supabase/migrations/20260305100000_fix_function_search_path.sql`  
  该脚本动态遍历 `public` 下所有 `SECURITY DEFINER` 函数并统一设置 `search_path = public`，避免遗漏与重复维护。

## 验证

- 部署迁移后，在 Supabase Dashboard → Database → Linter / Insights 中刷新，确认 “Function Search Path Mutable” 告警数量下降或归零。
- 对关键流程做一次回归：登录、签到、打赏、购买、审核操作、点赞、评论数/回复数展示。
