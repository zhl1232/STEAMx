# 内容门禁与互动资格：规则与当前实现

> 已移除额外的社区互动确认。注册协议同意、账号限制与各业务安全规则继续保留。最后更新：2026-09-20。

## 目标与独立轴

公开内容保持可浏览；登录后可保存进度、发布作品和参与互动，无需再次确认注册时已同意的《服务条款》和《隐私政策》。发布页已有的内容要求与审核提示继续保留。

互动资格、XP、会员和角色彼此独立。`birth_date` 用于年龄段推荐；历史 `age_confirmed_at` 不再决定能否发布或互动，也不代表身份、年龄或监护人验证。

## 状态与能力矩阵

| 能力 | 匿名 | 已注册 | restricted |
|---|---:|---:|---:|
| 浏览公开内容 | 是 | 是 | 是 |
| 保存进度、继续学习 | 否 | 是 | 否 |
| 收藏、关注、点赞、打赏 | 否 | 是 | 否 |
| 投稿、上传观察、发布作品 | 否 | 是 | 否 |
| 评论、回复、鉴定、评分、发帖 | 否 | 是 | 否 |
| 发起或回复私信 | 否 | 是 | 否 |

以上仅描述统一互动资格；业务自身的权限、审核、屏蔽、频率和隐私检查仍然生效。受限账号禁止保存进度和互动写入，但保留公开阅读及业务允许的本人内容管理。

## 服务端判定与错误契约

写入口继续使用 `requireInteractionAccess(supabase, user, capability)`，支持 `save_progress`、`engage`、`submit`、`comment`、`post`、`message`。无用户或对应资料不存在时返回 `AUTH_REQUIRED`；账号受限返回 `INTERACTION_RESTRICTED`；已登录且未受限时不再检查确认时间。读取状态的 GET 不调用写入门禁。

不再返回 `AGE_CONFIRMATION_REQUIRED`，前端不再弹出确认窗口或为确认而重试请求。注册协议勾选和未登录操作的登录引导保留。设置页的社区互动确认入口及 `/api/settings/age-confirmation` API 已移除。

## 当前实现边界

项目创建、课程/挑战作品提交、自然观察提交、评论与鉴定、挑战评分、点赞/收藏/关注/打赏、课程/PBL 进度继续经过原有认证与安全检查。私信继续检查账号限制、屏蔽、接收方隐私、频率和内容审核。评论图片上传不再依赖历史确认字段。

| 文件 | 职责 |
|---|---|
| `lib/access/interaction-access.ts` | 统一登录与账号限制判定 |
| `app/settings/security/page.tsx` | 密码修改与首次手机号绑定 |
| `lib/context/login-prompt-context.tsx` | 未登录操作引导与登录后继续 |
| `lib/api/auth.ts`、`lib/utils/http.ts` | API 错误契约与解析 |
| `lib/api/server-awards.ts` | 服务端固定 XP 奖励 |

## XP 规则

`POST /api/xp/increment` 已废弃并返回 `XP_EVENT_REQUIRED`。浏览器不能提交任意金额；业务服务通过仅 service role 可调用的 `award_xp_once(user, action, resource)` RPC 发放固定奖励。点赞、旧项目评论及最终作品 +20 已退役；成长阶段、项目问答与作品交流采用[独立内容证据审核契约](COURSE_PROGRESS_REWARDS_AND_STEAM_IMPLEMENTATION.md)。其余固定奖励函数在同一事务中写入 `xp_logs`、更新 `profiles.xp`，按用户、动作和业务资源幂等；奖励失败不改变投稿或评论结果，但记录服务端错误。

## 数据库与迁移

新增迁移替换 `current_user_can_interact()`，仅移除 `age_confirmed_at` 前置条件，保留认证、能力白名单、账号限制、有效处罚和原函数执行权限。原有触发器与 RLS 不移除。

历史 `profiles.age_confirmed_at`、`confirm_my_age()` 和敏感字段保护保留兼容，不再作为互动门槛；不通过批量写入“已确认”伪造用户确认记录。历史迁移保持不变。

应用代码和数据库迁移需配套发布，否则旧数据库触发器仍可能拦截没有历史确认记录的账号。执行前确认目标环境和全部待执行迁移，使用 `pnpm db:push`，不要使用 `supabase db push`。`20260920180000_remove_interaction_confirmation_gate.sql` 已于 2026-09-20 通过相同迁移工具在仅包含本次 SQL 的临时目录中执行，远端函数定义、执行权限和迁移记录已核验；其余既有待执行迁移未执行。

## 后续边界

如需锁定课程正文或高级挑战，另行设计公开摘要、正文鉴权、附件私有化和缓存隔离；不能只增加等级字段后继续 `select *`。任何新能力都要同时更新服务端门禁、RLS 和错误契约。
