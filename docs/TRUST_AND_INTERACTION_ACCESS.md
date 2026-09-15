# 内容门禁与互动资格：规则与当前实现

> 第一版已实现。产品不再使用 T0–T4 Trust 等级；私信登录即可发送，但受独立安全规则约束。最后更新：2026-08-06。

## 目标与独立轴

公开内容保持可浏览，注册带来保存进度、收藏和关注等价值；在投稿、评论、发帖等公开写入前完成一次社区互动确认。互动资格、XP、会员和角色彼此独立，界面只展示当前动作是否可用。

短信验证码只证明手机号控制权，不代表社区互动确认。`birth_date` 只用于年龄段推荐。历史注册自动写入的确认值由迁移清空，需重新确认。

## 状态与能力矩阵

| 能力 | 匿名 | 已注册 | 已确认 | restricted |
|---|---:|---:|---:|---:|
| 浏览公开内容 | 是 | 是 | 是 | 是 |
| 保存进度、继续学习 | 否 | 是 | 是 | 否 |
| 收藏、关注、点赞、打赏 | 否 | 是 | 是 | 否 |
| 投稿、上传观察、发布作品 | 否 | 否 | 是 | 否 |
| 评论、回复、鉴定、评分、发帖 | 否 | 否 | 是 | 否 |
| 发起或回复私信 | 否 | 是 | 是 | 否 |

`restricted` 是独立的 `profiles.interaction_restricted` 状态，禁止保存进度和互动写入，但保留公开阅读及管理本人已有内容。普通用户不能修改它或 `age_confirmed_at`。

## 服务端判定与错误契约

所有写入口使用 `requireInteractionAccess(supabase, user, capability)`；支持 `save_progress`、`engage`、`submit`、`comment`、`post`、`message`。判定顺序：无用户返回 `AUTH_REQUIRED`；账号受限返回 `INTERACTION_RESTRICTED`；需要确认但未确认返回 `AGE_CONFIRMATION_REQUIRED`；否则放行。读取状态的 GET 不调用写入门禁。

门禁错误为 HTTP 403，并带稳定 `code/details`。收到 `AGE_CONFIRMATION_REQUIRED` 时，前端暂存原始请求并打开社区互动确认弹窗，确认后重发；也可在“设置 → 账号与安全”提前完成确认。错误码保留历史命名以兼容 API。

## 社区互动确认 API

### `GET /api/settings/age-confirmation`

返回 `{ "confirmed": true, "confirmedAt": "2026-08-01T00:00:00.000Z" }`。

### `POST /api/settings/age-confirmation`

不接受年龄、出生日期或用户 ID；使用当前登录用户调用 `confirm_my_age()`，重复调用幂等。

## 当前实现边界

主要写入入口已覆盖项目创建、课程/挑战作品提交、自然观察提交、项目/作品/观察评论与鉴定、挑战评分、`engage` 互动及课程/PBL 进度。私信仍检查账号限制、屏蔽、接收方隐私、频率和内容审核，但不要求社区互动确认。

| 文件 | 职责 |
|---|---|
| `lib/access/interaction-access.ts` | `getInteractionAccess()` / `requireInteractionAccess()` |
| `app/api/settings/age-confirmation/route.ts` | 确认状态读写 |
| `app/settings/security/page.tsx` | 设置页确认入口 |
| `lib/context/login-prompt-context.tsx` | 弹窗、暂存与重试 |
| `lib/api/auth.ts`、`lib/utils/http.ts` | 稳定 API 错误与跳转解析 |
| `lib/api/server-awards.ts` | 服务端固定 XP 奖励 |

## XP 规则

`POST /api/xp/increment` 已废弃并返回 `XP_EVENT_REQUIRED`。浏览器不能提交任意金额；业务服务通过仅 service role 可调用的 `award_xp_once(user, action, resource)` RPC 发放固定奖励。函数在同一事务中写入 `xp_logs`、更新 `profiles.xp`，按用户、动作和业务资源幂等；奖励失败不改变投稿或评论结果，但记录服务端错误。

## 数据库与迁移

`protect_profiles_sensitive_fields()` 保护 `age_confirmed_at` 与 `interaction_restricted`；社区确认只能调用 `confirm_my_age()`。迁移会撤销旧客户端 XP RPC、禁止客户端写 `xp_logs`，并通过数据库触发器收口直接互动写入。迁移执行按项目约定使用 `pnpm db:push`，不要直接使用 Supabase CLI。

## 后续边界

如需锁定课程正文或高级挑战，另行设计公开摘要、正文鉴权、附件私有化和缓存隔离；不能只增加等级字段后继续 `select *`。任何新能力都要同时更新服务端门禁、RLS 和错误契约。
