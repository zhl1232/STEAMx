# Gamification Architecture & Guide

## Overview
本项目采用轻量级的游戏化（Gamification）系统，旨在通过积分（XP）、等级（Level）和徽章（Badges）激励用户的学习与分享行为。系统设计遵循“配置与逻辑分离”的原则，核心配置文件位于 `lib/gamification`。

## Directory Structure
```
lib/
  └── gamification/
       ├── badges.ts        # 徽章配置定义（所有徽章都在这里）
       └── types.ts         # 类型定义 (UserStats, Badge, BadgeTier)
context/
  └── gamification-context.tsx  # 核心逻辑 (XP计算, 徽章检查, 状态管理)
components/
  └── features/
       └── gamification/    # UI 组件
            ├── level-progress.tsx
            ├── badge-gallery-dialog.tsx
            └── achievement-toast.tsx
```

## 徽章体系 (Dynamic Badges)

### 四档阶梯 (铜 / 银 / 金 / 白金)
阶梯式徽章统一为 **铜 (bronze) / 银 (silver) / 金 (gold) / 白金 (platinum)** 四档，共 16 个系列 × 4 档 = 64 枚：

| 系列 | 度量 | 铜 | 银 | 金 | 白金 |
|------|------|-----|-----|-----|------|
| 点赞 | likesGiven | 1 | 10 | 50 | 200 |
| 评论 | commentsCount | 1 | 10 | 50 | 200 |
| 发布 | projectsPublished | 1 | 5 | 10 | 30 |
| 收藏 | collectionsCount | 1 | 10 | 50 | 200 |
| 科学专家 | scienceCompleted | 5 | 20 | 50 | 100 |
| 技术达人 | techCompleted | 5 | 20 | 50 | 100 |
| 工程师 | engineeringCompleted | 5 | 20 | 50 | 100 |
| 艺术家 | artCompleted | 5 | 20 | 50 | 100 |
| 数学家 | mathCompleted | 5 | 20 | 50 | 100 |
| 创作者 | projectsPublished | 1 | 5 | 10 | 50 |
| 社交达人 | commentsCount + repliesCount | 10 | 50 | 200 | 500 |
| 人气之星 | likesReceived | 10 | 100 | 500 | 2000 |
| 成就里程碑 | projectsCompleted | 5 | 25 | 100 | 500 |
| 等级晋升 | level | 5 | 25 | 50 | 100 |
| 挑战赛 | challengesJoined | 3 | 10 | 50 | 100 |
| 连续打卡 | consecutiveDays | 3 | 7 | 30 | 90 |

### 单档 / 手动授予
- **首步成就**：第一步、初级探索者、点赞新手、发言新秀、首次发布、收藏入门、社交蝴蝶、挑战新人（条件为达到 1 次或等效）。
- **稀有限定**：平台先驱、漏洞猎人、贡献者、测试先锋、周年纪念；`condition` 恒为 false，仅由后端/管理员写入 `user_badges`。

### 迁移与回填 (方案 A)
1. 执行迁移 `20260211100001_dynamic_badges_insert.sql`，写入新 77 枚徽章定义。
2. 运行回填脚本：`npx tsx scripts/backfill-badges.ts`（需设置 `NEXT_PUBLIC_SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY`），按当前用户统计为每人写入应得的新徽章。
3. 执行迁移 `20260211100002_dynamic_badges_remove_old.sql`，删除 `user_badges` 中对旧 badge_id 的引用，并删除 `badges` 表中的旧 id。

## How to Add a New Badge
要在系统中添加新徽章，只需修改 `lib/gamification/badges.ts`，无需触碰 Context 逻辑。

### 阶梯徽章
在 `TIERED_SERIES` 中增加配置，或按现有系列用 `buildTieredBadges` 生成四档徽章（id 格式：`{seriesKey}_{tier}`）。

### 单档徽章
在 `SINGLE_BADGES` 或 `RARE_BADGES` 数组末尾添加新对象：
```typescript
{
    id: "new_badge_id",
    name: "新徽章名称",
    description: "如何获得它的描述",
    icon: "🎉",
    kind: "single",
    seriesKey: "first_steps",  // 或 "rare"
    condition: (stats) => stats.projectsPublished >= 5,
}
```

### 新增统计维度时
若触发条件依赖新的统计维度，需：
1. 更新 `lib/gamification/types.ts` 中的 `UserStats`。
2. 确保 `get_user_stats_summary` RPC 与前端拉取逻辑返回该维度。

## Testing
- 单元测试：`pnpm test`，徽章逻辑见 `__tests__/badges.test.ts`。
- E2E：`pnpm test:e2e`，测试位于 `e2e/`。

## Key Logic

### Leveling Formula
- **Level** = `floor(sqrt(XP / 100)) + 1`
- **XP needed for next level** = `100 * Level^2`

### Badge Checking
徽章检查发生在 `GamificationProvider` 初始化时（拉取最新数据），以及用户触发特定动作（如点赞、发布项目）导致 `addXp` 或相关操作被调用时。采用**乐观更新 (Optimistic UI)**：先在前端显示解锁 Toast，再异步写入 `user_badges`。
