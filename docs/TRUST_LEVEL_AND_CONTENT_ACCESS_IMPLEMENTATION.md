# 信任等级与内容访问控制开发设计

> 状态：待开发。最后复核：2026-07-30。
>
> 产品规则以 [`TRUST_LEVEL_AND_CONTENT_ACCESS.md`](./TRUST_LEVEL_AND_CONTENT_ACCESS.md) 为准。本文只定义代码、数据库、接口、迁移和验收方式；若两份文档冲突，先更新产品规则，再改实现设计。

## 1. 交付范围

本开发设计拆成六个可独立发布的工作包：

1. P0：关闭客户端任意 XP 奖励能力，统一 XP Lv. 计算。
2. 信任事实层：T0-T4 状态、活跃事件、违规限制、审计和评估器。
3. 内容策略层：课程、项目、挑战、资料的显式访问配置。
4. 内容读取层：公开摘要、受保护正文、附件鉴权和统一错误契约。
5. 社区操作层：T1 投稿/评论，T2 发帖/私信。
6. 历史回算、影子判定、灰度启用、监控和回滚。

这些工作包不要合成一个大迁移。P0 可以先独立上线；内容门禁只有在摘要/正文分层和附件保护完成后才能启用。

## 2. 已冻结的技术决策

- XP、Trust、Membership、Role 是四套独立状态，数据库字段和 TypeScript 类型不得复用。
- 匿名访客不是 T0；使用 `access_scope` 区分公开、登录可见和 Trust 门槛。
- `min_trust_level` 由管理员逐内容配置，不从 `difficulty_stars`、标签、XP 或会员推导。
- 课时在 v1 继承课程策略，不支持课时级覆盖。
- 有效会员只旁路允许旁路的已发布正文阅读，不旁路任何写操作或安全限制。
- T1-T3 自动评估，T4 只由管理员从 T3 人工授予。
- 前端锁态不是安全边界；Next API/RSC、SQL/RLS/RPC、Storage 和缓存必须给出一致结果。
- 最终授权不放在 `proxy.ts`。若以后需要页面级粗粒度跳转，只修改根级 `proxy.ts`，不得创建 `middleware.ts`。

## 3. 当前实现地图

| 关注点 | 当前入口 | 需要的改造 |
|---|---|---|
| 客户端 XP | `app/api/xp/increment/route.ts`、`lib/context/gamification-context.tsx`、`hooks/gamification/use-gamification-data.ts` | 删除任意金额入口和客户端流水写入，迁移所有 `addXp` 调用 |
| XP Lv. | `lib/context/gamification-context.tsx`、`components/layout/user-button.tsx`、`lib/ai/tutor/student-profile.ts`、项目/排行榜映射 | 收敛到一个纯函数；移除权限语义 |
| 认证/角色 | `lib/api/auth.ts` | 增加结构化访问错误；Role 检查仍独立保留 |
| 年龄确认 | `handle_new_user()`、`app/api/auth/sms/verify/route.ts` | 停止自动写“已确认”；建立带来源与审计的显式确认流程，旧值不直接满足 T1 |
| 会员 | `lib/membership.ts` | 复用 `isMembershipActive`，只输出阅读旁路事实 |
| 项目可见性 | `lib/api/project-access.ts`、`lib/api/explore-data.ts`、`app/project/[id]/page.tsx` | 从“approved 即公开”升级为摘要 + 正文访问判定 |
| 课程读取 | `lib/api/courses.ts`、`app/courses/**`、`app/api/courses/**` | catalog 只读摘要；课时正文走受保护入口 |
| 挑战读取 | `lib/api/pbl-challenges.ts`、`app/api/challenges/**`、`app/pbl/[id]/page.tsx` | 列表继续公开摘要，详情按权限返回 body |
| 资料读取 | `lib/api/learning-resources.ts`、`app/resources/[id]/page.tsx` | metadata 只用摘要，Markdown 正文单独鉴权 |
| Admin 配置 | `components/admin/course-management.tsx`、`challenge-management.tsx`、`resource-management.tsx`、项目审核/编辑页 | 复用同一访问策略字段组件 |
| 投稿/互动 | 课程 works、项目 completions、挑战 submission、observations、comments、completion comments、observation comments | 接入 T1 能力检查 |
| 发帖/私信 | `app/api/projects/route.ts`、`app/api/messages/send/route.ts`，以及仍在使用的 discussion 写入链路 | 接入 T2 能力检查；禁止客户端直写绕过 |

开发开始前必须再用 `rg` 盘点直接 `.from('courses'|'course_lessons'|'projects'|'challenges'|'learning_resources')`、所有 `addXp(`、`increment_user_xp` 和 `xp_logs` 写入。只改页面主路径不足以形成权限边界。

## 4. 建议代码边界

新增以下共享模块，避免在每个 Route Handler 中复制等级判断：

```text
lib/gamification/xp-level.ts
lib/gamification/server-awards.ts
lib/trust/types.ts
lib/trust/rules.ts
lib/trust/server.ts
lib/access/content-access.ts
lib/access/action-access.ts
components/features/access/content-lock.tsx
components/features/trust/trust-level-status.tsx
components/features/trust/age-confirmation-form.tsx
components/admin/content-access-fields.tsx
app/api/settings/age-confirmation/route.ts
```

职责如下：

- `xp-level.ts`：唯一导出 `getXpLevel(xp)` 和等级进度计算；纯函数、无数据库依赖。
- `server-awards.ts`：只在服务端导入，按白名单事件调用原子奖励 RPC；金额不接受浏览器输入。
- `trust/types.ts`：T0-T4、状态、指标快照、reason code 和 API DTO。
- `trust/rules.ts`：给定账号/活动/贡献/评论/违规指标，纯计算 T0-T3 和未满足条件。
- `trust/server.ts`：读取当前用户 Trust 摘要、触发评估、记录可信活动；禁止进入客户端 bundle。
- `content-access.ts`：包装数据库访问判定并返回统一 `ContentAccessDecision`。
- `action-access.ts`：`requireTrustCapability('submit'|'comment'|'post'|'message')`，不处理内容阅读。
- `content-lock.tsx`：只接收服务端 decision/summary 渲染锁态，不在浏览器重新授权。
- `content-access-fields.tsx`：Admin 使用的 `access_scope`、最低等级和会员旁路控件。

`lib/api/auth.ts` 中的 `PermissionError` 需要扩展为可携带 `code` 和安全的 `details`，`handleApiError` 统一转换 401/403；不要让各路由自行拼不同 JSON。

## 5. P0：XP 奖励治理

### 5.1 数据库与服务端

新增 `<timestamp>_secure_xp_awards.sql`：

- 新建 service-role-only 的原子函数，例如 `award_xp_once(p_user_id, p_action_type, p_resource_id, p_amount)`。
- 函数在一个事务中插入 `xp_logs` 并增加 `profiles.xp`；依赖现有 `(user_id, action_type, resource_id)` 唯一键幂等。
- 撤销 anon/authenticated 对所有通用 XP 增量函数和 `xp_logs` INSERT 的权限。
- 保留用户读取本人 XP/必要流水的权限；写入只允许受控 RPC、数据库业务函数或 service role。
- 审查旧的 `complete_evergreen_challenge`、签到、挑战结算等 SQL，确保流水冲突时不会仍然重复增加 `profiles.xp`。
- 把所有“先写 `xp_logs`，再调用 `increment_user_xp`”的服务端路径迁到同一个原子奖励底座；首批已知位置包括 `lib/api/observation-gamification.ts`、`lib/api/challenge-settlement.ts`、`app/api/profile/growth-tasks/claim/route.ts`、`app/api/admin/challenge-submissions/[id]/review/route.ts` 和 `lib/completions/approve.ts`。
- 逐个审查数据库内直接写 `xp_logs` 的签到、挑战、商店等函数：只有流水实际插入时才能改余额，任一步失败必须整体回滚。

应用层建立固定事件表，调用方只能传事件类型和业务资源 ID，金额由服务端映射。首轮至少迁移：

- `lib/context/challenge-context.tsx` 的参加挑战奖励。
- `lib/context/project-context.tsx` 的发布项目、评论、周目标和点赞奖励。
- `hooks/gamification/use-gamification-data.ts` 的 `updateXpMutation`。
- 其他 `rg -n "addXp\("` 找到的调用。

迁移后的客户端只负责在服务端业务成功后刷新 profile，不再请求“加多少 XP”。`POST /api/xp/increment` 在所有调用迁完后删除；过渡期若必须保留，应固定接收服务端可验证的事件名，绝不继续接收 `amount`。

### 5.2 XP Lv. 收敛

- 所有动态公式改用 `getXpLevel`。
- `profiles.level` 在完成调用迁移后停止作为读取来源；后续迁移可删除或只保留兼容同步，不作为授权字段。
- `components/features/gamification/level-guide-dialog.tsx` 中“评论发图、额外曝光、审核员申请、自治权”等权限文案迁移到 Trust 规则或删除；XP 页面只保留装扮、徽章、排行榜和经济权益。
- 评论图片门槛从 `app/api/comments/route.ts` 的 `profiles.level` 改为明确的 Trust 能力或独立内容安全规则。

## 6. 信任事实层

### 6.1 表结构

新增 `<timestamp>_trust_level_foundation.sql`，建议包含：

**`user_trust_state`**

| 字段 | 约束/说明 |
|---|---|
| `user_id uuid` | PK，FK `auth.users` cascade |
| `automatic_level smallint` | `0..3`，默认 0 |
| `manual_grant_level smallint null` | v1 只允许 4 |
| `level_cap smallint null` | 违规或人工限制的最高有效等级 |
| `effective_level smallint` | 由数据库函数在状态变更时计算，禁止客户端写 |
| `write_frozen_until timestamptz null` | 写操作冻结；永久冻结使用单独 restriction 状态，不使用无限日期 |
| `rule_version text` | 例如 `trust-v1` |
| `evaluated_at/created_at/updated_at` | 审计时间 |

**`trust_activity_events`**

- `id`、`user_id`、`event_kind`、`source_type`、`source_id`、`occurred_at`、`activity_date`。
- `activity_date` 按 `Asia/Shanghai` 生成或写入，唯一键使用 `(user_id, event_kind, source_type, source_id)`。
- anon/authenticated 无 INSERT/UPDATE/DELETE；仅服务端白名单事件写入。

**`trust_level_audit`**

- 记录 `from_level/to_level`、`event_type`、`reason`、`metrics_snapshot`、`rule_version`、`actor_id`、时间。
- 自动评估、T4 授予/撤销、等级 cap、冻结和到期恢复都必须写入。

**`trust_safety_cases` 与 `user_restrictions`**

- safety case 区分 `pending/confirmed/revoked`，保存严重度、确认人、确认时间和申诉结果。
- restriction 明确 `write_freeze/level_cap/read_block`、起止时间、状态和来源 case。
- 只有 confirmed case 或管理员直接限制可以影响有效权限；普通举报不能。

**年龄确认**

- `profiles.age_confirmed_at` 已存在但 provenance 不可信，Trust 不再读取它。新增 `user_age_confirmations`：`id`、`user_id`、`method in ('self','guardian','admin')`、`status in ('confirmed','revoked')`、`confirmed_by`、`policy_version`、最小化的 `evidence_ref`、`confirmed_at`、`revoked_at`；每个用户最多一条 active confirmed 记录。
- 修改所有版本的 `handle_new_user()` 触发器最终定义以及 `app/api/auth/sms/verify/route.ts`，注册/短信验证不得再自动写 `age_confirmed_at`。短信验证只证明手机号控制权，不证明年龄确认。
- 迁移前旧的非空 `age_confirmed_at` 不生成 `user_age_confirmations`，`birth_date` 也不自动转成已确认；dry-run 输出受影响用户数，旧列只作为待清理兼容字段保留。
- `app/api/settings/age-confirmation/route.ts` 和 `AgeConfirmationForm` 保存确认方式、确认人、时间、条款/文案版本和必要的监护人/管理员审计引用；普通用户不能选择 `guardian/admin` 方法。
- 哪些 method 在 v1 对真实用户开放、所需文案和证据保留期限必须先由产品/隐私负责人确认；未获确认的方法即使存在于数据库枚举也不在 UI/API 开放。
- 年龄确认可重试但必须幂等，撤销或纠错产生审计事件并触发 Trust 重评。该流程和历史迁移完成前，T1 写操作 enforcement feature flag 必须保持关闭。

### 6.2 RLS

- 用户只通过 `get_my_trust_summary()` 读取自己的等级、下一等级缺口和当前限制的安全摘要。
- 原始 audit、活动事件和 safety case 不直接公开；Admin/Moderator 按职责读取，用户申诉页面另建脱敏 RPC。
- 普通客户端不能修改 `automatic_level`、`manual_grant_level`、cap 或 freeze。
- 所有 `SECURITY DEFINER` 函数固定 `SET search_path = ''`，函数体中的表、函数和类型全部使用全限定 schema；撤销 PUBLIC 执行权后逐角色 GRANT。若以后引入 private schema，也不能依赖调用者可修改的 search path。

### 6.3 评估器

SQL 或服务端评估器输入统一的 `TrustMetricsSnapshot`：

```ts
type TrustMetricsSnapshot = {
  accountAgeDays: number
  activeDays: number
  ageConfirmed: boolean
  approvedContributionCount: number
  approvedContributionModules: Array<'projects' | 'course_works' | 'challenges' | 'nature_observations'>
  eligibleCommentCount: number
  hasActiveRestriction: boolean
  daysSinceLastConfirmedViolation: number | null
  asOf: string
  ruleVersion: 'trust-v1'
}
```

规则由 `lib/trust/rules.ts` 做边界单测，数据库只负责可靠聚合事实和原子写状态。事件成功后对单用户重评；每日批处理兜底纠正遗漏。并发评估使用 advisory lock、行锁或带 `rule_version/evaluated_at` 的 compare-and-set，确保同一快照只写一次审计。

建议新增：

- `app/api/trust/me/route.ts`：当前用户等级、缺口和可用能力。
- `app/api/admin/users/[id]/trust/route.ts`：Admin 授予/撤销 T4、设置有期限 cap/freeze；必须要求原因。
- `scripts/recalculate-trust-levels.mjs`：`--dry-run` 默认，显式 `--apply`，支持 `--only-user`、`--as-of`、`--rule-version`。

## 7. 内容策略与数据库访问

### 7.1 内容字段

新增 `<timestamp>_content_access_policies.sql`，在以下表加入同名字段：

- `courses`
- `projects`
- `challenges`
- `learning_resources`

最终字段：

```sql
access_scope text not null check (access_scope in ('public', 'authenticated', 'trust'))
min_trust_level smallint null check (min_trust_level between 0 and 4)
member_read_bypass boolean not null default true
```

增加一致性约束：只有 `access_scope='trust'` 时 `min_trust_level` 才非空；其他 scope 必须为 null。现有表非空，必须分阶段迁移：

1. 先以可空列加入三个字段，不启用 checker。
2. 对所有现存记录回填，而不只是已发布记录：已发布/approved 内容为 `public`；draft、pending、archived 和私有内容也写入 `public` 作为未来发布默认，但仍由原状态/可见性规则保持不可读。
3. dry-run 验证零 null、合法组合和各状态数量，再设置 default、`NOT NULL` 和一致性约束；随后 `VALIDATE CONSTRAINT`。
4. 最后上线发布接口的强制校验和 catalog/body checker。任何阶段都不能让草稿因策略回填变成公开。

项目作者不能自行选择最低等级：`POST /api/projects` 写入产品确定的显式默认策略，Admin 在审核/编辑时可以调整。课程、挑战和资料由 Admin 表单配置。v1 课时不加覆盖字段。

### 7.2 教师指派关系

Teacher 旁路只对“明确分配”的课程/挑战成立，因此 v1 新增 `content_teacher_assignments`：

- 使用 `course_id bigint null REFERENCES courses` 和 `challenge_id bigint null REFERENCES challenges`，配合 `num_nonnulls(course_id, challenge_id)=1`，避免无法建立 FK 的多态 `content_type/content_id`。
- 其余字段为 `teacher_id uuid`、`assigned_by uuid`、`reason`、`assigned_at`、`revoked_at`；分别为 course/teacher 和 challenge/teacher 建立 `WHERE revoked_at IS NULL` 的有效唯一索引。
- 只有 Admin 可分配/撤销；Teacher 只能读取自己的有效指派摘要，不能自行写入。
- Admin API 使用 `app/api/admin/content-teacher-assignments/route.ts`（或按内容拆分的等价路由），所有变更要求原因并写审计。
- `resolve_content_access` 只在 course/challenge 且存在有效指派时返回 `grantedBy='teacher'`；项目和资料不因全局 Teacher role 自动旁路。
- 若该关系和 Admin 工作流未在 v1 实现，则必须从 checker、UI 和测试中关闭 Teacher bypass，不能仅凭 `profiles.role='teacher'` 放行。

### 7.3 SQL 判定函数

新增 `<timestamp>_content_access_rpcs.sql`，不要用拼接动态 SQL。建议提供：

- 面向普通请求的 `resolve_content_access(p_content_type, p_content_id)`，用户来自 `auth.uid()`。
- 四类 catalog RPC，只返回公开摘要列和访问要求。
- 四类 body RPC，先判断发布/作者/角色/会员/Trust，再返回正文列。
- service-role-only 的内部判定函数，显式接收已经由服务端认证的 actor，并写调用场景审计；不 GRANT 给 anon/authenticated。

返回契约：

```ts
type ContentAccessDecision = {
  contentType: 'course' | 'project' | 'challenge' | 'resource'
  contentId: number
  summaryVisible: boolean
  bodyAllowed: boolean
  code: 'OK' | 'AUTH_REQUIRED' | 'TRUST_LEVEL_REQUIRED' | 'ACCOUNT_RESTRICTED' | 'CONTENT_NOT_FOUND'
  grantedBy: 'public' | 'authenticated' | 'trust' | 'membership' | 'owner' | 'teacher' | 'moderator' | 'admin' | null
  currentTrustLevel?: 0 | 1 | 2 | 3 | 4
  requiredTrustLevel?: 0 | 1 | 2 | 3 | 4
  membershipBypassAvailable?: boolean
}
```

草稿/私有内容对无职责用户返回 `CONTENT_NOT_FOUND`；已发布但等级不足返回结构化 401/403。响应不包含正文或附件 URL。

### 7.4 摘要与正文迁移

现有表把摘要和正文放在同一行，实施采用受控 RPC 过渡：

1. catalog RPC 以 SECURITY DEFINER 严格投影摘要列。
2. body RPC 执行统一 checker 后才投影正文列和子表。
3. 应用端所有公共读取迁到 RPC/API 后，撤销 anon/authenticated 对含正文表的直接 SELECT；Admin API 在 `requireRole` 后使用专用 Admin RPC 或受控 service-role 查询。
4. 写接口不再依赖 `.insert(...).select('*')` 返回整行，改为只返回必要 ID/状态。
5. 以后如正文模型继续扩大，再拆到独立 body 表，不在首版同时做两种迁移。

需要逐项迁移的读路径：

| 类型 | catalog/metadata | body/详情 |
|---|---|---|
| Course | `listApprovedCourses`、`getCourseOverview`、`/api/courses` | `getLessonInCourse`、课时页、LDraw/课件资源接口 |
| Project | explore 列表、搜索、推荐、相关项目、metadata | `getProjectById`、材料、步骤、反思、附件 |
| Challenge | `getPblChallengeGroups`、推荐挑战、metadata | `/api/challenges/[id]`、阶段、resources、workspace/coach 上下文 |
| Resource | 挑战相关资料摘要、metadata | `getPublishedLearningResource`、`/api/resources/[id]`、Markdown 正文 |

metadata、JSON-LD、搜索和推荐只使用 catalog。被锁用户不能在 RSC Flight、预取响应或错误日志中收到 body。

### 7.5 附件

- 盘点 `course_lessons.resources/content`、挑战 resources、项目步骤图和资料 Markdown 外链。
- 需要受限的 OSS/Storage 文件迁到私有 bucket 或鉴权代理；公开 URL 一旦泄漏无法撤回。
- 新增签名接口时只接受内容 ID 和资源键，不接受任意路径；签名前再次调用 content checker。
- `/api/assets/[...path]` 不能继续无条件代理受限附件。公开资源与受限资源使用不同前缀或 bucket。

## 8. 应用层接入

### 8.1 内容页面

页面始终先读取 catalog summary，再根据 decision 分支：

- `OK`：加载正文。
- `AUTH_REQUIRED`：保留标题、封面、简介，提供登录动作。
- `TRUST_LEVEL_REQUIRED`：显示所需等级、当前进度和会员阅读旁路提示。
- `ACCOUNT_RESTRICTED`：显示限制状态和申诉入口，不泄漏内部审核说明。
- `CONTENT_NOT_FOUND`：走 `notFound()`。

`generateMetadata` 只调用 summary，不触发正文查询。锁态组件保持固定尺寸并包含图标、文本和可访问名称；不要用纯灰色或单一锁图标表达状态。

### 8.2 Admin

`ContentAccessFields` 使用：

- segmented/select 控制 `public/authenticated/trust`。
- 仅 trust scope 显示 T0-T4 选择。
- toggle 控制会员阅读旁路。
- 发布前展示策略摘要；缺失策略阻止发布。

接入课程、挑战、资料管理；项目策略接入 Admin 项目审核/编辑。Admin API 使用同一 Zod/validation helper，不能信任前端隐藏字段。

### 8.3 社区操作门禁

在业务校验和限流之前完成认证，在写数据库之前调用 `requireTrustCapability`：

**T1 `submit`**

- `app/api/courses/[courseId]/lessons/[lessonId]/works/route.ts`
- `app/api/projects/[id]/completions/route.ts`
- `app/api/challenges/[id]/submission/route.ts`
- `app/api/observations/route.ts`

**T1 `comment`**

- `app/api/comments/route.ts`
- `app/api/completions/[id]/comments/route.ts`
- `app/api/observations/[id]/comments/route.ts`
- 仍在使用的 discussion reply 写入链路

**T2 `post` / `message`**

- `app/api/projects/route.ts`
- 仍在使用的 discussion 创建链路
- `app/api/messages/send/route.ts`

只拦新建。作者 PATCH/DELETE 自己的历史内容继续走所有权检查；重新提交被拒作品属于“投稿”，要求当前 T1。会员不传入 action checker。

## 9. 历史回算与发布工具

`scripts/recalculate-trust-levels.mjs` 的 dry-run 输出至少包含：

- 总用户数和 T0/T1/T2 分布。
- 每项阈值未满足人数。
- 缺年龄确认、缺活动来源、存在冲突限制的数据清单。
- 按用户输出规则版本、`as_of`、指标快照和拟写入等级。

首轮 `--apply` 使用唯一审计键保证重复执行不新增记录，自动等级 `LEAST(calculated, 2)`。T3 评估任务保持 feature flag 关闭，直到单独灰度批次。

内容策略迁移顺序必须是：先加字段并回填 `public`，再上线 catalog/body RPC，应用读路径全部切换后才收紧表 SELECT/RLS，最后才把试点内容改为 trust scope。任何一步失败都不能出现短暂正文裸露。

## 10. 测试设计

### 10.1 单元测试

- `lib/gamification/xp-level.test.ts`：所有等级边界与非法 XP。
- `lib/trust/rules.test.ts`：T0-T3 每个阈值的前一刻/临界值/后一刻，近期违规 30/90 天边界。
- 年龄确认规则：旧 `profiles.age_confirmed_at` 不生效；active 新记录生效；撤销、非法方法和缺 policy version 均不生效。
- `lib/access/content-access.test.ts`：匿名、T0-T4、有效/过期会员、owner、teacher、moderator、admin 全矩阵。
- Teacher 仅对有效指派的 course/challenge 放行，撤销、过期、错误内容类型和仅有全局 role 都拒绝。
- `lib/access/action-access.test.ts`：T1/T2 能力与 freeze/cap 优先级，确认会员不旁路。
- Admin validation：scope/min level/member bypass 组合约束。

### 10.2 Route 和组件测试

- catalog 响应不含 `content/steps/resources/content_md` 等正文键。
- 正文 API 分别返回 401、结构化 403、404 和 200；拒绝响应不含附件 URL。
- 各写入口在 T0/T1/T2 下结果一致；旧内容 PATCH/DELETE 仍可用。
- `ContentLock` 在键盘、读屏、窄屏和最长中文提示下不溢出。
- Admin 发布缺失策略失败，合法策略保存后回显一致。
- 访问字段迁移 fixture 覆盖 published、draft、pending、archived，设置 `NOT NULL` 前必须零 null，状态不可见规则保持不变。

### 10.3 数据库与 E2E

- 使用真实 Supabase 测试匿名、T0-T4、会员、角色直接调用 REST/RPC，不能仅测 Next API。
- 猜测 course/challenge/resource/project 正文和附件地址必须失败。
- service-role 数据读取若未调用 checker，在测试/日志断言中失败。
- 缓存测试验证会员到期或 Trust 变化后不继续读到旧正文，且两个用户不会串响应。
- XP P0 测试验证浏览器不能指定 amount/action/resource，重复业务事件只增加一次。
- observation、challenge settlement/review、growth task 和 completion approval 分别注入余额更新失败，断言流水与余额同事务回滚并可重试。
- 回算脚本 dry-run 无写入，apply 重跑幂等，回滚后草稿仍不可见。

建议新增 `e2e/trust-access.spec.ts` 和专门的 SQL/RLS 集成测试，不把所有矩阵塞进通用 smoke。

## 11. 推荐 PR 顺序

1. **PR 1：XP P0**：原子服务端奖励、迁移全部 `addXp` / `increment_user_xp` / `xp_logs` 写入、统一 XP Lv.、修正文案。
2. **PR 2：Trust foundation**：表/RLS、显式年龄确认及旧值迁移、纯规则、评估器、`/api/trust/me`，只计算不拦截。
3. **PR 3：Content policy**：四表字段、Admin 控件、历史显式 `public` 回填。
4. **PR 4：Catalog/body split**：RPC、共享 checker、教师指派关系/后台流程、四类读取迁移、附件私有化；仍不启用门槛。
5. **PR 5：Shadow mode**：历史回算、锁态 UI、would-deny 指标和直接 Supabase 验证。
6. **PR 6：Read enforcement pilot**：少量资料和课程，随后项目/挑战。
7. **PR 7：Action gates**：T1/T2 写操作；最后启用 T3 自动评估和 T4 Admin 流程。

每个涉及数据库的 PR 都创建 forward migration，并按 `.cursor/rules/db-migrations.mdc` 使用 `pnpm db:push`。每个新增路由、共享模块、表或行为的 PR 同步更新 `PROJECT_INDEX.md` 和 `lib/supabase/types.ts`。

## 12. 完成定义

- 任意浏览器请求都不能直接增加 XP 或伪造 XP 流水。
- 四条轴在类型、数据库和 UI 上独立，现有 XP 权限文案已清理。
- T1 只读取新年龄确认事实；旧自动时间戳无效，用户有可完成且可审计的确认流程。
- 四类内容都有显式策略，目录摘要公开，正文和附件执行统一 checker。
- Teacher 只有存在有效课程/挑战指派时才旁路对应正文。
- API、RSC、Supabase REST/RPC、Storage、搜索、metadata 和缓存不存在已知旁路。
- T1/T2 写操作矩阵全部接入，会员无写入旁路，T4 无后台权限。
- 历史回算、灰度、监控和回滚均至少演练一次，相关测试和 `PROJECT_INDEX.md` 同步完成。
