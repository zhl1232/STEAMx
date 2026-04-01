# 鸟类观察：复杂度现状与演进路线

本文档记录自然/鸟类观察相关代码的**复杂度评估**、**已完成的重构**，以及**建议的后续步骤**（按优先级与风险排序）。实施时按阶段推进，每阶段可单独评审与合并。

---

## 1. 现状摘要（2026-03-31）

| 区域 | 状态 | 说明 |
|------|------|------|
| 提交表单 | 已拆分 | 主逻辑约 230 行；区块组件在 `components/features/bird-observation/observation-submit-*.tsx` |
| 游戏化耦合 | 已解耦 | 提交成功派发 `dispatchObservationCreated()`；`ObservationGamificationSync` 失效统计缓存 |
| 读模型聚合 | 已分层 | `nature-observation-data.ts` 为 re-export；查询在 `*-events` / `*-homepage` / `*-species` |
| 数据表耦合 | **已移除** | `observation_events.project_id` / `challenge_id` 已 drop；`project_species` / `challenge_species` 策展表已 drop |
| 评论 API | 已对齐 | 观察评论经 `mapDbObservationComment` → 与项目评论一致的 `Comment` 形状 |
| 个人页 | 部分收口 | 「我的观察」→ `useProfileObservations` + `ProfileObservationsPanel`；桌面与移动端 Tab 共用数据 |

---

## 2. 已完成项（归档）

- [x] `loadObservationSpeciesForEvents` 导出，`/api/observations/mine` 复用。
- [x] 观鸟首页查询拆为 `getBirdObservationFeatured*` / `getBirdObservationRecentObservations`。
- [x] 提交表单子组件 + `observation-form-types.ts`。
- [x] `ObservationGamificationSync` + `observation-events.ts`。
- [x] 观察评论 API 与 `observation-comments.tsx` 使用 `Comment` 类型。
- [x] 阶段 B：`/api/observations/life-list` 使用 `mapDbSpecies`。
- [x] 阶段 C：`hooks/profile/use-profile-observations.ts`、`profile-observations-panel.tsx`；移动端 `MobileProfilePage` 增加「观察」Tab。
- [x] **阶段 D：完全解耦观察与项目/挑战**
  - 数据库迁移：`20260331120000_decouple_observations_from_projects_challenges.sql`
  - 移除 `observation_events.project_id` / `challenge_id` 列
  - 移除 `project_species` / `challenge_species` 策展关系表
  - `ObservationEvent` 类型去掉 `projectId`、`challengeId`、`project`、`challenge`
  - `Species` 类型去掉 `relatedProjects`、`relatedChallenges`
  - `Challenge` 类型去掉 `recommendedSpecies`
  - `Project` 类型去掉 `recommendedSpecies`
  - 删除 `loadProjectAndChallengeLinksForEvents`、`getCuratedProjectSpecies`、`getCuratedChallengeSpecies`
  - 删除 `ObservationSubmitContextBanner` 组件
  - 提交表单、观察详情、物种详情、挑战页、项目页全面清理项目/挑战引用
  - 提交 URL 不再带 `?project=` / `?challenge=` 参数
  - `tsc --noEmit` 零错误

---

## 3. 演进路线

### 阶段 A — 读模型分层 ✅

| 步骤 | 状态 | 内容 |
|------|------|------|
| A.1 | ✅ | 内部行类型：`lib/api/nature-observation-internal-types.ts` |
| A.2 | ✅ | `uniqueLinkedItems`：`lib/api/nature-observation-utils.ts` |
| A.3 | ✅ | `getSpeciesList` / `getSpeciesBySlug`：`lib/api/nature-observation-species.ts` |
| A.4 | ✅ | `getObservations` / `getObservationById` / `loadObservationSpeciesForEvents` → `lib/api/nature-observation-events.ts` |
| A.5 | ✅ | 首页与挑战项目 → `lib/api/nature-observation-homepage.ts`；`nature-observation-data.ts` 仅为 re-export |

### 阶段 B — `life-list` 与物种映射一致 ✅

### 阶段 C — 个人页「我的观察」 ✅

### 阶段 D — 完全解耦观察与项目/挑战 ✅

观察记录现在是完全独立的实体——不绑定任何项目或挑战。用户只需关注：时间、地点、物种、数量、行为。

---

## 4. 实施检查清单（每步）

1. `npx tsc --noEmit`
2. 观鸟首页、物种列表/详情、公开观察列表/详情、提交页、我的观察 Tab
3. 若有 DB 迁移：按项目规则执行 `pnpm db:push`（见 `docs` 内迁移说明）

---

## 5. 相关文件索引

| 用途 | 路径 |
|------|------|
| 读模型（聚合入口，仅 re-export） | `lib/api/nature-observation-data.ts` |
| 观察事件与加载器 | `lib/api/nature-observation-events.ts` |
| 首页与挑战项目 | `lib/api/nature-observation-homepage.ts` |
| 物种列表/详情 | `lib/api/nature-observation-species.ts` |
| 内部类型 | `lib/api/nature-observation-internal-types.ts` |
| 生涯鸟种 API（`mapDbSpecies`） | `app/api/observations/life-list/route.ts` |
| 个人页观察数据 / UI | `hooks/profile/use-profile-observations.ts`、`components/features/profile/profile-observations-panel.tsx` |
| 提交表单 | `components/features/bird-observation/observation-submit-form.tsx` 及同目录 `observation-submit-*.tsx` |
| 游戏化事件 | `lib/gamification/observation-events.ts`、`components/features/gamification/observation-gamification-sync.tsx` |
| 数据库迁移 | `supabase/migrations/20260331120000_decouple_observations_from_projects_challenges.sql` |

---

*文档随代码演进更新；重大架构变更时请在本节追加日期与摘要。*

> **2026-03-31** — 阶段 D 完成：观察与项目/挑战彻底解耦。drop 列 + drop 策展表 + 全链路代码清理。
