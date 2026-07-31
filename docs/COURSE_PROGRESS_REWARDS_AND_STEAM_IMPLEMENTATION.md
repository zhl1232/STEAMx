# 积木课程进度、作品奖励与 STEAM 结算开发设计

> 状态：应用代码与迁移已实现，数据库迁移待执行。最后复核：2026-07-31。
>
> 本文承接 [`next-step.md`](./next-step.md) 的“积木课程：完成、作品奖励与能力成长”。本文只定义实现，不表示功能已经上线。

## 1. 目标与不变量

- 标记课时完成只写 `user_lesson_progress.completed_at`，不再产生 XP。
- 历史 `complete_lesson` 流水和已经发放的 XP 原样保留，不追扣、不冲正。
- 课程作品提交只写 `completed_projects` 的 `pending + final + course_lesson_id`；提交不发 XP，审核通过才发 `+20 XP`。
- 同一用户同一课时的作品奖励最多一次，审批重试、并发审批和重新提交都不能重复记账。
- 一门课程至少有 1 个课时，且用户完成当前全部课时，才生成 1 条不可变的课程能力里程碑。
- 每门课程 v1 最多贡献一次 STEAM 雷达；课程作品本身不再单独贡献雷达，避免“作品 + 整课”双算。
- 项目作品进入雷达必须同时满足 `completed_projects.status='approved'`、`record_kind='final'`、`project_id IS NOT NULL`。

## 2. 当前代码基线与缺口

| 入口 | 当前行为 | 目标改造 |
|---|---|---|
| `app/api/courses/[courseId]/lessons/[lessonId]/complete/route.ts` | 完成后写 `complete_lesson` 流水并发 `+15 XP` | 删除奖励段，保留 Scratch 保存和 requiredBlocks 校验，改走原子完成 RPC |
| 三个课程 workspace | 成功文案硬编码“+15 经验值” | 删除 XP 文案，展示进度保存或整课完成反馈 |
| `lib/api/courses.ts` | 课程列表只统计总课时，详情不读个人进度 | 批量附加课程与课时完成态，禁止 N+1 |
| `user_lesson_progress` RLS | authenticated 可直接写本人 `completed_at` | 先迁移所有合法写入口，再撤销客户端 DML；未硬化前不得启用里程碑或 reconcile |
| 课程 works route | 提交 `pending/final/course_lesson_id`，不发 XP | 保持现状，仅接入后续信任门禁 |
| `lib/completions/approve.ts` | 先插 XP 流水，再单独增加 profile XP | 审核状态、流水和余额放入同一事务 |
| `calculate_steam_radar` | 项目分支未过滤审核状态/终稿，循环顺序不稳定 | 完整替换函数，加入整课里程碑来源和稳定顺序 |

当前 complete route 在 Scratch 路径检查后才判断 `alreadyCompleted`，与“已完成直接幂等返回”的注释不一致。重构后，由受控 RPC 产生的已完成事实可以跳过 Scratch 文件和 requiredBlocks 重校验；硬化前遗留的客户端可写记录不能直接触发里程碑，也不能走这个快速路径。

需要删除 XP 成功文案的首批文件：

- `components/features/courses/scratch-workspace.tsx`
- `components/features/courses/building-3d-workspace.tsx`
- `components/features/courses/playground-workspace.tsx`

普通首次完成提示“课时进度已保存”；若响应中的 `courseCompletionState='created'`，提示“课程已完成，STEAM 能力已更新”；若为 `configuration_error`，只提示课程进度已保存并由服务端告警，不把配置故障暴露成用户错误。

## 3. 用户进度契约

在 `lib/courses/types.ts` 增加：

```ts
export type CourseProgressStatus = 'not_started' | 'in_progress' | 'completed'

export interface CourseProgressSummary {
  completed_lesson_count: number
  total_lesson_count: number
  status: CourseProgressStatus
  next_lesson_id: number | null
  milestone_completed_at: string | null
}
```

类型调整：

- `CourseListItem.progress: CourseProgressSummary | null`。
- `CourseOverview.progress: CourseProgressSummary | null`。
- `CourseLessonSummary.is_completed: boolean`；可选保留 `completed_at: string | null` 供未来展示时间。
- `progress=null` 明确表示匿名，不能把匿名用户映射成“登录但完成 0 课”。

状态规则：

- `total_lesson_count=0` 永远为 `not_started`，不能因 `0 === 0` 误判完成。
- `completed=0` 为 `not_started`；`0 < completed < total` 为 `in_progress`；`completed=total>0` 为 `completed`。
- `next_lesson_id` 按 `course_lessons.sort_order, id` 取第一个未完成课时。
- 全部完成后，`next_lesson_id` 可指向第一课供“回顾课程”使用，也可以为 null；v1 统一返回 null，由页面显式选择第一课。

`POST /api/courses/:courseId/lessons/:lessonId/complete` 保持原 `progress` 字段兼容，并扩展：

```json
{
  "progress": {
    "user_id": "uuid",
    "lesson_id": 12,
    "completed_at": "2026-07-30T10:00:00.000Z",
    "updated_at": "2026-07-30T10:00:00.000Z"
  },
  "alreadyCompleted": false,
  "courseProgress": {
    "completedLessonCount": 12,
    "totalLessonCount": 12,
    "status": "completed"
  },
  "courseCompletionCreated": true,
  "courseCompletionState": "created"
}
```

API JSON 使用 camelCase；数据库/内部 row 保持 snake_case。映射只放一处并覆盖测试。

`courseCompletionState` 固定为 `not_complete | created | already_recorded | configuration_error`。`courseCompletionCreated` 暂时保留为便捷布尔值和兼容字段，只在 state 为 `created` 时为 true。

## 4. 不可变课程能力里程碑

新增 forward migration，例如 `<timestamp>_course_completion_rewards_and_radar.sql`：

```sql
CREATE TABLE public.user_course_completions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id bigint NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
  completed_at timestamptz NOT NULL DEFAULT now(),
  trigger_lesson_id bigint REFERENCES public.course_lessons(id) ON DELETE SET NULL,
  lesson_count_snapshot integer NOT NULL CHECK (lesson_count_snapshot > 0),
  steam_weights_snapshot jsonb NOT NULL,
  difficulty_stars_snapshot smallint NOT NULL
    CHECK (difficulty_stars_snapshot BETWEEN 1 AND 6),
  PRIMARY KEY (user_id, course_id)
);
```

### 4.1 配置有效性

现有 `courses.steam_weights` 和 `difficulty_stars` 允许 null，JSON 也没有数据库级结构约束。上线完成 RPC 前必须先做只读预检，列出所有 approved 课程的空值、缺少 S/T/E/A/M key、非数值、负数和全零权重：

- null 只按现有列默认值回填：`difficulty_stars=1`、`steam_weights={"S":5,"T":35,"E":5,"A":15,"M":15}`。
- 其他非法配置不静默修正，由 Admin 明确确认后再迁移。
- 新增可复用的数据库校验函数/约束：五个 key 必须齐全、值为有限非负数、至少一项大于 0，难度为 1-6；`courses` 和快照表使用同一语义。
- 先以 `NOT VALID` 添加约束，修复预检结果后 `VALIDATE CONSTRAINT`，避免部署时才在结算路径暴露脏数据。

若上线后仍遇到非法配置，完成 RPC 必须保留课时进度、跳过里程碑并返回 `courseCompletionState='configuration_error'`；服务端记录课程 ID 和错误类型并告警，不记录用户作品内容。配置修复后由 reconcile 补结算，不能要求用户重复完成课时。

### 4.2 为什么使用快照

里程碑产生时复制 `courses.steam_weights`、`difficulty_stars` 和课时数。后台之后修改权重、难度或增删课时，不撤销用户已经获得的能力，也不产生第二次结算。只在雷达查询时现场判断当前课时数会让历史能力随后台配置消失或重现，无法满足“一次性贡献”。

v1 里程碑一旦产生不更新。未来若课程大版本允许再次结算，应新增 `course_version` 并调整唯一键，不复用本表语义。

### 4.3 RLS

- 用户只可 SELECT 自己的记录；Moderator/Admin 可读用于排障。
- 普通客户端不能 INSERT/UPDATE/DELETE。
- SECURITY DEFINER 函数固定 `SET search_path=''` 并全限定表名，撤销 PUBLIC 权限后按需 GRANT。
- 同一迁移同步维护 `lib/supabase/types.ts`。

课程已有里程碑后，物理删除课程会被 `ON DELETE RESTRICT` 阻止。Admin 应改为归档课程；删除接口返回结构化 409，而不是级联删除历史能力。

## 5. 原子课时完成

新增 service-role-only RPC：

```text
record_course_lesson_completion(
  p_user_id uuid,
  p_course_id bigint,
  p_lesson_id bigint
) -> jsonb
```

`p_user_id` 只能由已经执行 `requireAuth` 的服务端路由传入，RPC 不授权给 anon/authenticated。事务内执行：

1. 校验用户存在、课程为 `approved`、课时属于课程。
2. 以 `(user_id, course_id)` 计算 advisory transaction lock，串行化同一用户同一课程的并发完成请求。
3. 查询课时是否已经完成；仅首次写 `completed_at`，重复请求保留最早时间。
4. 统计课程当前总课时和该用户已完成课时。v1“有效课时”就是该课程在 `course_lessons` 的全部现存行。
5. 当 `total > 0 AND completed = total` 且课程能力配置有效时，`INSERT user_course_completions ... ON CONFLICT DO NOTHING`，保存当前课程快照；配置无效时保留 progress，并返回可补偿状态。
6. 返回 progress、alreadyCompleted、完成/总数、状态、`courseCompletionCreated` 和 `courseCompletionState`。

必须持有课程级锁。若最后两课被并发完成而没有串行化，两个事务可能都看不到对方写入，最终漏掉整课结算。

Route Handler 仍负责：

- 正整数 ID 校验和登录校验。
- 限流。
- 首次完成 Scratch 课时前检查保存路径、下载 `.sb3` 并执行 requiredBlocks 校验。
- 已完成请求跳过上述重校验，但继续调用 RPC 做 reconcile。
- 使用 `supabaseAdmin` 调用 RPC，客户端不能提交 `p_user_id`。

### 5.1 硬化 progress 写入

当前 `user_lesson_progress` 允许本人直接写入，而完成进度以后会驱动不可变能力里程碑。硬化是里程碑上线前置条件，不是事后收尾：

1. 用 `rg` 盘点所有 `.from('user_lesson_progress')`，把 Scratch 保存等合法写入迁到受控 Route Handler/专用 RPC。
2. 在硬化 migration 中为完成记录增加来源字段，例如 `completion_source in ('legacy_client','server_v1','staff_verified')`；迁移前已有的非空 `completed_at` 一律标成 `legacy_client`。
3. 同一 migration 撤销 authenticated 的 INSERT/UPDATE/DELETE，只保留本人 SELECT；普通客户端不能指定或升级 `completion_source`。
4. 此后只有完成 RPC 在通过相应校验后写 `server_v1`。已是 `server_v1/staff_verified` 的重复请求可跳过重校验；`legacy_client` 重试必须重新走当前课时校验，成功后才升级来源。
5. 课程列表为了保持历史体验仍可把 legacy completion 显示为“已完成”，但能力里程碑只统计 `server_v1/staff_verified`。v1 不把客户端可写的历史完成记录自动转换成永久雷达贡献。

在步骤 3 完成之前，不运行历史回填，不开放 reconcile，也不让雷达读取 `user_course_completions`。若产品以后决定补发历史课程能力，必须另做带证据来源、dry-run 和人工批准的迁移，不能复用普通 reconcile 全量放行。

## 6. 课程结构变化和补偿

- 列表进度按当前课时集合实时计算；能力里程碑是历史不可变记录。
- 已结算课程新增课时后，UI 可以回到“进行中”；完成新增课时不会再次增加雷达。
- 删除课时可能让尚未结算的用户立即满足整课条件。
- 删除到 0 课时不能新增里程碑；已有里程碑继续保留。

新增 service-role-only：

```text
reconcile_course_completions(p_course_id bigint default null) -> jsonb
```

它只按 `server_v1/staff_verified` 完成事实批量补插缺失里程碑，用于：

- Admin 删除课时之后。
- 课程从草稿切换为 approved 之后。
- 排障时按单课程修复。

`app/api/admin/courses/lessons/[lessonId]/route.ts` 删除前先读取 `course_id`，删除成功后触发 reconcile。`app/api/admin/courses/[id]/route.ts` 发布成功或修复课程 STEAM 配置后触发 reconcile。

reconcile 只处理 approved、非空课程，并要求用户对该课程全部当前课时都有可信来源的非空 `completed_at`。里程碑 `completed_at` 取这些课时完成时间的最大值，使用当前课程权重/难度做快照，不产生 XP。`legacy_client` 行必须排除并计入 dry-run 报告。

## 7. 作品 `+20 XP` 原子结算

当前 `awardCompletionXp` 先插 `xp_logs`，再单独调用 `increment_user_xp`。若第二步失败，会留下流水并永久阻止后续重试。需要把审批状态、幂等流水和余额更新放入同一数据库事务。

推荐新增：

- `approve_completion_with_reward`：Staff 审核入口。
- `system_approve_completion_with_reward`：AI/Worker service-role 入口。

事务内：

1. 锁定 completion row。
2. 确认或迁移为 `status='approved'`，并要求 `record_kind='final'`。
3. 课程作品生成 `('publish_course_work', course_lesson_id)`；项目作品生成 `('complete_project', project_id)`。
4. `INSERT xp_logs ... ON CONFLICT DO NOTHING RETURNING id`。
5. 只有实际插入流水时才 `UPDATE profiles SET xp=xp+20`。
6. 审批或奖励任一步失败时整个事务回滚，可安全重试。

来源键保持现有口径，不改成 completion ID。这样才能兼容历史流水，并阻止同一课时作品删除重建后重复拿奖励。

切换以下调用方后，撤销旧“只审批不结算”入口或让它代理新函数：

- `app/api/admin/completions/[id]/review/route.ts`
- `lib/completions/approve.ts`
- `lib/completions/moderate-completion.ts`

若 [`TRUST_LEVEL_AND_CONTENT_ACCESS_IMPLEMENTATION.md`](./TRUST_LEVEL_AND_CONTENT_ACCESS_IMPLEMENTATION.md) 的 P0 奖励 RPC 先落地，本功能直接复用同一原子奖励底座，不再创建第二套流水函数。

另提供 service-role-only `repair_completion_rewards(p_apply boolean default false)` 修复模式，扫描“已批准但缺少对应 XP 流水”的终稿；默认只 dry-run 审计，必须显式传 `true` 才 apply。历史 `complete_lesson` 流水不在修复范围。

## 8. STEAM 雷达函数重写

用新迁移完整替换 `public.calculate_steam_radar(uuid)`，保持当前 JSON 返回结构，避免修改 `lib/profile/steam-radar.ts` 和雷达图表契约。

统一 activity CTE 有三个来源：

**项目**

```sql
completed_projects cp
JOIN projects p ON p.id = cp.project_id
WHERE cp.user_id = target_user_id
  AND cp.status = 'approved'
  AND cp.record_kind = 'final'
  AND cp.project_id IS NOT NULL
```

**挑战**

- 保留 `challenge_completions JOIN challenges`。
- 保持每个用户/挑战一条 completion 的现有唯一语义。

**课程**

- 从 `user_course_completions` 读取 `steam_weights_snapshot` 和 `difficulty_stars_snapshot`。
- 一条里程碑就是整门课程的一次贡献。
- `course_lesson_id IS NOT NULL` 的课程作品不再作为独立来源。

难度乘数沿用现有规则：1-2 星 `0.5`，3-4 星 `1.0`，5-6 星 `2.0`；衰减继续按难度档第 N 项使用 `1/sqrt(N)`。

当前 SQL 循环没有稳定顺序，而衰减与顺序有关。新 activity 必须带 `completed_at/source_type/source_id`，按这三个字段稳定排序后再循环；同一数据重复计算应得到完全一致的 JSON。

函数使用全限定 schema 和固定 search_path，并保持现有调用权限。上线前对真实规模执行 `EXPLAIN (ANALYZE, BUFFERS)`。

## 9. 查询与前端改造

### 9.1 服务端查询

新增 `lib/courses/progress.ts`：

- `deriveCourseProgress(lessons, completedIds, milestoneAt)`。
- 只做纯计算，不读数据库，覆盖空课程和稳定 next lesson 排序。

修改 `lib/api/courses.ts`：

- `listApprovedCourses(supabase, { userId? })` 使用固定 2-3 次批量查询取得课程、全部课时 `id/course_id/sort_order` 和当前用户 completed IDs。
- 禁止逐课程查询 progress。
- `getCourseOverview` options 增加 `userId?: string | null`，只查询这门课程课时的当前用户 progress。
- metadata 调用不传 userId；页面/API 从 `supabase.auth.getUser()` 获取后传入，绝不接受请求参数中的用户 ID。

更新：

- `app/api/courses/route.ts`
- `app/api/courses/[courseId]/route.ts`
- `app/courses/page.tsx`
- `app/courses/[courseId]/page.tsx`

登录用户的个性化 API 响应设 `Cache-Control: private, no-store`；匿名 catalog 可以保留公共缓存语义。

### 9.2 页面

`components/features/courses/course-board.tsx`：

- 登录用户显示“已完成 n / total”和“未开始/进行中/已完成”。
- 匿名用户不显示伪造的 0 进度，可显示“登录后记录进度”或隐藏个人状态。
- 状态文本和图标都存在，不能只靠颜色。

课程详情：

- 已完成课时使用 `CheckCircle` 和“已完成”文本。
- 主 CTA 使用 `next_lesson_id`：未开始为“开始学习”，进行中为“继续学习”，完成后为“回顾课程”。
- 完成课时后调用 `router.refresh()` 或等价失效，让返回课程页时不显示旧进度。
- 空课程不展示完成态或可点击 CTA。

### 9.3 Admin 课程能力配置

`components/admin/course-management.tsx` 当前 state 有 difficulty，但表单未完整渲染，也没有 STEAM 权重编辑。需要补：

- 1-6 星数值/步进控件。
- S/T/E/A/M 五项数值控件和总览。
- 共享服务端 schema：五个 key 必须齐全、值为有限非负数、至少一项大于 0。
- 为兼容现有总权重不是 100 的课程，v1 不强制总和等于 100。
- 数据库约束、完成 RPC 和 Admin schema 使用同一组有效/无效 fixture 做契约测试，不能形成三套边界。

Admin create/update API 使用同一 schema，不能只在组件校验。

## 10. 预计文件清单

**数据库**

- 新增迁移、里程碑表、完成/reconcile/审批 RPC、雷达函数。
- `lib/supabase/types.ts`。

**课程服务**

- `lib/api/courses.ts`
- 新增 `lib/courses/progress.ts`
- `lib/courses/types.ts`

**完成与奖励**

- 课时 complete route。
- `lib/completions/approve.ts`
- `lib/completions/moderate-completion.ts`
- Admin completion review route。

**页面与组件**

- courses list/detail。
- `course-board.tsx`、`course-board-loader.tsx`。
- Scratch、Building 3D、Playground 三个 workspace 及测试。
- `components/admin/course-management.tsx` 和 Admin course API。

功能真正落地时必须同步更新 `PROJECT_INDEX.md`：当前课程/API 索引中的完成奖励说明、新表/RPC、雷达口径、页面进度和 Admin 能力配置都要写入；同时在 `docs/next-step.md` 就地标记完成项。

## 11. 测试矩阵

### 11.1 纯函数与查询

- 匿名、0/部分/全部完成和空课程。
- sort_order 相同以 lesson ID 打破顺序，next lesson 稳定。
- 批量课程查询固定次数，用户 A 响应不含用户 B 进度。

### 11.2 完成 API

- 首次完成写时间，但 XP 和 `complete_lesson` 日志均不变化。
- 重复完成保留原 `completed_at`。
- 非法 course/lesson、课时不属于课程、课程未发布。
- Scratch 未保存、requiredBlocks 缺失和合法作品回归。
- 并发重复同一课只写一条 progress。
- 并发完成最后两课后恰好一条 `user_course_completions`。
- 非法 STEAM 配置不回滚课时进度，返回 `configuration_error`；配置修复并 reconcile 后只补一条里程碑。

### 11.3 结构变化与回填

- 新增课时不重复结算。
- 删除课时后 reconcile 可补齐；删除到空课程不补。
- legacy completion 继续显示进度但不会自动产生里程碑；可信来源可 reconcile 且不增加 XP。
- 已有里程碑的课程不能物理删除，但可以归档。

### 11.4 作品奖励

- 提交 pending 时 XP 不变。
- 第一次批准精确增加 20。
- 并发/重复批准仍只增加 20。
- 模拟余额更新失败时事务整体回滚，重试可以成功。
- 同课时作品删除重建不重复奖励。

### 11.5 雷达

- pending/rejected/progress completion 均不计。
- approved final 项目只计一次。
- 课程作品不单独计入；整课里程碑计一次。
- 重复打开页面或重复完成不改变结果。
- 同一数据多次计算 JSON 完全一致。

### 11.6 UI 与权限

- 桌面、移动端课程列表和详情完成标记无溢出，读屏能读出状态。
- 匿名态不显示个人 0 进度。
- 既有 workspace Vitest 更新并断言不再出现“+15 经验值”。
- 普通 authenticated 不能直写 milestone；硬化后也不能直接伪造 completed progress。

## 12. 发布、观测与回滚

1. 部署支持 `completion_source`、但暂不创建 milestone 的受控 progress 保存/完成入口；入口先兼容旧表结构，migration 完成后开始写可信来源。此时不开放历史回填、reconcile 或雷达新来源。
2. 确认所有合法写入已迁移后，在维护窗口执行同一个来源标记/RLS 硬化 migration；使用 `pnpm db:push -- --dry-run`、`pnpm db:push`、`pnpm db:status`，禁止 `supabase db push`。
3. 验证普通 authenticated 无法写 progress 或伪造来源，再开启完成入口的 `server_v1` 写入，同时上线原子审批和 Admin 能力配置。
4. 运行 STEAM 配置预检并修复/验证约束，然后才开启 milestone 创建、可信来源 reconcile 和雷达新来源；不自动回填 legacy completion。
5. 部署 DTO、列表/详情 UI，确认历史进度仍显示正确。
6. 观测 `complete_lesson` 新流水数应为 0、每 `(user,course)` milestone 最大为 1、legacy 排除数、配置延迟结算数以及已批准终稿与奖励流水缺口。
7. 记录 `courseCompletionState`、奖励 duplicate/no-op 和 reconcile 补偿数量，但不记录 Scratch 文件内容。

回滚只切回应用读取或暂时移除雷达新来源，不删除 milestone、历史 progress 或 XP 流水，也不恢复 `+15 XP`，除非产品另行决策。

## 13. 完成定义

- 完成课时不产生 XP，历史 XP 未变化。
- 作品提交不发奖励，批准与 `+20 XP` 同事务且幂等。
- 列表与详情对匿名/登录用户显示正确、同源的进度。
- 非空课程全部完成后只产生一条不可变能力里程碑。
- 普通客户端不能写完成事实；legacy completion 不会未经验证固化为能力里程碑。
- 雷达只统计 approved final 项目、挑战完成和课程里程碑，结果稳定可复算。
- 所有新增迁移、RPC、共享模块和重要行为已经同步到 `PROJECT_INDEX.md`，测试与观测项通过。
