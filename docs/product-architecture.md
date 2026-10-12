# 产品架构与当前边界

> 状态：当前实现说明与待讨论事项。核对基线为 2026-10-12 的仓库提交 `f4eb9e8caee04d79997d9ed4f9401f3f8dcf2510`，结合本次产品讨论整理；本轮未连接生产数据库、验证线上配置或执行发布。本文不把建议写成已采纳需求，也不要求先完成架构改造再推广网站。

产品方向见 [`product-direction.md`](./product-direction.md)，近期任务见 [`next-step.md`](./next-step.md)，文件导航见 [`PROJECT_INDEX.md`](../PROJECT_INDEX.md)。本文负责解释模块和数据的关系；发布、支付、审核及奖励的完整契约仍由各专项文档维护。

## 1. 已有模块与数据关系

| 对象 | 当前作用与关系 | 主要实现入口 |
| --- | --- | --- |
| 普通项目 | `projects` 提供可自主选择的活动内容、材料与步骤；用户对同一内容的实际尝试另外保存 | 项目详情与 `lib/project/` |
| 课程与课时 | `courses` 组织 `course_lessons`；课时按 Scratch、积木 3D、游乐场实训等类型选择工作区。课程/课时与普通项目各有内容路径，当前不能概括成“一课时就是一个普通项目” | `lib/courses/types.ts`、`lesson-types.ts`、`building-lesson-flow.ts` |
| PBL 挑战 | `challenges` 提供命题与阶段；个人项目方向、阶段产出和最终作品围绕同一次尝试组织 | `lib/pbl/`、`challenge_workspaces`、`challenge_stage_progress` |
| 一次尝试 | 普通项目与 PBL 共用 `project_journeys`，用 `attempt_no` 区分尝试；同一用户、同一来源只允许一个 active Journey | `lib/journeys/types.ts`、`service.ts` |
| 尝试中的记录 | `project_journey_records` 保存阶段、过程与最终作品记录，审核结果回写 Journey；旧项目/PBL 表保留兼容投影 | `lib/journeys/service.ts`、`moderation.ts` |
| 课时进度与作品 | `user_lesson_progress` 保存开始/完成进度；课时作品走独立提交与审核路径，不能用课时完成代替作品发布 | `lib/courses/progress.ts`、`lib/works/submission.ts` |
| 收藏 | `collections` 独立表达以后想看或想做；收藏不创建完成状态，也不替代一次实践 | `/api/projects/[id]/collection` |
| 自然观察与统一作品视图 | `observation_events` 保留自然观察领域数据；`lib/works/` 将项目、课时、挑战、自然观察四类成果汇入“我的作品”，汇总展示不意味着底层数据结构相同 | `lib/api/nature-observation-*`、`lib/works/types.ts`、`data.ts` |

### 当前覆盖范围

- Journey 的来源类型是 `project` 与 `challenge`，不包含 `course_lesson`。普通项目可以在一次完成后重新开始新的尝试。
- 课时作品按用户与课时限制为一件 final 作品；审核拒绝后的修改重提不等于保留了多次独立实践。若要支持同一课时多次搭建、比较多个结果，应先确认实际使用需求。
- 课时进度、作品审核、Journey 完成和课程里程碑是不同状态。课时完成写进度；作品经过审核；课程里程碑和奖励按各自受控规则生成。不得把“打开课时”“完成课时”“公开作品”混成一个完成事件。
- 当前记录和进度按用户账号归属。家长账号与孩子学习档案是否需要进一步分开，见下文待讨论项。

课程完成、可信来源、里程碑与奖励详见 [`COURSE_PROGRESS_REWARDS_AND_STEAM_IMPLEMENTATION.md`](./COURSE_PROGRESS_REWARDS_AND_STEAM_IMPLEMENTATION.md)；这些统计口径本身不证明用户的实际问题解决能力。

## 2. 记录与公开发布的当前契约

普通项目的完成记录接口与通用 Journey 项目记录入口，均要求用户明确提交公开审核，不提供新记录的私密保存模式。探索记录至少有文字或图片之一，最终作品仍要求图片；待审不等于已公开。

未发布文字仅在当前标签页按账号和项目恢复。退出、换账号或发布成功后清理；照片、视频不承诺持久化恢复。撤回分享后记录处于未公开状态，重新发布仍须审核。

PBL 阶段保留草稿与可见性操作，底层 `private` / `draft` 字段也服务于撤回状态。不能因为字段存在，或 PBL 可保存阶段草稿，就写成普通项目当前默认私密保存。个人时间线与公开列表也要分别遵守自己的读取契约。

当前准则与验证边界以 [`EXPLORATION_RECORDS.md`](./EXPLORATION_RECORDS.md) 为准；对应实现包括 `lib/project/record-input.ts`、`record-draft.ts` 和 `app/api/journeys/[id]/records/route.ts`。恢复普通项目私密保存属于待讨论的行为变更，本轮仅修正文档。

## 3. 材料、商品与供应商已经分层

| 层次 | 当前实现 | 使用边界 |
| --- | --- | --- |
| 活动所需材料 | 普通项目材料与课程模型零件清单；积木课从 MPD 计算全课/分步 BOM | 描述活动需要什么，独立于是否有商品可买 |
| 用户已有套装核算 | 课程套装配置、零件映射、替代规则和按套数准备表 | 依赖已登记库存与核算规则；无必需缺件不保证实际连接、支撑和替代件都已验证 |
| 可售商品与规格 | `store_products`、`store_product_variants`，通过 `context_keys` 关联课程、课时或项目 | 关联用于呈现购买入口，不自动证明一个 SKU 或多个 SKU 的组合完整满足 BOM |
| 供货来源 | `store_suppliers`、`store_product_sources` 保存供应商与规格来源映射 | 供应商/API 配置存在不代表已取得自动采购资格或完成真实履约 |

课程材料实现从 `lib/courses/lesson-materials.ts`、`course-kit-config.ts` 和 `components/features/courses/lesson-materials-preparation.tsx` 进入。覆盖报告见 [`小班套装对比`](./courses/lesson-kit-coverage-small-class.md) 与 [`中班/大班套装对比`](./courses/lesson-kit-coverage-middle-senior.md)。材料清单核算、模型确认、实物搭建和外部家庭使用分别记录证据，详见 [`content-quality.md`](./content-quality.md)。

后续整理首批体验课程时，应把实际用到的套装、散件、替换和已验证步骤列清楚。商城准备可据此核对真实购买组合，不能直接把课程关联当作材料齐套承诺。

## 4. 网站学习与商城准备的边界

`lib/store/service.ts` 的上下文商品查询在目录关闭或商品查询失败时隐藏购买卡片，继续提供学习内容。目录、新购、真实支付及具体支付渠道分别由配置开关控制；关闭新购不等于停止处理历史订单和售后。

因此，本次确定的“推广可用网站内容，同时推进商城准备”已有实现基础。已有匹配材料的家庭可以参与内容体验；缺材料的家庭需要看到准确的材料要求和当前购买状态。支付审核、供应商接入与自动采购条件不应阻断已有免费学习路径。

当前首期交易和履约方案、默认关闭的开关、真实交易验收要求以 [`STORE_CHANNEL_FULFILLMENT_DECISION.md`](./STORE_CHANNEL_FULFILLMENT_DECISION.md) 为准。本文不改变现有人工采购/供应商代发方案，不承诺已经开售或支持 1688 自动下单。

## 5. 待讨论，尚未采纳为开发需求

| 问题 | 已有基础或限制 | 决定前要弄清的使用场景 |
| --- | --- | --- |
| 家长账号与孩子档案分开 | 现有进度、Journey 和作品按账号归属 | 一个家庭是否确实需要为多个孩子分别续学、记录与展示成果 |
| 同一课时保存多次实践 | 普通项目/PBL 有 Journey；课时仍是进度与作品路径 | 家庭再次搭建时需要覆盖作品、另存结果，还是比较过程；再决定是否扩展 Journey |
| 普通项目私密实践记录 | 当前普通项目只接受公开审核提交；PBL 可保留阶段草稿 | 是否有人需要长期保存但不公开；若采纳，需明确保存、发布和撤回的产品含义 |
| 实践绑定学习内容版本 | LDraw 确认已绑定模型哈希，课程里程碑已有部分配置快照 | 哪些内容更新会影响继续学习或复现；不能把局部快照称为全部内容版本已绑定 |
| 项目与课时复用内容 | 课程/课时、普通项目各有内容结构 | 哪些实际内容重复维护，复用会如何影响发布、修改和历史记录 |
| 观察、实验工具关联项目实践 | 自然观察和游乐场有各自记录/状态，现有 Journey 来源限于项目和挑战 | 是否有跨模块实践需要引用观察或实验结果；先保留时间、地点、物种或实验配置等各自语义 |
| 模块是否独立部署 | 学习与商城已存在代码及配置边界 | 结合真实故障、变更频率、运行负载和维护成本决定，不能仅凭模块数量要求拆服务 |

以上讨论按具体体验问题逐项推进。当前优先维护材料说明、首批课程证据和用户使用反馈，执行项集中在 [`next-step.md`](./next-step.md)；本轮不新增数据库结构、接口或产品行为。
