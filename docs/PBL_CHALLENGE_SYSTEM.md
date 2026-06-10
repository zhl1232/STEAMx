# PBL 挑战系统设计文档

## 概述

PBL（Project-Based Learning）挑战系统是平台的核心学习模块之一，将原本简单的"报名计数器"改造为一个 **PBL 驱动的双轨学习任务系统**。系统支持两种挑战类型——**限时挑战**（竞赛排名）和**长期挑战**（自主学习任务），并集成了多维评价、STEAM 雷达图、PBL 反思迭代等深度学习功能。

### 设计目标

1. **PBL 融合**：每个挑战提供情境故事、驱动问题、预期目标，引导学生进行基于项目的探究式学习
2. **双轨模型**：限时挑战激发竞争热情，长期挑战支持深度自主学习
3. **多维评价**：从创意性、实用性、技术难度、反思深度四个维度评价作品
4. **STEAM 雷达**：统一模型的五维能力图谱，含难度系数和递减收益算法

---

## 架构总览

```
┌──────────────────────────────────────────────────────────────┐
│                        前端层                                 │
│                                                              │
│  社区页（三分区）  挑战详情页（双轨渲染）  Share页（PBL表单）    │
│  ChallengeCard     PBL信息/阶段引导       问题重述/试错/反思    │
│  (限时/长期差异)   SubmissionGallery       挑战关联横幅          │
│                    RatingStars                                │
│                                                              │
│  管理后台：挑战Tab + 项目审核STEAM权重校正                      │
│  个人主页：SteamRadarChart（新RPC数据源）                       │
├──────────────────────────────────────────────────────────────┤
│                        API 层                                 │
│                                                              │
│  公共 API                          管理 API                   │
│  GET /api/challenges               CRUD /api/admin/challenges │
│  GET /api/challenges/[id]          PATCH .../[id]/status      │
│  GET /api/challenges/[id]/submissions                         │
│                                                              │
│  评分 API                          雷达 API                   │
│  POST /api/challenges/ratings      GET /api/users/[id]/       │
│  GET  .../ratings/[projectId]          steam-radar             │
├──────────────────────────────────────────────────────────────┤
│                       数据库层                                 │
│                                                              │
│  challenges (扩展)    challenge_ratings     steam_weight_      │
│  projects (扩展)      challenge_completions   defaults         │
│                                                              │
│  RPC: calculate_steam_radar                                   │
│  RPC: complete_evergreen_challenge                            │
│  RPC: settle_timed_challenge                                  │
└──────────────────────────────────────────────────────────────┘
```

---

## 双轨挑战模型

两种挑战类型共用同一张 `challenges` 表和同一套 PBL 字段，通过 `challenge_type` 字段区分行为差异：

### 限时挑战 (timed)

**生命周期**: `draft → active → ended`

- 有明确的开始和截止时间
- 用户在截止前提交一次作品，不可更新
- 社区互评采用竞争排名导向
- 管理员手动触发结算：批量排名、前三名发奖（金银铜徽章 + 硬币）
- 所有参与者获得 +20 XP 参与奖

### 长期挑战 (evergreen)

**生命周期**: `draft → active（→ archived）`

- 无截止日期，长期可用
- 用户随时提交作品，允许迭代更新
- 互评为反馈学习导向，无排名
- 作品审核通过时即时个人结算：+20 XP + PBL 行为加分（+10 XP）
- 管理员可归档下线不再需要的挑战

### 对比表

| 维度     | 限时挑战                | 长期挑战                    |
| -------- | ----------------------- | --------------------------- |
| 时间     | 有 start/end date       | 无截止日                    |
| 状态流   | draft → active → ended  | draft → active（→ archived）|
| 按钮文案 | "立即报名"              | "开始挑战"                  |
| 提交     | 截止前 1 次，不可更新   | 随时提交，允许迭代更新      |
| 互评     | 竞争排名导向            | 反馈学习导向，无排名        |
| 结算     | 管理员 ended 时批量结算 | 作品审核通过时即时个人结算  |
| 奖励     | 排名奖 + 参与 XP        | 完成奖 + PBL 行为加分      |
| 列表展示 | "X 人参与，剩余 N 天"   | "已有 X 人完成"             |

---

## PBL 字段设计

### 挑战级 PBL 字段（challenges 表）

| 字段              | 类型     | 说明                                                  |
| ----------------- | -------- | ----------------------------------------------------- |
| `scenario`        | text     | 情境故事：描述一个引人入胜的问题情境                  |
| `driving_question`| text     | 驱动问题：学生需要探究的核心问题                      |
| `expected_outcome`| text     | 预期目标：完成挑战后应产出什么                        |
| `constraints`     | text[]   | 约束条件：限制条件列表                                |
| `resources`       | jsonb    | 资源脚手架：`[{title, url, type}]`                    |
| `stages`          | jsonb    | 阶段引导：`[{title, description, hint}]`              |
| `steam_weights`   | jsonb    | STEAM 五维权重：`{S:30, T:40, E:20, A:10, M:0}`      |
| `difficulty_stars` | smallint | 难度等级（1-6 星），用于 STEAM 雷达难度系数计算      |

### 作品级 PBL 字段（projects 表）

| 字段                | 类型  | 说明                                                        |
| ------------------- | ----- | ----------------------------------------------------------- |
| `challenge_id`      | int   | 关联的挑战 ID                                               |
| `problem_statement` | text  | 用自己的话重述驱动问题                                      |
| `iterations`        | jsonb | 试错记录：`[{description, result, created_at}]`             |
| `reflection`        | text  | 反思总结                                                    |
| `steam_weights`     | jsonb | 可选的 STEAM 权重覆盖（审核员校正用），NULL 走默认 fallback |

---

## 多维评价系统

### challenge_ratings 表

每个用户对每个作品可提交一次四维评分（1-5 星），支持更新：

| 维度              | 说明               |
| ----------------- | ------------------ |
| `creativity`      | 创意性             |
| `practicality`    | 实用性             |
| `technical`       | 技术难度           |
| `reflection_depth`| 反思深度           |

### 业务规则

- **禁止自评**：API 层校验 `project.author_id !== user.id`
- **Upsert 语义**：每人每作品一条记录，可多次修改
- **综合分 = 四维均值的平均**
- 限时挑战：评分影响排名
- 长期挑战：评分作为反馈参考，>=4.0 标记为"精选"

---

## STEAM 雷达图算法

### 设计原则

1. **统一数据源**：所有活动（完成项目 + 完成挑战）通过同一套 `steam_weights` 贡献五维分数
2. **难度区分**：高难度活动贡献显著更多，低难度有软天花板
3. **递减收益**：同难度重复完成的边际收益递减，鼓励多样性
4. **后期可扩展**：预留 AI 自动校正权重的入口

### 权重来源（两级 fallback）

```
优先级：
1. project.steam_weights     -- 审核员手动校正的（非 NULL 时使用）
2. 子分类默认权重             -- 来自 steam_weight_defaults 表 / lib/config/subcategory-steam-weights.ts
3. 分类默认权重               -- 兜底
```

每个子分类预配了差异化的 STEAM 权重。例如：
- "物理实验" → `{S:35, T:5, E:5, A:0, M:15}` — 以科学为主，兼有数学
- "机器人" → `{S:10, T:25, E:25, A:0, M:5}` — 技术和工程并重
- "绘画" → `{S:0, T:0, E:0, A:40, M:5}` — 纯艺术

挑战的权重由管理员创建时直接设定，不走 fallback。

### 难度系数

项目/挑战的 `difficulty_stars`（1-6 星）映射为乘数：

| 星级 | 难度档 | 乘数 |
| ---- | ------ | ---- |
| 1-2  | 入门   | 0.5  |
| 3-4  | 进阶   | 1.0  |
| 5-6  | 挑战   | 2.0  |

### 计算公式

**第一步：累计原始分**

对每个 STEAM 维度 D（S/T/E/A/M），遍历用户的所有完成记录：

```
raw_D = SUM( weight_D × difficulty_mult × 1/√n )
```

- `weight_D` = 该活动在维度 D 的 steam_weight 值
- `difficulty_mult` = 难度乘数（0.5 / 1.0 / 2.0）
- `n` = 该用户在**该难度档**完成的第几个活动（跨维度共享计数）
- `1/√n` = 递减系数（第 1 个 = 100%, 第 4 个 = 50%, 第 9 个 = 33%）

**第二步：原始分转展示分**

```
display_D = 100 × (1 - e^(-raw_D / K))    // K = 200
```

连续 sigmoid 曲线，渐近趋向 100 但永远到不了。

### 效果参考

以 S 维度为例，完成科学类活动（weight_S=30）：

| 用户行为                    | 累计原始分 | 展示分 | 段位       |
| --------------------------- | ---------- | ------ | ---------- |
| 10 个入门(2 星)             | ~82        | 34     | 基础       |
| 50 个入门(2 星)             | ~162       | 56     | 进阶区卡住 |
| 10 个进阶(4 星)             | ~164       | 56     | 进阶       |
| 5 个挑战(6 星)              | ~216       | 66     | 进阶       |
| 混合: 5 入门+5 进阶+3 挑战  | ~310       | 79     | 挑战段     |

**关键特性**：纯粹靠刷低星项目会卡在 ~56 分左右，无法突破进阶区；需要中高难度活动才能有效提升。

### 段位参考线

UI 叠加三条参考线作为目标引导：

| 参考线         | 展示分 | 含义                                       |
| -------------- | ------ | ------------------------------------------ |
| 基础线         | 40     | 只靠入门项目容易达到的区域                 |
| 进阶线         | 75     | 需要中等+难度活动才能高效突破              |
| 挑战线（渐近） | 100    | 需要高难度活动才能接近                     |

当维度分数卡在某条线附近时，显示引导文案：

| 状态                   | 文案                                        |
| ---------------------- | ------------------------------------------- |
| 接近 40 且无进阶活动    | "完成一个 3 星以上的项目来突破基础段"        |
| 接近 75 且无挑战活动    | "挑战高难度项目可以解锁挑战段（75+）"        |
| 维度为 0               | "还没探索过这个领域，去看看相关项目吧"       |

### RPC 返回格式

```json
{
  "S": { "raw": 310, "display": 79, "tier": "advanced" },
  "T": { "raw": 85,  "display": 35, "tier": "foundation" },
  "E": { "raw": 220, "display": 67, "tier": "intermediate" },
  "A": { "raw": 15,  "display": 7,  "tier": "none" },
  "M": { "raw": 120, "display": 45, "tier": "intermediate" }
}
```

前端 API 额外附加引导文案（`guidance` 字段）。

---

## 结算逻辑

### 限时挑战结算

管理员点击"结束并结算" → 后端调用 `settle_timed_challenge(challenge_id)`：

1. 查询该挑战所有 `approved` 项目
2. 计算每个项目的 `challenge_ratings` 四维平均分
3. 按综合得分降序排名
4. 发放奖励：
   - 所有提交者: +20 XP（参与奖）
   - 第 3 名: 限定徽章 + 5 硬币
   - 第 2 名: 限定徽章 + 10 硬币
   - 第 1 名: 限定徽章 + 20 硬币
5. 状态设为 `ended`
6. 返回排名结果 JSON

### 长期挑战结算

作品审核通过时自动触发 `complete_evergreen_challenge(user_id, challenge_id, project_id)`：

1. INSERT INTO `challenge_completions`（ON CONFLICT DO NOTHING 防重复）
2. 若新插入成功：
   - `completions_count += 1`
   - 发放 +20 XP
   - 填写了 reflection 且 iterations >= 1 条：额外 +10 XP（激励 PBL 行为）
   - 更新用户 STEAM 雷达数据

---

## 文件结构

### 数据库迁移

```
supabase/migrations/
  20260318100000_add_challenge_id_to_projects.sql    # challenge_id 列（已存在）
  20260319000000_challenge_pbl_system.sql             # 主迁移文件
```

### 后端 API

```
app/api/
  admin/challenges/
    route.ts                     # GET（列表）+ POST（创建）
    [id]/route.ts                # PATCH（编辑）+ DELETE（删除）
    [id]/status/route.ts         # PATCH（状态切换 + 结算）
  challenges/
    route.ts                     # GET（公共列表，三分组）
    [id]/route.ts                # GET（详情）
    [id]/submissions/route.ts    # GET（作品列表）
    ratings/
      route.ts                   # POST（提交评分）
      [projectId]/route.ts       # GET（评分摘要）
  users/[id]/steam-radar/
    route.ts                     # GET（雷达数据）
```

### 前端组件

```
components/features/challenge/
  rating-stars.tsx               # 多维评分控件
  pbl-info.tsx                   # PBL 信息展示区
  stage-guide.tsx                # 阶段引导展示
  submission-gallery.tsx         # 作品画廊

components/admin/
  challenge-management.tsx       # 管理后台挑战管理

components/features/profile/
  steam-radar-chart.tsx          # STEAM 雷达图（重写）
```

### 类型定义

```
lib/mappers/types.ts             # Challenge/ChallengeRating/RatingSummary/SteamRadarResult
lib/types/database.ts            # DB 层类型
lib/supabase/types.ts            # Supabase 表类型
lib/config/subcategory-steam-weights.ts  # 子分类 STEAM 权重配置
```

### Context

```
context/community-context.tsx    # 挑战分组（activeTimed/evergreen/ended）
context/project-context.tsx      # addProject 写入 PBL 字段
```

---

## 管理后台操作指南

### 创建挑战

1. 进入管理员控制台 → 挑战 Tab
2. 点击"创建挑战"
3. 选择类型：限时竞赛 / 长期学习
4. 填写基础信息：标题、描述、封面图、标签、难度
5. 填写 PBL 内容：情境故事、驱动问题、预期目标、约束条件、参考资源
6. 设置阶段引导（可选）
7. 调整 STEAM 权重滑块
8. 创建后默认为 `draft` 状态

### 发布与管理

- **限时挑战**：draft → "发布"（active）→ "结束并结算"（ended）
- **长期挑战**：draft → "上线"（active）→ "归档下线"（archived，可选）
- 仅 `draft` 状态的挑战可删除

### 审核时校正 STEAM 权重

在项目审核页（`/admin/projects/[id]`）：
1. 默认显示该项目子分类的默认权重（只读）
2. 点击"校正权重"展开 5 个滑块
3. 调整后保存，写入 `projects.steam_weights`
4. 该项目后续在 STEAM 雷达计算中使用校正后的权重

---

## 与现有系统集成

### 游戏化系统

- 挑战参与/完成发放 XP，纳入等级系统
- 限时挑战前三名发放硬币，纳入经济系统
- PBL 行为（反思+迭代）额外加分
- STEAM 雷达数据来自项目完成和挑战完成两个数据源

### 项目审核流程

- 项目审核通过时自动检查是否关联长期挑战
- 若关联且挑战为 active 状态，自动触发 `complete_evergreen_challenge`
- 审核员可在审核时校正项目的 STEAM 权重

### 社区模块

- 社区页挑战列表按三分区展示（限时进行中/常驻学习/已结束）
- ChallengeCard 按类型差异化渲染
- 挑战详情页提供完整 PBL 信息和作品评分交互

---

## 未来扩展方向

1. **AI 权重校正**：接入 AI 模型自动分析项目内容，建议 STEAM 权重分配
2. **多阶段连环挑战**：`parent_challenge_id` 实现阶段 1 → 阶段 2 的递进式挑战
3. **导师点评**：专家标记的高亮评论，可颁发"专家认可"印章
4. **PBL 学习档案**：一键导出包含问题、迭代、反思的精美 PDF
5. **社区集体目标**：如"本周社区完成 100 个挑战"的集体激励

---

## 相关文档

- [PBL_CHALLENGE_CONTENT_MODEL.md](/home/arron/work/docs/PBL_CHALLENGE_CONTENT_MODEL.md) - 讨论“真正的 PBL 挑战”在内容层应该怎样组织，避免退化成教程或空泛目标
- [PBL_STAGE_FLOW_REDESIGN.md](/home/arron/work/docs/PBL_STAGE_FLOW_REDESIGN.md) - 阶段引导+阶段提交结合的工作台重构与 AI 指导设计（已落地：`challenge_stage_progress` 表、阶段产出 API、`stage-workspace` 组件、Qwen 阶段教练）
