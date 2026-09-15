# 课程、项目与挑战内容分级实现与维护

> 当前文档描述已经存在的代码、数据库边界和运维入口。它不把历史预检数字当作实时线上状态；需要当前状态时运行文中的只读检查。

## 1. 适用范围与三轴不变量

课程、项目和挑战共用三个相互独立的公开轴：

| 轴 | 公开值 | 含义 |
| --- | --- | --- |
| 推荐起始年龄 | `3–16` 岁起 | 建议从哪个年龄开始尝试，不是访问门槛 |
| 难度 | `beginner` / `intermediate` / `challenge` | 任务复杂度、先备能力和推理负荷 |
| 成人支持度 | `independent` / `guided` / `adult_required` | 安全风险、工具使用和过程中需要的协助 |

必须保持以下不变量：

- 前台不显示 `difficulty_stars` 或“几星”；内部 `difficulty_stars` 的 `1–2 / 3–4 / 5–6` 固定映射到三档难度，继续供历史统计、奖励和兼容读取使用。
- 推荐年龄是提示和排序依据，不把超出建议年龄的用户硬排除。
- `recommended_max_age = NULL` 只有在 `reviewed` 且起始年龄已确认时才表示没有设定上限；`unreviewed` 的 NULL 表示尚未确认。
- 已复核公开分类必须同时有起始年龄、支持度、合法内部难度、`classification_source=manual`、审核时间和审核人。
- 内容安全审核状态与内容分级状态是两套独立门禁。公开内容仍须满足原有 `status` / `moderation_state` 条件。
- 课程只在 `courses` 保存分级，课时通过 `course_id` 继承；不在 `course_lessons` 重复存储三轴。
- 内容正文、材料、步骤、阶段、资源或分级相关字段变化会使旧结论失效并递增 revision；运营图片、排序和互动计数变化不会失效。
- 作者可以提交候选值，但不能写入 `reviewed` 或审核元数据。审核记录不可由客户端更新或删除。

## 2. 当前实现地图

共享领域代码位于 [`lib/content-classification/`](/home/arron/work/lib/content-classification/index.ts)：类型、常量、三档映射、候选规则、校验、公开查询、JSON-LD、设置读取和管理员辅助函数均从这里复用。公开展示组件是 [`components/ui/content-classification.tsx`](/home/arron/work/components/ui/content-classification.tsx)。

已存在的运维和管理入口：

- [`/admin/content-classifications`](/home/arron/work/app/admin/content-classifications/page.tsx) 提供课程、项目、挑战的候选队列和人工复核。
- `GET /api/admin/content-classifications` 查询队列；支持 `contentType`、`status`、分页和安全关键词筛选。
- `GET/PATCH /api/admin/content-classifications/[contentType]/[id]` 读取详情、历史和候选；PATCH 只能写候选字段及内部难度，不能写审核状态和审核元数据。
- `POST /api/admin/content-classifications/[contentType]/[id]/review` 以 `approve` 或 `return` 写入审核结论，要求完整三轴、UUID 幂等键和 revision；过期 revision 返回冲突。moderator 不能审核自己创建的内容，admin 的自审例外会进入审计说明。
- 公开课程、项目、挑战 API、探索/推荐/排行、课程课时页、项目页、PBL 页、站点地图、JSON-LD 和 AI 上下文均通过公开 DTO 与开关处理；公开 DTO 不泄漏星级。

数据库字段在 `courses`、`projects`、`challenges` 上保持一致：

```text
recommended_min_age        smallint nullable
recommended_max_age        smallint nullable
support_level              varchar(24) nullable
classification_status      varchar(16) not null default 'unreviewed'
classification_source      varchar(16) nullable  -- rules_v1 / manual
classification_reviewed_at timestamptz nullable
classification_reviewed_by uuid nullable
classification_revision    bigint not null default 0
```

`content_classification_reviews` 保存 `candidate`、`approve`、`return`、`invalidate` 事件及前后值、原因、操作者和幂等键。`content_classification_settings` 保存两个发布开关；`content_classification_rollout_events` 保存切换和紧急操作审计。

## 3. 开关状态机与公开规则

服务端唯一读取入口是 `getContentClassificationSettings()`。设置表不可用时，兼容默认值为：

```text
public_v1_enabled = false
enforcement_enabled = false
```

两个开关独立，但启用有顺序约束：

```text
关闭/兼容：不返回公开 classification，沿用旧公开查询
public_v1：公开 reviewed 的完整三轴；unreviewed 的 classification 为 null
enforcement：数据库拦截不完整内容进入公开状态，并要求公开查询 reviewed-only
```

`public_v1` 由受控 `set_content_classification_public_v1` RPC 切换；发布门禁由 `enable_content_classification_rollout` 在 advisory lock 内检查计数后切换。设置行、切换 RPC 和事件表只允许受控服务端操作。不要把文档、构建日志或旧预检报告中的开关值当成实时状态。

公开内容条件为：课程 `status=approved`；项目 `status=approved AND moderation_state=approved`；挑战 `status IN (active, ended)`。启用 enforcement 后还必须 `classification_status=reviewed` 且满足完整性校验。

## 4. 候选、审核权限和 API 边界

`scripts/content-classification-candidates.mjs` 调用 `rules_v1` 规则生成年龄、支持度、星级映射、置信度和安全关键词。默认 dry-run；`--apply-candidates` 才写候选，并跳过已有 `manual` 结论。规则命中是人工提醒，不自动决定成人支持度，也不等同于待审核记录。

审核结论只能经 review RPC 写入，必须提供：

```text
recommendedMinAge: 3..16
recommendedMaxAge: null 或不小于起始年龄且 <=16
supportLevel: independent | guided | adult_required
difficultyStars: 1..6
decision: approve | return
idempotencyKey: UUID
expectedRevision: 当前审核页面读取的 revision（客户端应显式传入；省略时服务端兼容为刚读取版本）
```

内容编辑接口可写候选值和内部 `difficulty_stars`，但禁止写 `classificationStatus`、`classificationReviewedAt`、`classificationReviewedBy`。触发器和 RPC 共同保护审核元数据、revision、审计事件及发布门禁。

## 5. 失效、继承与兼容

以下变更必须重新复核：标题、说明/正文、目标、约束、场景、驱动问题、预期结果、材料、步骤、阶段、资源、课程课时集合及其内容、内部难度和三轴字段。课程课时增删或课时正文/材料/步骤变化会使父课程回到 `unreviewed`。

图片、封面、排序、点赞/浏览/评论/参与/完成计数和普通更新时间不触发失效。应用层变更判断与数据库触发器都使用同一字段边界；复核时用 `classification_revision` 防止审核覆盖编辑后的新版本。

旧 `difficulty`、星级筛选参数和年龄段推荐 RPC 保留兼容；新读取使用三档映射与精确年龄。旧字段不是新的公开分类来源。

## 6. 迁移执行边界与运维脚本

内容分级迁移按字段/审计、发布门禁、推荐、排行可见性、自审规则和 public-v1 分开：

```text
supabase/migrations/20260825112933_content_classification_fields.sql
supabase/migrations/20260825121949_content_classification_gate.sql
supabase/migrations/20260825123613_content_classification_recommendations.sql
supabase/migrations/20260825130000_content_classification_ranking_visibility.sql
supabase/migrations/20260825143000_content_classification_admin_self_review.sql
supabase/migrations/20260826161222_content_classification_public_v1.sql
```

迁移执行遵循项目约定：先核对待执行文件和本地配置，再使用 `pnpm db:push`；不要用 `supabase db push`。`pnpm db:status` 与 `pnpm db:push -- --dry-run` 会先尝试创建 `_schema_migrations` 追踪表，不能在无写入授权时使用；`content-classification-preflight.mjs` 则是独立的只读检查。执行迁移前按 [数据库迁移规则](database-psql.md) 核对目标和授权。

只读内容检查：

```text
node scripts/content-classification-preflight.mjs --type=all --json
```

候选和报告：

```text
node scripts/content-classification-candidates.mjs --dry-run
node scripts/content-classification-candidates.mjs --apply-candidates
node scripts/content-classification-review-report.mjs
```

变更和启用必须由有权限的运维人员执行；启用前在同一受控事务内确认已发布内容的 `published_unreviewed=0`、`published_incomplete=0`、审核事件操作者完整且无课程继承冲突。不要以历史报告中的数字替代当前检查。

`scripts/set-content-classification-public-v1.mjs --enable|--disable --reason=...` 只切换 public-v1，必须留下原因和操作者。发布 enforcement 使用数据库受控 RPC；不能通过直接 UPDATE 设置表绕过审计。`scripts/content-classification-watchdog.mjs` 默认只读检查紧急 enforcement TTL；只有在已授权的部署任务中追加 `--apply` 才会恢复门禁并写入审计事件。

## 7. 启用与回滚

推荐顺序：先候选生成和人工复核，再以当前只读检查确认门槛，开启 public-v1，观察公开 DTO/页面，最后在确认需要时开启 enforcement。public-v1 和 enforcement 可以独立关闭；关闭 public-v1 会隐藏公开分类字段，关闭 enforcement 会恢复旧发布状态门禁，但不会删除审核数据或回退字段。

紧急回滚只通过受控 RPC/脚本执行，必须提供原因、操作者和不超过 24 小时的恢复期限，并保留 rollout event。回滚后仍应修复导致失败的内容或迁移；不要删除分类列、审计表或直接清空审核结论。

## 8. 重要测试定位

- 领域映射、校验、候选、查询和设置：`lib/content-classification/index.test.ts`。
- 公开三轴组件：`components/ui/content-classification.test.tsx`。
- 课程公开 DTO 与兼容开关：`lib/api/courses.test.ts`。
- 数据库门禁、审计、索引和 RPC：对应六个 `supabase/migrations/*content_classification*.sql`，需在目标数据库执行迁移验证和受控 RPC 验证。
- 前台课程、项目、挑战和推荐的 reviewed/null 行为：检索 `getContentClassificationSettings`、`withoutPublicClassification`、`applyPublicClassificationVisibility` 的调用方做回归检查。

运行定向验证：

```text
pnpm vitest run lib/content-classification/index.test.ts components/ui/content-classification.test.tsx lib/api/courses.test.ts
```

## 9. 明确边界

本功能不改变既有安全审核体系、XP/徽章/游戏等级、课程课时表结构、旧星级内部计算或普通用户访问权限；不把规则候选当人工结论，不在页面请求、开发启动或每次构建时自动运行预检/审核脚本。
