# 内容门禁与互动资格实现说明

> 状态：第一版已实现，社区互动确认前端闭环和互动写入收口已补齐。私信改为登录即可发送并保留独立安全控制。最后更新：2026-08-06。

## 1. 实现范围

本次只实现以注册转化为目标的轻量门禁：

1. 移除短信登录自动社区互动确认。
2. 增加社区互动确认 API 和设置页入口。
3. 增加统一的 `requireInteractionAccess()` 服务端能力检查。
4. 保护主要保存、投稿、评论、评分、私信和 `engage` 互动写接口；私信不再依赖社区互动确认，但仍经过账号限制、屏蔽、隐私、频率限制和内容审核。
5. 关闭浏览器任意 XP 增量，改成服务端固定事件奖励。
6. 删除文档中的 T0-T4 Trust 等级设计，保留 XP、会员、角色三条独立轴。

本次不做课程/项目/挑战正文拆分、不做会员旁路、不做 T0-T4 评估器，也不改变公开内容读取口径。

## 2. 代码边界

| 文件 | 职责 |
|---|---|
| `lib/access/interaction-access.ts` | 查询当前账号状态，导出 `getInteractionAccess()` 和 `requireInteractionAccess()` |
| `app/api/projects/[id]/collection/route.ts` | 服务端切换项目收藏/取消收藏，统一执行 `engage` 门禁 |
| `app/api/settings/age-confirmation/route.ts` | 读取和提交社区互动确认 |
| `app/settings/security/page.tsx` | 提供社区互动确认操作和状态反馈 |
| `lib/context/login-prompt-context.tsx` | 处理 `AGE_CONFIRMATION_REQUIRED` 的当前页弹窗确认、原请求暂存、确认后重试与返回；设置页可提前完成确认 |
| `lib/utils/http.ts` | 解析稳定的 API 错误 `code/details`，校验社区互动确认跳转地址 |
| `lib/api/server-awards.ts` | 仅服务端调用固定 XP 奖励 RPC |
| `supabase/migrations/20260801090000_interaction_access_and_secure_xp.sql` | 字段、确认 RPC 和 XP 原子奖励 RPC |
| `supabase/migrations/20260803120000_harden_interaction_access_and_xp.sql` | 撤销旧 XP RPC 和客户端 XP 日志写入，通过数据库触发器收口直接互动写入，恢复评论每日上限并刷新 PostgREST schema |
| `lib/api/auth.ts` | 为 403 权限错误输出稳定 `code/details` |

## 3. 判定规则

`requireInteractionAccess(supabase, user, capability)` 支持：

- `save_progress`：登录即可，受 `interaction_restricted` 限制；
- `engage`：登录即可，受 `interaction_restricted` 限制；覆盖项目/作品/自然观察点赞、收藏、关注和打赏；
- `submit`：要求社区互动确认；
- `comment`：要求社区互动确认；
- `post`：要求社区互动确认；
- `message`：登录即可，受账号限制、屏蔽、接收方隐私、频率限制和内容审核约束。

判定顺序是：无用户 → `AUTH_REQUIRED`；账号被限制 → `INTERACTION_RESTRICTED`；能力需要确认且没有 `age_confirmed_at` → `AGE_CONFIRMATION_REQUIRED`；否则放行。读取互动状态的 GET 接口不调用写入门禁。

普通 profile PATCH 不接受年龄或限制字段。数据库触发器会保护这两个字段，社区互动确认只能通过 `confirm_my_age()`，限制状态由 service/admin 流程写入。

## 4. 社区互动确认接口

### `GET /api/settings/age-confirmation`

返回：

```json
{
  "confirmed": true,
  "confirmedAt": "2026-08-01T00:00:00.000Z"
}
```

### `POST /api/settings/age-confirmation`

不接受年龄、出生日期或用户 ID 参数，使用当前登录用户调用 `confirm_my_age()`，重复调用保持幂等。

## 5. XP 奖励

`POST /api/xp/increment` 不再读取请求体，返回 410 和 `XP_EVENT_REQUIRED`。`GamificationContext.addXp()` 仅保留兼容形状，用于刷新 profile，不向数据库写入客户端提供的金额。

`award_xp_once()` 只允许 service role，固定动作和金额如下：

| action | XP |
|---|---:|
| `publish_project` | 50 |
| `comment_project` | 1 |
| `like_project` | 1 |
| `join_challenge` | 10 |
| `submit_observation` | 10 |
| `complete_challenge` | 20 |
| `challenge_participation` | 20 |
| `complete_project` / `publish_course_work` | 20 |
| `weekly_goal_comments_5` | 5 |

调用必须传服务端生成的业务资源 ID。函数先插入唯一 XP 流水，只有实际插入时才增加 profile XP。

`comment_project` 每个用户按 Asia/Shanghai 自然日最多计入 50 XP；函数先锁定用户 profile 再检查当日流水，避免并发评论绕过上限。项目评论接口在写入成功后由服务端发放评论 XP，并根据可信 XP 流水检查本周第 5 条评论奖励；前端保留的 `addXp()` 只负责刷新资料，不再提交奖励金额或事件。

## 6. 前端社区互动确认闭环

主要写入入口在收到 `AGE_CONFIRMATION_REQUIRED` 后，会通过 `runAfterAgeConfirmation()` 暂存原始请求并打开社区互动确认弹窗。弹窗确认成功后重发请求；设置页仍支持提前完成确认，重发仍被门禁拦截时不会覆盖新的待处理请求。

已接入项目创建/评论/作品提交、课程作品上传、自然观察提交/评论/鉴定、挑战作品提交/评分和作品评论的社区互动确认；私信发送仍走统一账号限制入口，但不再弹出确认。项目点赞、评论点赞、作品点赞、关注、自然观察点赞、打赏和挑战终稿草稿生成也已按 `engage` 或 `save_progress` 收口。项目收藏统一由 `POST /api/projects/[id]/collection` 切换，`lib/context/project-context.tsx` 不再直接写 `collections`。保存课程/PBL 进度仍按登录即可的规则处理。

## 7. 数据库迁移注意事项

- 迁移会将旧的 `profiles.age_confirmed_at` 清空，因为旧值来自注册/短信流程，不能证明社区互动确认。
- 最新 `handle_new_user()` 不再写社区互动确认时间。
- `protect_profiles_sensitive_fields()` 会阻止普通客户端修改 `age_confirmed_at` 和 `interaction_restricted`。
- `20260803120000_harden_interaction_access_and_xp.sql` 会撤销 `increment_user_xp()`、`increment_client_xp()` 的公开执行权，禁止客户端写入 `xp_logs`，并在项目/评论/投稿/观察/消息/互动/进度表上增加数据库触发器；迁移末尾发送 `NOTIFY pgrst, 'reload schema'`。后续 `20260806100000_allow_messages_before_confirmation.sql` 让消息触发器继续检查账号安全状态，但不再把 `age_confirmed_at` 作为消息前置条件。
- 推送迁移使用 `pnpm db:push`，不要直接运行 `supabase db push`。

## 8. 验收

- 匿名可以浏览公开内容；注册用户可保存进度。
- 未完成确认用户执行投稿、评论、发帖得到 `AGE_CONFIRMATION_REQUIRED`；私信在接收方允许且发送者账号未受限时可以发送。
- 完成社区互动确认后上述公开互动接口放行。
- restricted 用户所有保存/互动写接口得到 `INTERACTION_RESTRICTED`。
- restricted 用户读取项目/观察点赞状态仍可正常工作；对应 POST/DELETE 写操作得到 `INTERACTION_RESTRICTED`。
- 直接调用 `/api/xp/increment` 不能增加 XP。
- 即使绕过 Next.js API 直接调用 PostgREST，未满足账号状态的写入也会被数据库触发器拒绝，客户端不能直接伪造 XP 日志或调用旧 XP RPC。
- `pnpm type-check`、受影响 Vitest 和全量测试通过后再推送主分支。
