# Gamification Architecture & Guide

## Overview
本项目采用轻量级的游戏化（Gamification）系统，旨在通过积分（XP）、等级（Level）和徽章（Badges）激励用户的学习与分享行为。系统设计遵循“配置与逻辑分离”的原则，核心配置文件位于 `lib/gamification`。

## Directory Structure
```
lib/
  └── gamification/
       ├── badges.ts        # 徽章配置定义（所有徽章都在这里）
       └── types.ts         # 类型定义 (UserStats, Badge)
context/
  └── gamification-context.tsx  # 核心逻辑 (XP计算, 徽章检查, 状态管理)
components/
  └── features/
       └── gamification/    # UI 组件
            ├── level-progress.tsx
            ├── badge-gallery-dialog.tsx
            └── achievement-toast.tsx
```

## How to Add a New Badge
要在系统中添加新徽章，只需修改 `lib/gamification/badges.ts`，无需触碰 Context 逻辑。

### Step 1: Define Badge
在 `BADGES` 数组末尾添加新对象：
```typescript
{
    id: "new_badge_id",          // 唯一ID
    name: "新徽章名称",          // 显示名称
    description: "如何获得它的描述",
    icon: "🎉",                 // Emoji 或图片URL
    condition: (stats) => stats.projectsPublished >= 5, // 触发条件函数
}
```

### Step 2: (Optional) Update Condition Logic
如果你的触发条件依赖于新的统计维度（例如：新加了一个“被分享次数”），你可能需要：
1. 更新 `lib/gamification/types.ts` 中的 `UserStats` 接口。
2. 更新 `context/gamification-context.tsx` 中的 `checkBadges` 或数据获取逻辑，确保该维度被正确计算。

## Testing
我们使用 Playwright 进行 E2E 测试以确保奖励系统正常工作。
运行测试：
```bash
pnpm test:e2e
```
测试文件位于 `e2e/`.

## Key Logic

### Leveling Formula
- **Level** = `floor(sqrt(XP / 100)) + 1`
- **XP needed for next level** = `100 * Level^2`

### Badge Checking
徽章检查发生在 `GamificationProvider` 初始化时（拉取最新数据），以及用户触发特定动作（如点赞、发布项目）导致 `addXp` 或相关操作被调用时。我们采用**乐观更新 (Optimistic UI)** 策略，先在前端显示解锁 Toast，随后异步写入数据库。
