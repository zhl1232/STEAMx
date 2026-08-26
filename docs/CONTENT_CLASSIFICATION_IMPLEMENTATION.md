# 课程、项目与挑战内容分级统一开发设计

> 状态：代码、迁移文件和后台审核已完成；6 个内容分级相关迁移已通过 `pnpm db:push` 执行。公开三轴展示已开启，发布门禁仍保持关闭。
> 最后复核：2026-08-26。
> 目标发布对象：中国家庭用户；内容覆盖 3–16 岁儿童与青少年。
>
> 共享领域层、候选/审核 API、公开三轴 DTO、年龄与三档难度筛选、推荐 v2、排名/SEO/AI 过滤、阶段一/二迁移和运维脚本已经落地。线上内容已完成首轮人工复核；`public_v1_enabled=true` 负责公开 reviewed 三轴，`enforcement_enabled=false` 继续保留现有发布流程。预检与审核报告是按需运维工具，不会在开发启动、页面请求或每次构建时自动运行。
>
> 本文同时作为实施规格和上线 runbook。早期章节中的“拟新增”“建议修改”保留为设计依据；实际入口以当前分支代码、迁移和 `PROJECT_INDEX.md` 为准。

## 1. 范围与不变量

### 1.1 要解决的问题

当前课程、项目和挑战同时暴露年龄、星级、班级、年龄段和课时轨道等多套概念。星级既承担内部能力计算，又被前台当成难度、适龄和安全的替代物，导致：

- 家长无法判断“孩子能不能开始”“需要多少帮助”“任务本身有多难”；
- 低星项目仍可能包含剪刀、针、热熔胶、切割或热源；
- 课程导入把 3+/4+/5+ 机械转换为 2/3/4 星，混淆年龄与难度；
- 推荐 RPC 用 6-9、10-12、13-15 年龄段猜星级，而不是匹配内容本身；
- 用户资料中的 birth_date 大多为空，现有年龄推荐实际没有生效。

### 1.2 统一模型

课程、项目、挑战采用三个独立轴：

| 轴 | 公开文案 | 语义 |
|---|---|---|
| 适龄 | 6 岁起 | 建议从哪个年龄开始尝试，不是访问门槛 |
| 难度 | 入门 / 进阶 / 挑战 | 任务复杂度、先备能力和推理负荷 |
| 成人支持 | 可独立完成 / 建议成人陪同 / 需成人协助 | 安全风险、工具使用和过程中的协助程度 |

三个轴不能互相推断。例如“入门”不等于“可独立完成”，“6 岁起”也不等于 6 岁以上禁止访问。

### 1.3 产品与数据不变量

- 中文前台不显示 1–6 星或“6 星传说”等星级表达。
- 现有 difficulty_stars 1–6 保留，继续供 STEAM 计算、历史统计、奖励快照和兼容读取使用。
- 难度公开映射固定为 1–2 入门、3–4 进阶、5–6 挑战。
- recommended_max_age 为 NULL 表示“从起始年龄开始，没有设定上限”，不是未知值。
- 年龄筛选只改变排序和提示，不从结果中硬排除超出建议年龄的内容。
- 阶段二的公开内容必须同时满足已有内容状态/安全审核条件和分级审核条件；阶段一允许历史未复核内容沿用旧可见性，但不能展示精确适龄标签。
- 影响分级的内容修改会使分级失效并重新进入审核；不能继续携带旧标签公开。
- 作者可以提交候选值，但不能写入 reviewed 状态、审核人或审核时间。
- 课程首期按课程级标注，课时继承课程三轴，不在每个课时重复落库。
- K–12 只用于后台国际化、导出和数据交换，不作为中文前台的主分级体系。
- XP、徽章、游乐场关卡等级等独立成长体系不在本次范围内。

### 1.4 当前线上基线

本次设计以 2026-08-26 只读核查为基线：

- 5 门课程、316 节课；
- 214 个已发布项目；
- 当前没有已发布挑战；
- 共 251 个内容项，其中 219 个已发布，全部已完成首轮人工复核；
- 已发布内容 `published_unreviewed=0`、`published_incomplete=0`、非法内部星级为 0；
- 规则扫描命中 152 条安全关键词提示，其中 136 条来自已发布内容；这些提示用于复核提醒，不等同于待复核记录，也不自动决定成人支持度；
- 公开三轴展示开关为 `public_v1_enabled=true`，发布门禁为 `enforcement_enabled=false`。

这些数字用于迁移预检和发布门槛，不写死在业务代码中。

## 2. 当前代码基线与缺口

| 当前入口 | 已有行为 | 本次目标 |
|---|---|---|
| components/ui/difficulty-stars.tsx | 渲染 1–5 颗星，6 星特殊显示“传说” | 新增三档难度标签适配器；保留旧组件仅供内部/过渡调用，前台不再渲染星级 |
| components/explore/explore-for-you-rail.tsx | 推荐横栏仍把 difficulty_stars 显示成“X 星” | 改用公开难度文案；阶段一对普通用户隐藏未 reviewed 内容的标签且不显示“审核中”，该提示只在后台队列出现；阶段二只接收 reviewed 内容 |
| components/admin/challenge-management.tsx | 管理端仍编辑/显示 difficulty_stars | 同时编辑三轴候选；星级只作为内部校准字段 |
| components/features/courses/course-board.tsx | 从标题提取“小班 3+ / 中班 4+ / 大班 5+” | 从课程分级 DTO 读取“X 岁起、难度、支持度”，不再解析标题 |
| scripts/upsert-courseware.mjs | 把小班/中班/大班年龄机械映射成星级 | 导入候选年龄，难度只保留原内部值，支持度进入待复核 |
| lib/api/explore-data.ts | difficulty 参数含 easy、medium、hard、数字和数字区间 | 规范为 beginner、intermediate、challenge，并兼容旧参数 |
| projects.difficulty | 旧项目文本字段仍可能为 easy/medium/hard | 保留数据库字段用于旧写入/读取兼容；公开语义以 difficulty_stars 映射后的 difficultyBand 为准 |
| lib/home/recommendations.ts | 从 birth_date 推导年龄段，再传给按星级匹配的推荐 RPC | 传精确年龄，直接匹配内容适龄字段；无年龄时保留热门回退 |
| 历史年龄推荐 RPC（p_age_group） | 以 6-9、10-12、13-15 年龄段和星级硬匹配 | 保留短期兼容 wrapper，将年龄段转换为代表起始年龄；新业务改用精确年龄 RPC |
| lib/api/courses.ts | 公开读取 approved 课程 | reviewed 返回公开三轴；阶段一 unreviewed 返回 classification=null，管理员读取可见候选 |
| 项目/挑战公共查询 | 依赖 status 和 moderation_state | 增加分级状态过滤，但不改变已有安全审核口径 |
| app/api/admin/courses/[id]/route.ts | 管理员可编辑难度和课程状态 | 增加候选字段编辑、复核权限和发布前门禁 |
| app/api/admin/projects/[id]/route.ts | 管理端编辑材料、步骤和 difficulty_stars | 内容变更自动使分级失效；审核字段只能由复核接口写入 |
| app/api/admin/challenges/* | 管理员编辑挑战和 active/ended 状态 | 增加挑战分级审核和状态转换门禁 |
| lib/seo/json-ld.ts | Course/LearningResource JSON-LD 不含年龄 | 仅对已复核内容增加 typicalAgeRange 和 educationalLevel |
| lib/ai/tutor/* | 部分提示或场景可能使用星级 | AI 上下文改为三档难度、适龄和成人支持，不向用户复述内部星级 |

## 3. 目标代码边界

### 3.1 建议新增的共享模块

~~~text
lib/content-classification/
  types.ts        # 数据库行、领域对象、公开 DTO、审核 DTO
  constants.ts    # 三档难度、支持度、审核状态、年龄边界
  labels.ts       # 中文文案、年龄/学段/K–12 展示
  mapping.ts      # difficulty_stars 与公开难度映射
  rules.ts        # 候选值规则和安全关键词
  validation.ts   # 输入、发布完整性、权限和变更触发判断
  queries.ts      # 公开过滤、年龄命中和排序片段
  json-ld.ts      # typicalAgeRange / educationalLevel 映射
~~~

共享模块必须是纯函数优先，不能在组件中复制年龄或星级映射。数据库行使用 snake_case，领域对象和 API 使用 camelCase，转换只允许在一个 mapper 中完成。

### 3.2 建议修改的页面与组件

~~~text
app/explore/page.tsx
app/courses/page.tsx
app/courses/[courseId]/page.tsx
app/project/[id]/page.tsx
app/pbl/[id]/page.tsx
components/ui/difficulty-stars.tsx
components/features/courses/course-board.tsx
components/explore/*
components/admin/*
components/features/project/*
components/features/challenges/*
lib/ai/tutor/student-profile.ts
lib/ai/tutor/prompts/*
lib/seo/json-ld.ts
~~~

已有组件可以先通过 adapter 逐步迁移，不能一次删除 difficulty-stars.tsx，避免内部奖励/统计读取被误删。

### 3.3 建议新增的迁移和脚本

迁移按阶段分别创建，不能把“加字段”和“强制发布门禁”放在同一次推送中：

~~~text
supabase/migrations/YYYYMMDDHHMMSS_content_classification_fields.sql
supabase/migrations/YYYYMMDDHHMMSS_content_classification_gate.sql
scripts/content-classification-preflight.mjs
scripts/content-classification-candidates.mjs
scripts/content-classification-review-report.mjs
scripts/content-classification-watchdog.mjs
~~~

实际时间戳必须按创建时刻生成，不能复用本文示例名。

## 4. 领域模型与数据库字段

### 4.1 三张内容表的统一字段

在 courses、projects、challenges 上增加同名字段：

| 字段 | 类型 | NULL | 说明 |
|---|---|---:|---|
| recommended_min_age | smallint | 是（阶段 1；reviewed/公开时必填） | 推荐起始年龄，3–16 |
| recommended_max_age | smallint | 是 | 只有成熟度或安全边界明确时填写 |
| support_level | varchar(24) | 是（阶段 1；reviewed/公开时必填） | independent / guided / adult_required |
| classification_status | varchar(16) | 否，默认 unreviewed | unreviewed / reviewed |
| classification_source | varchar(16) | 是（reviewed 时必须为 manual） | rules_v1 / manual |
| classification_reviewed_at | timestamptz | 是 | 复核通过时间 |
| classification_reviewed_by | uuid | 是 | 复核人；建议引用 profiles.id ON DELETE RESTRICT |
| classification_revision | bigint | 否，默认 0 | 内容每次触发失效时递增，防止审核覆盖新编辑 |

推荐约束：

~~~sql
(recommended_min_age IS NULL OR recommended_min_age BETWEEN 3 AND 16)
AND (recommended_max_age IS NULL
  OR recommended_max_age BETWEEN recommended_min_age AND 16)
AND (support_level IS NULL OR support_level IN ('independent', 'guided', 'adult_required'))
AND classification_status IN ('unreviewed', 'reviewed')
AND (classification_source IS NULL OR classification_source IN ('rules_v1', 'manual'))
AND classification_revision >= 0
~~~

阶段 1 的 DDL 不能对 recommended_min_age/support_level 使用 NOT NULL，因为历史行和草稿需要逐步复核；classification_status 则统一设为 NOT NULL DEFAULT 'unreviewed'。阶段 2 不把三轴列全局改成 NOT NULL，而是由 reviewed 完整性约束和发布门禁共同保证：草稿可以缺值，公开 reviewed 内容不能缺值。recommended_max_age=NULL 只有在 status=reviewed 且 min_age 已存在时才解释为“无上限”；unreviewed 行的 NULL 仍表示“尚未确认”，所有读取逻辑必须先检查 status。

classification_reviewed_by 使用 ON DELETE RESTRICT，工作人员账号只能停用/归档，不能物理删除；这样历史审核不会因为 reviewer 删除而失去完整性。若未来必须删除账号，应先转移审核归属并写入新的审计事件。

### 4.2 审核完整性

复核状态为 reviewed 时必须同时满足：

~~~text
recommended_min_age IS NOT NULL
AND support_level IS NOT NULL
AND difficulty_stars BETWEEN 1 AND 6
AND classification_source = 'manual'
AND classification_reviewed_at IS NOT NULL
AND classification_reviewed_by IS NOT NULL
~~~

classification_source 表示最后一次有效结论的来源。规则生成的候选只能是 rules_v1 + unreviewed；工作人员确认后必须改为 manual。这样不会把“规则推断”误当成“人工复核”。

### 4.3 索引与公开过滤

建议增加：

~~~sql
CREATE INDEX ... ON courses (status, classification_status, recommended_min_age);
CREATE INDEX ... ON projects (status, moderation_state, classification_status, recommended_min_age);
CREATE INDEX ... ON challenges (status, classification_status, recommended_min_age);
~~~

公开查询统一使用以下逻辑：

~~~text
课程：status = approved AND classification_status = reviewed
项目：status = approved AND moderation_state = approved
       AND classification_status = reviewed
挑战：status IN (active, ended) AND classification_status = reviewed
~~~

第一阶段为了不影响旧内容，可以继续公开未复核内容，但不能显示精确三轴标签；第二阶段完成全量复核后启用上述完整过滤和数据库门禁。

### 4.4 审核历史表

建议新增 content_classification_reviews，保存每次候选、通过、退回和失效事件；当前内容表只保存最新结论。

~~~text
id bigint primary key
content_type varchar(16) not null
content_id bigint not null
decision varchar(16) not null  # candidate / approve / return / invalidate
previous_value jsonb
new_value jsonb
reason text
actor_type varchar(16) not null  # user / system / migration
actor_id uuid
actor_label text
idempotency_key uuid
created_at timestamptz not null default now()
~~~

content_type/content_id 采用应用层联合约束和索引，不能用跨三张表的单一外键。actor_type=user 时 actor_id 必填并引用 profiles.id；system/migration 事件允许 actor_id=NULL，但 actor_label 必填（例如 classification-candidate-script 或 migration-20260824）。审核事件只允许 staff/service role 写入，普通用户和作者不可删除。查询队列按 content_type、content_id、created_at 倒序建立索引；idempotency_key 在同一内容下唯一。

### 4.5 课程课时继承

课程详情和课时 DTO 都可以包含 classification 字段，但字段唯一来源是 courses：

- 课程卡、课程详情读取课程分级；
- 课时页通过 course_id 继承课程分级；
- 不给 course_lessons 增加同名字段；
- 课程调整三轴或进入待复核时，所有课时的公开标签同步失效；
- 课时正文、材料、步骤或课时增删会使父课程回到 unreviewed。

## 5. 共享 TypeScript 契约

### 5.1 核心类型

~~~ts
export type DifficultyBand =
  | "beginner"
  | "intermediate"
  | "challenge";

export type SupportLevel =
  | "independent"
  | "guided"
  | "adult_required";

export type ClassificationStatus = "unreviewed" | "reviewed";
export type ClassificationSource = "rules_v1" | "manual";
export type EducationStage = "preschool" | "primary" | "junior" | "senior";

export interface ContentClassification {
  recommendedMinAge: number | null;
  recommendedMaxAge: number | null;
  difficultyBand: DifficultyBand | null;
  supportLevel: SupportLevel | null;
  status: ClassificationStatus;
  source: ClassificationSource | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  revision: number;
}

export interface PublicClassification {
  recommendedMinAge: number;
  recommendedMaxAge: number | null;
  ageLabel: string;
  difficultyBand: DifficultyBand;
  difficultyLabel: string;
  supportLevel: SupportLevel;
  supportLabel: string;
  educationStage: EducationStage;
  educationStageLabel: string;
  status: "reviewed";
}

/** 公开课程、项目、挑战 DTO 的统一分级字段；阶段一未复核时为 null。 */
export interface PublicClassificationEnvelope {
  classification: PublicClassification | null;
}

export interface AdminClassification extends ContentClassification {
  source: "rules_v1" | "manual" | null;
}
~~~

`educationStage` 是稳定的机器值，`*Label` 和 `ageLabel` 是按请求 locale 生成的展示文案；若暂时只有中文，仍须保留稳定 code，不能让客户端解析中文字符串。课程、项目、挑战的公共 DTO 都复用 `PublicClassificationEnvelope`，因此阶段一未复核行明确返回 `classification: null`，而不是省略字段或返回候选对象。

公开 DTO 不应暴露 difficulty_stars。管理员 DTO 可以同时返回 difficulty_stars 和候选来源，方便校准历史数据。

数据库不新增 difficultyBand 列。difficultyBand 始终由 difficulty_stars 在 mapper/helper 中派生，避免两个难度字段漂移；只有在未来决定完全脱离旧星级时，才另起版本设计快照迁移。

### 5.2 纯函数契约

建议提供以下函数并为每个函数写独立单测：

~~~ts
mapDifficultyStars(stars: number | null): DifficultyBand | null
formatStartingAge(minAge: number, maxAge: number | null): string
getDomesticEducationStage(age: number): EducationStage | null
formatEducationStageLabel(stage: EducationStage): string
getK12Level(age: number): string | null
isAgeMatch(age: number, classification: PublicClassification): boolean
getAgeMatchRank(age: number, classification: PublicClassification): number
normalizeDifficultyParam(value: string | null): DifficultyBand | null
isClassificationComplete(row: ClassificationRow): boolean
doesContentChangeInvalidateClassification(input: ContentChangeSet): boolean
~~~

### 5.3 映射规则

难度映射必须集中定义：

| difficulty_stars | difficultyBand | 中文 |
|---:|---|---|
| 1–2 | beginner | 入门 |
| 3–4 | intermediate | 进阶 |
| 5–6 | challenge | 挑战 |

国内学段只是辅助文案：

| 年龄 | 学段 |
|---:|---|
| 3–5 | 学前 |
| 6–11 | 小学 |
| 12–14 | 初中 |
| 15–16 | 高中 |

K–12 为近似交换字段，不作为教育合规声明。建议 3–4 映射 Pre-K，5 映射 K，6 映射 Grade 1，之后按年龄递增；超出 16 岁或无法确定时返回 NULL。

## 6. 候选生成与人工复核

### 6.1 候选生成原则

规则脚本只能产生候选，不得自动把内容标成 reviewed。候选来源包括：

1. 现有 difficulty_stars 映射到三档难度；
2. 课程标题、标签和导入元数据中的 3+/4+/5+、小班/中班/大班；
3. 材料、步骤和描述中的安全关键词；
4. 已有课程类型、步骤数量、预计时长和工具要求；
5. 历史人工修订记录（若存在）。

当没有明确年龄标记时，`rules_v1` 会按以下顺序生成“建议起始年龄”：先识别内容目标（学前/小学/初中/高中）、Scratch/编程、五子棋/博弈/策略等强信号，再参考课时、步骤、挑战阶段、材料数量和“算法/变量/原型/策略”等复杂概念。结构启发式只产生 6–8 岁范围内的候选，不能直接使用 `difficulty_stars` 推算年龄；所有启发式年龄的置信度最高为“中”，必须由人工确认。

安全关键词只用于提高人工复核优先级和生成 support_level 候选：

~~~text
剪刀、针、刀、切割、裁纸、热熔胶、胶枪、火、热源、烙铁、
电源、插座、化学品、玻璃、重物、高处、钻孔、砂纸
~~~

关键词列表需要版本化，误报和漏报都要进入报告，不能把关键词命中当成最终安全判定。

### 6.1.1 内部星级缺失或非法的处置

阶段 0 必须把 difficulty_stars=NULL、超出 1–6 或无法从旧 difficulty 可靠转换的已发布内容单独列为 blocking 项：

- 有合法 1–6 星：保留原值，仅生成三档候选；
- 只有 easy/medium/hard：生成待人工确认候选，不自动写入星级；
- 缺失或非法：必须由复核人明确填写 1–6 星，或先将内容归档/下架后再修复；
- 不能用 1 星作为通用默认值，因为这会改变 STEAM、奖励和历史统计语义；
- 阶段 2 前只要仍有一项已发布内容缺少合法内部难度，就不能把门禁切换为 true。

前台旧星级组件的 6 星“传说”分支在迁移期仍可被内部页面读取，但公共渲染必须统一走 difficultyBand adapter；不得通过 CSS 隐藏星星而继续把数字放进可访问文本或 JSON-LD。

### 6.2 脚本接口

建议脚本支持：

~~~text
node scripts/content-classification-preflight.mjs --type=all
node scripts/content-classification-candidates.mjs --dry-run
node scripts/content-classification-candidates.mjs --apply-candidates
node scripts/content-classification-review-report.mjs --status=unreviewed --format=csv
~~~

- 默认 dry-run，只输出统计和候选差异；
- apply-candidates 只能写 recommended_*、support_level、classification_source=rules_v1、classification_status=unreviewed；
- 不能写 reviewed_at 或 reviewed_by；
- 脚本必须幂等，重复执行不覆盖 source=manual 的字段；
- 输出内容 ID、旧值、新值、命中规则和安全关键词，但不输出儿童个人信息；
- 线上执行前保存 JSON/CSV 审计报告。

### 6.3 审核队列

后台队列按以下优先级排序：

1. 已发布且 unreviewed；
2. 命中高风险安全词；
3. 规则置信度低或多个规则冲突；
4. 最近被修改且旧标签失效；
5. 草稿和未发布内容。

复核表单必须同时展示正文、材料、步骤/阶段、课程课时继承关系和候选依据。审核人必须明确确认三轴，不能只点击“通过”沿用旧值。

### 6.4 首批候选

以下是人工复核队列的初始建议，不是自动写入的最终值：

| 内容 | 起始年龄 | 难度 | 成人支持 |
|---|---:|---|---|
| Scratch 少儿编程入门 | 6 | 入门 | 建议成人陪同 |
| 五子棋博弈论入门 | 8 | 进阶 | 建议成人陪同 |
| 小班大颗粒积木 | 3 | 入门 | 建议成人陪同 |
| 中班大颗粒积木 | 4 | 进阶 | 建议成人陪同 |
| 大班大颗粒积木 | 5 | 进阶 | 建议成人陪同 |
| 鸡蛋快递保护舱挑战 | 8 | 进阶 | 需成人协助 |

## 7. 权限与审核 API

### 7.1 权限边界

- 公共读取：阶段一沿用已有内容状态策略，但 unreviewed 行的 classification 必须为 null；阶段二只读取 reviewed 且满足内容状态的三轴。
- 内容作者：可以提交或修改候选值；不能修改审核元数据，不能把 status 改为 reviewed。
- Moderator/Admin：可以查看队列、修改候选、提交复核结论。
- 审核接口服务端必须从 session 读取 reviewer ID，忽略请求体中的 reviewed_by。
- 默认禁止审核员审核自己创建的项目；Admin 可以进行自审代审，备注可选，若填写则附加到 `self_review_override` 审计原因。课程和挑战当前没有 author_id 关系，不执行作者自审判断。
- 修改影响分级的内容时，服务端和数据库触发器都要使 classification_status 回到 unreviewed，防止遗漏入口。
- Service role 的批处理也必须经过同一套完整性校验；不能用 service role 绕过审核门禁。

### 7.2 建议新增统一审核接口

#### GET /api/admin/content-classifications

查询参数：

~~~text
contentType=course|project|challenge|all
status=unreviewed|reviewed|all
hasSafetyFlag=true|false
page=1
pageSize=20
~~~

返回分页队列、候选依据、内容摘要、当前状态和最近修改时间。默认只返回 staff 可见数据。

#### GET /api/admin/content-classifications/[contentType]/[id]

返回完整正文/材料/步骤/阶段、课程继承信息、候选规则命中、历史审核事件和当前三轴。

#### PATCH /api/admin/content-classifications/[contentType]/[id]

用于保存候选值，不代表复核通过：

~~~json
{
  "recommendedMinAge": 6,
  "recommendedMaxAge": null,
  "supportLevel": "guided",
  "difficultyStars": 3
}
~~~

请求不能包含或不能生效的字段：

~~~text
classificationStatus
classificationReviewedAt
classificationReviewedBy
~~~

#### POST /api/admin/content-classifications/[contentType]/[id]/review

请求：

~~~json
{
  "decision": "approve",
  "recommendedMinAge": 6,
  "recommendedMaxAge": null,
  "supportLevel": "guided",
  "difficultyStars": 3,
  "note": "需要家长协助准备材料",
  "idempotencyKey": "uuid"
}
~~~

服务端事务内校验字段完整性，写入 reviewed、manual、reviewed_at、当前审核人和审计事件。拒绝或退回使用 decision=return，状态保持 unreviewed，并保存原因。idempotencyKey 必填且由服务端校验 UUID 格式，重复请求返回第一次决策结果。

### 7.3 既有管理接口调整

课程、项目、挑战既有 PATCH/状态接口继续保留，但：

- 对分级字段统一调用共享 validation；
- 公开状态转换时调用同一发布门禁；
- 修改正文、材料、步骤、阶段或课时时自动失效；
- 作者端 API 不应接受审核字段；
- 返回稳定错误码，例如 CLASSIFICATION_REQUIRED、CLASSIFICATION_REVIEW_REQUIRED、CLASSIFICATION_INVALID。

## 8. 公开 API、查询与推荐

### 8.1 DTO 规则

课程、项目、挑战公共 DTO 增加：

~~~json
{
  "classification": {
    "recommendedMinAge": 6,
    "recommendedMaxAge": null,
    "ageLabel": "6 岁起",
    "difficultyBand": "beginner",
    "difficultyLabel": "入门",
    "supportLevel": "guided",
    "supportLabel": "建议成人陪同",
    "educationStage": "primary",
    "educationStageLabel": "小学",
    "status": "reviewed"
  }
}
~~~

公开 DTO 不包含 difficulty_stars、reviewer ID、规则命中词或内部审核备注。管理员 DTO 可以返回完整审核信息。

### 8.1.1 阶段一与阶段二的公开返回形状

为了避免“字段已加但候选尚未确认”被误读，两个发布阶段使用明确的返回契约。下表的“阶段一/阶段二公共 API”均以 `content_classification_settings.public_v1_enabled=true` 为前提；迁移刚完成时该开关默认是 `false`，在后端兼容代码部署并完成预检前，公共 API 继续返回旧兼容 DTO（不带 `classification` 键），而不是提前改变响应形状。

| 状态 | 阶段一公共 API | 阶段二公共 API |
|---|---|---|
| reviewed | 返回完整 classification 三轴 | 返回完整 classification 三轴 |
| unreviewed | 保持旧内容可见，但 classification 字段为 null；不输出候选值、年龄、支持度或 JSON-LD 年龄字段 | 已发布行理论上不存在；若发生数据异常，整行从公共查询排除 |
| 草稿/归档 | 遵循原有状态策略 | 遵循原有状态策略 |

阶段一页面可以在管理员界面显示“分级审核中”；普通用户页面不得根据候选值自行推断。缓存键必须包含 CONTENT_CLASSIFICATION_V1 的阶段值，切换阶段后清理课程、项目、挑战和 JSON-LD 的相关缓存，避免旧响应继续带出候选字段。

### 8.1.2 开关状态机与权威顺序

三个开关的职责必须分开，不能互相代替授权：

- `content_classification_settings.public_v1_enabled` 是**公共 API 返回分级字段的唯一服务端权威**。为 `false` 时，课程、项目、挑战公共 API 和 JSON-LD 都返回旧兼容形状，不返回 `classification` 或年龄相关字段；管理员 API 不受此开关影响。
- `content_classification_settings.enforcement_enabled` 只控制发布门禁。为 `false` 时允许阶段一的历史可见性；为 `true` 时阻止不完整或未复核内容进入公开状态，不决定 API 是否带字段。
- `CONTENT_CLASSIFICATION_V1` 是前端展示开关。为 `false` 时前台继续使用旧适配器、隐藏三轴标签，且前端生成的 JSON-LD 不写年龄字段；它不能被当作 RLS、触发器或审核授权依据。

因此采用以下可审计状态机：

| `public_v1_enabled` | `enforcement_enabled` | 应用展示开关 | 有效行为 |
|---:|---:|---:|---|
| false | false/true | false/true | 旧兼容公共 DTO；不输出三轴或年龄 JSON-LD。`enforcement_enabled=true` 仍可提前作为后台发布门禁使用。 |
| true | false | false | 阶段一 API 契约（reviewed 三轴、unreviewed 为 `classification:null`），但前台不展示三轴；后台照常复核。 |
| true | false | true | 阶段一完整体验：普通用户只看到 reviewed 的三轴标签；历史 unreviewed 内容保持旧可见性且无任何审核提示，审核提示仅后台可见。 |
| true | true | true/false | 阶段二发布门禁生效；公共查询只返回 reviewed。应用开关为 false 时前台仍可回退旧适配器，但 API 仍按 reviewed 契约返回。 |

服务端路由先读取数据库开关，再按 `enforcement_enabled` 应用发布过滤；应用环境变量只影响渲染层。若发生回滚，先关闭 `CONTENT_CLASSIFICATION_V1` 止住前台展示，再在受控事务中把 `public_v1_enabled=false`；只有确有发布阻塞时才临时关闭 `enforcement_enabled`。任何开关变化都要递增缓存命名空间或清理对应缓存，防止旧响应泄漏候选字段。

### 8.2 探索筛选

规范 URL：

~~~text
/explore?age=6
/explore?difficulty=beginner
/explore?age=6&difficulty=intermediate
~~~

旧参数归一化：

| 旧值 | 新值 |
|---|---|
| 1、2、1-2、easy | beginner |
| 3、4、3-4、medium | intermediate |
| 5、6、5-6、hard | challenge |

解析顺序：

1. 校验 age 为 3–16 的整数；非法值忽略并保留其它筛选；
2. 归一化 difficulty；
3. 查询已有 category、tag、material、search；
4. 只在 reviewed 内容中应用分级过滤；
5. 计算年龄命中排序，不把不命中的内容删除。

推荐排序建议：

~~~text
命中 [min, max]（或 min 之后无上限）       rank 0
距离 min 1–2 岁                             rank 1
其它内容                                   rank 2
~~~

同 rank 内继续使用原有热门/最新/稳定随机顺序。

### 8.3 推荐 RPC

新增版本化 RPC，避免直接改变旧函数的参数语义：

~~~text
get_recommended_projects_v2(
  p_user_id uuid,
  p_age smallint,
  p_steam jsonb,
  p_limit integer,
  p_offset integer
) -> jsonb
~~~

规则：

- p_age 为 NULL 时跳过年龄偏好，只使用 STEAM 和热门回退；
- p_age 不参与权限判断；
- 直接比较 projects.recommended_min_age/recommended_max_age；
- 只读取 status=approved、moderation_state=approved、classification_status=reviewed；
- 不读取或返回公开星级；
- 保留旧 RPC 供旧客户端短期兼容，应用切换后再单独下线。

当前 birth_date 为空的账号不能被猜测为某个年龄。前端可以提示用户完善资料，但不能为了推荐而默认一个年龄。

### 8.4 旧字段与旧 RPC 兼容策略

兼容层必须同时覆盖三类历史输入：

1. projects.difficulty 的 easy、medium、hard；
2. 探索预设和旧链接中的 difficulty=1、1-2、3-4、5-6；
3. 历史推荐函数的 p_age_group=6-9、10-12、13-15。

处理规则：

- difficulty_stars 是内部难度的唯一权威值；旧 difficulty 只作为写入兼容和数据修复候选，不能覆盖已确认的星级；
- 如果历史行只有 difficulty 没有可用 difficulty_stars，先在预检报告中列出，不能静默猜测；
- 旧推荐 RPC 保留 wrapper，代表年龄映射为 6、10、13；wrapper 不再把年龄段硬绑定到星级，只把代表年龄传给 v2 查询；
- 新代码和新链接只生成 difficulty=beginner/intermediate/challenge；
- 旧参数归一化后不能再回写旧格式 URL，canonical URL 使用新格式；
- 旧客户端收到的 DTO 可以短期保留 difficulty 字段，但新前台不得把它渲染为“星级”；
- 旧星级组件和旧 DTO 的删除必须等所有调用方、缓存和 SEO 快照完成迁移后再做。

p_age_group wrapper 的完整边界：

| 输入 | wrapper 行为 |
|---|---|
| 6-9、10-12、13-15 | 分别映射代表年龄 6、10、13 |
| 3-5 | 映射年龄 3 |
| 16+、16-18 | 映射年龄 16 |
| NULL、空字符串 | age=NULL，跳过年龄偏好并使用原热门回退 |
| 其它非法值 | 不返回 500；记录 warning，按 age=NULL 处理并使用原热门回退 |

wrapper 保留旧 RPC 的认证、限流和返回 JSON 形状（包括旧客户端需要的 difficulty_stars），但不再在 SQL 中用年龄段硬筛星级。v2 RPC 才返回新 DTO。wrapper 不接受客户端 user_id 覆盖当前用户，权限错误继续沿用旧错误码。

当前数据库/类型中只有 projects 有旧的 difficulty 文本字段；courses 和 challenges 没有同名字段。课程/挑战 API 对未知 difficulty 字段拒绝并返回 VALIDATION_ERROR，不创建新的兼容列。

## 9. SEO、AI 与前台展示

### 9.1 JSON-LD

对 Course、LearningResource、项目/挑战对应的公开结构化数据增加：

~~~json
{
  "typicalAgeRange": "6-",
  "educationalLevel": "小学",
  "learningResourceType": "项目"
}
~~~

规则：

- min=6、max=NULL 输出 6-；
- min=6、max=9 输出 6-9；
- 未复核或字段不完整时不输出这些字段；
- educationalLevel 是辅助元数据，不声明官方学段认证；
- JSON-LD 与页面可见文案必须来自同一个 helper。

### 9.2 页面展示

所有课程卡、项目卡、挑战卡和详情页按同一顺序展示：

~~~text
6 岁起 · 入门 · 建议成人陪同
~~~

移动端保证每个标签至少 44px 的可操作命中区（筛选按钮），静态标签不制造可点击假象。颜色不能是唯一语义，必须同时有文字。

课程：

- 去掉根据标题解析小班/中班/大班的逻辑；
- 课程卡显示继承后的三轴；
- 课时页显示“本课继承课程分级”，避免用户误以为课时另有独立评级。

项目：

- 项目详情材料区附近单独显示成人支持提示；
- 阶段一命中高风险但尚未复核时，普通用户继续看到旧内容但不显示任何分级提示；“分级审核中”只在后台队列显示。阶段二不应再有已发布未复核内容；
- 不改变作品、Journey 和内容安全审核状态。

挑战：

- active 和 ended 内容均显示已复核分级；
- 挑战报名/提交仍由原有状态和权限控制；
- 需成人协助的挑战在开始行动前显示安全提醒。

### 9.3 AI 导师

传给小迪的内容上下文增加：

~~~text
recommendedMinAge
difficultyBand
supportLevel
classificationStatus
~~~

提示词约束：

- 不向用户说“几星”“传说级”；
- 不把适龄当作能力诊断或限制；
- 需成人协助时优先提醒让家长准备/操作高风险工具；
- 未复核内容不自行推断年龄或安全结论；
- 年龄字段只在服务端按请求即时计算，不向模型传生日原值。

## 10. 内容变更失效与发布门禁

### 10.1 会触发重新复核的字段

以下修改会将内容设为 unreviewed：

- 课程、项目、挑战的正文/描述/目标/约束；
- 项目材料、步骤、步骤说明和图片；
- 挑战 stages、resources、expected_outcome；
- 课程课时增删、标题、content、steps、resources、duration；
- difficulty_stars；
- recommended_min_age/recommended_max_age/support_level。

以下修改不触发：

- 封面图；
- 展示排序；
- 非安全/学习语义的运营标签；
- 点赞、浏览、作品数等派生统计。

如果标题或标签在当前产品中承载年龄语义，必须把该字段加入触发集合；实现前由内容团队确认，不允许只凭字段名称判断。

### 10.2 触发器与应用层双保险

应用层在 PATCH 前计算变更集合，数据库触发器在 UPDATE/INSERT 时再次检查。触发器只负责把状态改为 unreviewed 和清空 reviewed 元数据，不负责猜测新值。

审核通过不能直接用普通 UPDATE，否则会被同一个失效触发器再次改回 unreviewed。审核 API 必须调用单一的 service-role-only RPC，例如：

~~~text
review_content_classification(
  p_content_type,
  p_content_id,
  p_expected_revision,
  p_min_age,
  p_max_age,
  p_support_level,
  p_difficulty_stars,
  p_note,
  p_reviewer_id
)
~~~

RPC 在同一事务内锁定内容行、校验 classification_revision、检查 reviewer 角色和非自审规则，写入三轴、manual、reviewed_at、reviewed_by、revision 和审计事件。transaction-local guard（例如 app.content_classification_review=true）只能作为“审核写入不触发失效”的辅助标记，不能作为授权依据，因为 service role 直连 SQL 可能伪造 GUC。

数据库必须同时做不可伪造的写保护：

- 对 anon/authenticated/service_role 撤销三张内容表受保护列的直接 UPDATE 权限；
- candidate/review RPC 使用 SECURITY DEFINER，由迁移创建的函数 owner 执行，并在函数内验证调用者角色；
- 失效触发器检查 protected-column 的变更来源：只有由 SECURITY DEFINER 函数 owner 执行的受控函数路径允许 reviewed、reviewed_at、reviewed_by、source 和 revision 组合变更；普通 service_role 直连 UPDATE 即使设置了 GUC 也抛出 CLASSIFICATION_WRITE_FORBIDDEN；
- 只有数据库 owner 的迁移/紧急维护可以绕过该保护，且必须留下 rollout 事件。

若托管环境不允许单独创建函数 owner role，则使用现有数据库 owner 的 SECURITY DEFINER，并通过 REVOKE column privileges + trigger 双重保护；不能只依赖 RLS，因为 service role 会绕过 RLS。

若内容在审核员打开队列后被编辑，revision 不一致时返回 CLASSIFICATION_STALE，不覆盖新内容。

review RPC 接受 idempotency_key uuid。content_classification_reviews 对 content_type、content_id、idempotency_key 建唯一索引；同一 key 重试返回第一次的结果（already_reviewed 或 approved），不同 key 在 revision 已变化时返回 CLASSIFICATION_STALE。这样网络重试不会被误报成新的审核。

所有正文/材料/步骤编辑接口和该 RPC 使用同一个内容级 advisory lock；这样“编辑使其待复核”和“审核通过”不会以不同顺序互相覆盖。审核成功后再由同一事务返回最新 DTO，不能让客户端用旧缓存拼接标签。

审核事件建议记录：

~~~text
content_type
content_id
previous_classification
new_classification
reason = content_changed | manual_review | rules_candidate | publish_gate
actor_type
actor_id
actor_label
created_at
~~~

### 10.3 发布门禁

第二阶段启用数据库触发器或受控状态函数：

~~~text
课程 status -> approved：
  必须 classification_status=reviewed 且三轴完整

项目 status -> approved：
  必须 classification_status=reviewed、三轴完整，并通过 moderation 规则

挑战 status -> active/ended：
  必须 classification_status=reviewed 且三轴完整
~~~

直接 UPDATE、管理 API、批处理脚本都必须经过同一门禁。门禁失败返回结构化错误，不部分更新状态。

## 11. 两阶段数据库迁移与上线

### 11.1 阶段 0：只读预检

先运行：

~~~text
pnpm db:status
node scripts/content-classification-preflight.mjs --type=all
pnpm db:push -- --dry-run
~~~

预检至少输出：

- 三张内容表的总数、已发布数和未复核数；
- difficulty_stars 越界/NULL；
- 年龄字段越界或 max < min；
- 安全关键词命中数；
- 已发布内容中无法读取正文/材料/步骤的项目；
- 课程课时继承冲突；
- 需要人工确认的低置信度候选。

阶段 0 不写数据库。

### 11.2 阶段 1：字段、候选、审核与公开展示（已完成）

迁移内容：

1. 三张内容表增加可空字段、check 约束和查询索引；
2. 增加审核事件/队列所需表或视图；
3. 增加候选写入和审核接口需要的 RLS/权限；
4. 增加内容变更失效触发器；
5. 不改变现有 approved/active/ended 发布行为；
6. 不在公开页面强制隐藏旧内容，只隐藏未复核的精确三轴。

阶段 1 的列和默认值应近似如下（实际迁移需按当前数据库类型生成）：

~~~sql
ALTER TABLE public.courses
  ADD COLUMN recommended_min_age smallint,
  ADD COLUMN recommended_max_age smallint,
  ADD COLUMN support_level varchar(24),
  ADD COLUMN classification_status varchar(16) NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN classification_source varchar(16),
  ADD COLUMN classification_reviewed_at timestamptz,
  ADD COLUMN classification_reviewed_by uuid,
  ADD COLUMN classification_revision bigint NOT NULL DEFAULT 0;
~~~

projects 和 challenges 使用同一字段集合。年龄、支持度和 source 的约束在阶段 1 以 NOT VALID 形式增加，允许历史 NULL；校验函数只在 status=reviewed 或进入公开状态时要求非空。阶段 2 在完成回填后 VALIDATE 约束，不对草稿列做全局 NOT NULL。

阶段 1 同时新增单行 content_classification_settings：

~~~text
id boolean primary key default true check (id)
public_v1_enabled boolean not null default false
enforcement_enabled boolean not null default false
emergency_reason text
emergency_actor_id uuid
enforcement_expires_at timestamptz
updated_at timestamptz not null default now()
updated_by uuid
~~~

该表只允许 service role 修改。公共查询读取 public_v1_enabled，状态触发器读取 enforcement_enabled；两个开关默认 false，避免迁移一完成就改变用户可见行为。emergency_reason、emergency_actor_id 和 enforcement_expires_at 只有紧急回滚流程可写，并且 enforcement_expires_at 不能晚于 now()+24h。

同时新增 content_classification_rollout_events，记录 rollout_enabled、emergency_disabled、auto_restored 等事件及 actor_id/actor_type/reason/expires_at。这样回滚步骤中写入的 reason、operator 和 TTL 都有实际存储位置。

建议新增 scripts/content-classification-watchdog.mjs，由现有内部 cron/发布检查每 5 分钟调用；它使用 service role 读取 settings，发现 enforcement_expires_at 已过期时，在 advisory lock 内自动恢复 enforcement_enabled=true、清空 emergency 字段并写 rollout 事件，同时发结构化告警。若项目没有可用 cron，必须把该脚本接入部署平台的定时任务，不能只依赖人工记忆。

所有内容编辑函数和阶段 2 切换使用同一个 pg_advisory_xact_lock 键。阶段 2 在一个事务中取得该锁、执行已发布行计数、确认计数为零、设置 enforcement_enabled/public_v1_enabled=true，然后提交；编辑事务在切换期间等待，避免预检和启用之间出现竞态。

RLS 和写入权限最低要求：

- public/authenticated 只能读取已有公开内容策略允许的行；
- 作者不能直接 INSERT/UPDATE 审核元数据；
- moderator/admin 可以通过审核 API 写候选和结论；
- content_classification_reviews 只允许 staff/service role INSERT，禁止客户端 UPDATE/DELETE；
- service role 批处理仍必须调用共享完整性函数，不能通过绕过 RLS 的方式把 unreviewed 改成 reviewed。

执行顺序：

~~~text
pnpm db:push -- --dry-run
pnpm db:push
pnpm db:status
node scripts/content-classification-candidates.mjs --dry-run
node scripts/content-classification-candidates.mjs --apply-candidates
~~~

候选写入后，后台通过 `/admin/content-classifications` 完成已发布内容的逐项复核。规则安全关键词只作为审核提醒，不是必须清零的计数，也不应驱动删除内容。

#### 11.2.1 当前执行记录（2026-08-26）

- `20260825112933_content_classification_fields.sql`、`20260825121949_content_classification_gate.sql`、`20260825123613_content_classification_recommendations.sql`、`20260825130000_content_classification_ranking_visibility.sql`、`20260825143000_content_classification_admin_self_review.sql`、`20260826161222_content_classification_public_v1.sql` 已全部成功执行。
- `20260826161222_content_classification_public_v1.sql` 已成功执行，新增受控 `set_content_classification_public_v1` RPC；公开展示和发布门禁可以独立控制。
- `pnpm db:status`：内容分级迁移已执行，待执行 0；`classification_schema_ready=true`。
- 当前设置为 `public_v1_enabled=true`、`enforcement_enabled=false`：课程、项目、挑战的 reviewed 内容通过统一 DTO 输出三轴，现有发布流程不变。
- 只读预检：内容项总数 251，已发布 219，`published_unreviewed=0`、`published_incomplete=0`、`invalid_difficulty=0`；安全关键词提示 152 条，但不产生待审核队列。
- `/admin/content-classifications` 保留为后台最终审核入口；课程、项目、挑战详情页和卡片使用 `ContentClassification` 展示三轴标签。

### 11.3 阶段 2：发布门禁（仍按需开启）

上线前置条件：

~~~text
published_unreviewed_count = 0
published_incomplete_count = 0
reviewer_audit_rows_without_actor = 0
course_inheritance_conflict_count = 0
~~~

计数口径必须固定为：

~~~sql
-- courses
status = 'approved'
-- projects
status = 'approved' AND moderation_state = 'approved'
-- challenges
status IN ('active', 'ended')
~~~

上述三组行再分别检查 classification_status、recommended_min_age、support_level、difficulty_stars、classification_source、reviewed_at 和 reviewed_by。预检结果写入发布报告；不能只依赖前端列表数量，因为后台/缓存/旧 RPC 可能仍读取旁路数据。

迁移内容：

1. 增加 approved/active/ended 状态转换门禁；
2. 把公开查询统一切换为 reviewed 过滤；
3. 为公开 API、推荐 RPC 和 JSON-LD 保持 reviewed-only 三轴字段；
4. 把旧 difficulty 查询参数统一归一化；
5. 保留 difficulty_stars 读取供内部计算和回滚。

状态门禁由一个数据库 trigger/function 实现，而不是只依赖某个 Route Handler。触发器先读取 content_classification_settings.enforcement_enabled；开关为 false 时保持阶段 1 行为，为 true 时拦截不完整的 approved/active/ended 转换，并抛出 SQLSTATE P0001、错误码 CLASSIFICATION_REQUIRED。所有管理员 API、导入脚本和直接 SQL UPDATE 都因此获得同一保护。

阶段 2 切换必须在同一事务中完成：

~~~text
BEGIN
  pg_advisory_xact_lock(CLASSIFICATION_ROLLOUT_LOCK)
  读取并锁定 content_classification_settings
  统计三张表的 published_unreviewed / published_incomplete
  任一计数不为 0 就 ROLLBACK
  设置 enforcement_enabled=true, public_v1_enabled=true
COMMIT
~~~

公开三轴展示已经通过独立的阶段 1 受控 RPC 开启。未来若要阻止未复核内容发布，再执行阶段 2 事务；不能把发布门禁当成公开展示的前置条件。

执行：

~~~text
pnpm db:push -- --dry-run
pnpm db:push
pnpm db:status
~~~

阶段 1 公开展示和阶段 2 发布门禁必须是两次可审计的操作；禁止合并成一个“加字段并立即锁发布”的迁移。

### 11.4 回滚

- 不删除新字段、不回滚历史审核事件、不清空人工结论；
- 前台问题优先关闭 CONTENT_CLASSIFICATION_V1 展示开关，恢复旧星级适配器；
- 公开 API 可以暂时继续返回旧兼容 DTO，但不得让未复核三轴泄漏到前台；
- 数据库门禁如需紧急关闭，必须通过单独、可审计的 emergency migration/开关，并记录负责人、原因和截止时间；
- 回滚期间继续保留内容变更失效逻辑，避免旧标签长期有效；
- 修复后重新执行阶段 2 前置检查，再恢复门禁。

可执行的紧急步骤：

1. 暂停前端发布并标记 incident；
2. 由 Admin 通过受控内部脚本在 content_classification_settings 上取得 advisory lock；
3. 在同一事务把 public_v1_enabled=false；若确有发布阻塞，再把 enforcement_enabled=false，并写入 emergency_reason、emergency_actor_id、enforcement_expires_at（最长 24 小时）及 rollout 事件；
4. 清理课程/项目/挑战/JSON-LD 的 CDN 和应用缓存；
5. 旧 API 只返回旧 DTO，classification 对 unreviewed 统一为 null；
6. content-classification-watchdog.mjs 负责检查 TTL；超时自动恢复 enforcement_enabled=true 或报警；
7. 修复后先跑完整 preflight，再在单独事务重新打开两个开关。

禁止通过手工 DROP TRIGGER、直接 UPDATE 全表或删除审核记录回滚；这样会失去审计和重新启用所需的状态。

## 12. 测试矩阵

### 12.1 纯函数与类型

- 1、2、3、4、5、6 星映射边界；
- NULL、0、7 和非整数星级被拒绝；
- 年龄 3、5、6、11、12、14、15、16 边界；
- max=NULL、max=min、max<min；
- 国内学段和 K–12 近似映射；
- old difficulty 参数全部兼容；
- p_age_group 的 3-5、6-9、10-12、13-15、16+、NULL 和非法值边界；
- 未复核 DTO 不生成公开标签或 JSON-LD；
- 内容变更字段集合准确区分触发/不触发。

### 12.2 API 与权限

- 阶段一匿名/普通用户仍可读取原有公开内容，但 unreviewed 的 classification 必须为 null；阶段二匿名/普通用户只能读取公开 reviewed 内容；
- 作者不能写 reviewed、reviewed_at、reviewed_by；
- service_role 直连 UPDATE 不能伪造受保护列或 transaction guard；
- reviewer/admin 可以审核，但不能审核不存在或不完整的三轴；
- 重复审核使用相同 idempotencyKey 幂等，审计事件不丢失；
- 内容修改后旧标签立即失效；
- 发布门禁对课程 approved、项目 approved、挑战 active/ended 分别生效；
- 旧 URL 仍能得到正确三档筛选；
- 年龄筛选只排序，不误删超龄内容；
- 推荐 RPC 在 birth_date 为空时不猜年龄。

### 12.3 数据库与迁移

- 阶段 1 dry-run 不写入；
- 阶段 1 可以处理历史 NULL；
- 阶段 2 在存在一个未复核发布项时失败且不部分发布；
- 直接 SQL UPDATE 不能绕过门禁；
- 课程课时增删触发父课程重新复核；
- 并发审核/编辑不会恢复旧 reviewed 元数据；
- 迁移重复执行安全，索引/触发器使用幂等写法。

### 12.4 前端与 E2E

使用现有 Vitest 和 Playwright 配置增加：

- 课程卡、项目卡、挑战卡三轴文案；
- 桌面和移动端筛选、标签换行和触控尺寸；
- 后台未复核内容显示“分级审核中”；普通用户页面不显示候选值或审核提示；
- 管理后台候选、审核、退回和审计记录；
- 详情页、探索页、课程页和挑战页的旧链接兼容；
- JSON-LD 中 typicalAgeRange/educationalLevel 与页面一致；
- 小迪上下文不出现星级公开文案；
- 不覆盖现有用户改动 e2e/smoke.spec.ts。

### 12.5 性能与缓存

- 公开 reviewed 查询使用稳定缓存键；
- age/difficulty 作为缓存键的一部分；
- 管理队列使用分页，不能一次加载全部正文/媒体；
- 年龄排序不引入每条内容的 N+1 查询；
- 课程课时继承不重复查询三轴字段。

## 13. 观测、审计与隐私

建议记录以下指标：

~~~text
content_classification.unreviewed_published
content_classification.review_queue_size
content_classification.publish_gate_rejected
content_classification.rule_safety_hit
content_classification.manual_override
content_classification.age_filter_used
content_classification.recommendation_without_age
~~~

日志只记录 content_type、content_id、规则版本和错误码，不记录儿童生日、作品正文或安全关键词上下文原文。生日只在服务端即时计算年龄，不能写入推荐事件或传给模型。

审核事件需要可追溯但不可被作者删除。管理员导出报告时按角色脱敏，公开 API 永远不返回 reviewer ID、审核备注和候选命中词。

## 14. 实施顺序与完成定义

建议按以下顺序提交：

1. 共享 types/mapping/validation 单测；
2. 阶段 1 migration、preflight 和候选脚本；
3. 管理审核队列与 API；
4. 内容变更失效和公开 DTO；
5. 推荐 RPC v2、旧参数兼容和 JSON-LD；
6. 课程/项目/挑战前台三轴标签；
7. 全量内容人工复核；
8. 阶段 1 公开展示受控切换；
9. 阶段 2 发布门禁（按需）；
10. Playwright 回归、监控和发布复盘。

功能只有同时满足以下条件才算完成：

- 三张内容表都有统一字段和完整约束；
- 所有已发布内容均完成人工复核；
- 作者无法伪造审核元数据；
- 影响分级的修改会自动下架旧标签并重新入队；
- 推荐和探索不再用星级猜年龄；
- 前台、AI、JSON-LD 使用同一三轴语义；
- K–12 只出现在后台/交换层；
- 阶段 1/2 迁移均完成 dry-run、push、status 记录；公开展示与发布门禁的切换均有审计事件；
- PROJECT_INDEX.md 已同步记录实现入口和本文档。

## 15. 明确不做的事情

- 不把 K–12、CEFR、Bloom、NGSS 或国内课标变成前台难度等级；
- 不删除 difficulty_stars；
- 不用年龄分级阻断内容访问；
- 不根据一个安全关键词自动判定“需成人协助”；
- 不给每个 course_lessons 重复存储课程三轴；
- 不把 XP 等级、徽章档位或游乐场星级改造成内容适龄体系；
- 不在没有人工复核的情况下对历史已发布内容批量强制加 NOT NULL。
