# Supabase 慢查询清单

基于 Supabase Query Performance 导出（`Supabase Query Performance (default).csv` 与 `(1).csv`）的筛选结果与后续优化记录。

## 筛选标准

- **值得优化的业务查询**：平均耗时 > 200–300ms 且调用次数较多（如每日上千次）。
- **可忽略**：Supabase 内部函数（`realtime.list_changes`、`_analytics.cleanup_old_logs`、postgres 元数据/诊断查询）、调用次数极少（如 1 次）的偶发查询。

## 当前导出分析结论

| 来源 | 查询 / 角色 | 调用次数 | 总/平均耗时 | 结论 |
|------|-------------|----------|-------------|------|
| supabase_admin | `realtime.list_changes($1,$2,$3,$4)` | 709651 | 总 90%+，均约 2ms | 内部 Realtime，忽略 |
| supabase_admin | `_analytics.cleanup_old_logs($1,$2)` | 334 | 均约 69ms | 内部清理任务，忽略 |
| postgres | 元数据/外键/策略等复杂 SQL | 1 | 1s+ | 偶发诊断，忽略 |

在导出的两份 CSV 中，**未发现**由 `authenticated` 或 `anon` 角色发起的、同时满足「高调用 + 高耗时」的业务 SQL。

## 后续使用方式

- 定期（如每月或大版本后）重新导出 Query Performance，按 **mean_time**、**calls** 排序。
- 只对 **rolname 为 `authenticated` 或 `anon`** 的条目做业务归因；对其中 mean_time > 200ms 且 calls 较高的查询，记录到下表并安排索引/重构与 EXPLAIN ANALYZE 验证。

## 待优化业务慢查询（按需填写）

| 查询摘要 | 平均耗时 | 调用次数 | 调用来源/页面 | 优化方案 | 状态 |
|----------|----------|----------|----------------|----------|------|
| （暂无） | — | — | — | — | — |

## 相关性能 Lint 处理与已执行优化

与查询性能相关的 Lint 已单独处理；当前已执行的优化如下。

### 已执行：删除重复索引

- 迁移：`supabase/migrations/20260305110000_drop_duplicate_indexes.sql`
- 内容：删除 3 组重复索引，保留等价索引之一，减少写入与存储开销；对依赖这些列的查询，规划器会使用保留的索引，无需改写 SQL。
- 验证：部署后可在 Supabase Linter 中确认 “Duplicate Index” 告警消失；若需对具体查询做计划验证，可对涉及 `discussion_replies.discussion_id`、`projects.created_at`、`user_badges(user_id, badge_id)` 的语句执行 `EXPLAIN (ANALYZE, BUFFERS)` 确认仍走索引。

### 未改动（可后续整理）

- **Auth RLS Init Plan**：RLS 策略中的 `auth.xxx()` 可改为 `(select auth.xxx())` 以减轻每行求值。
- **Multiple Permissive Policies**：同一表/角色/动作的多条 permissive 策略可合并为一条，减少策略求值次数。
