# 文档导航

这里维护当前规则、操作说明和待办。代码位置见 [项目索引](../PROJECT_INDEX.md)，历史方案与验收过程放在 `archive/`，不作为当前实现说明。

## 当前规则与开发规范

| 文档 | 用途 |
|---|---|
| [产品方向](product-direction.md) | 新增功能前确认主线与暂缓范围 |
| [AI 开发规范](AI_DEVELOPMENT_GUIDELINES.md) | 模型决策与服务端确定性边界 |
| [设计规范](design-system.md) | 布局、组件、字体和样式约定 |
| [PBL 指南](PBL_CHALLENGE_GUIDE.md) | 挑战内容生产与当前系统规则 |
| [互动资格与内容访问](TRUST_AND_INTERACTION_ACCESS.md) | 能力矩阵、确认流程与权限实现 |
| [商城渠道决策](STORE_CHANNEL_FULFILLMENT_DECISION.md) | 淘宝外部结算与履约边界 |
| [内容删除政策](content-triage-2026-08-13.md) | 禁止重新导入的项目与权威 ID 来源 |

## 维护与操作

| 文档 | 用途 |
|---|---|
| [数据库连接与迁移](database-psql.md) | 连接诊断、正式迁移入口与执行边界 |
| [短信与手动用户](custom-sms-and-manual-users.md) | 短信配置和账号创建流程 |
| [内容分级](CONTENT_CLASSIFICATION_IMPLEMENTATION.md) | 三轴规则、审核、开关与运维 |
| [课程进度与奖励](COURSE_PROGRESS_REWARDS_AND_STEAM_IMPLEMENTATION.md) | 完成契约、奖励、里程碑与审计 |
| [物种图鉴](NATURE_SPECIES_ATLAS_IMPLEMENTATION.md) | 图鉴读模型、缩略图与发布核查 |
| [游乐场联网](playground-online-features.md) | 对战、竞速和房间生命周期 |
| [LDraw 当前状态](ldraw-status.md) | 3+ 100 个模型的当前完成状态，以及 4+/5+ 后续范围 |
| [LDraw 课程资源发布](ldraw-publishing.md) | 模型独立 OSS 发布、应用发布范围、首次启用与版本缓存规则 |
| [LDraw 发布记录](ldraw-published-2026-09-15.md) | 2026-09-15 的 3+ 生产发布与校验证据入口 |
| [SEO / GEO 索引清单](seo-indexing-checklist.md) | Sitemap、站长验证、百度推送与高价值 URL |

## 待办与历史

- [下一步](next-step.md)：集中维护尚需推进的工作；已完成事项回到对应模块说明。
- 历史产品方案：[PBL 阶段重构](archive/PBL_STAGE_FLOW_REDESIGN.md)、[免费课与积木变现](archive/free-course-and-brick-monetization-plan.md)、[2026-08-14 产品评审](archive/product-design-review-2026-08-14.md)。
- [LDraw 历史总账](archive/ldraw/ldraw-model-audit.md)、[状态历史快照](archive/ldraw/ldraw-status-history-2026-09-15.md)、[PROJECT_INDEX LDraw 过程归档](archive/ldraw/project-index-ldraw-history-2026-09-15.md)与各批次原始记录保留验收依据；[2026-09-08 确认记录](archive/ldraw/ldraw-confirmed-2026-09-08.md)和[2026-09-09 挂载记录](archive/ldraw/ldraw-mounted-2026-09-09.md)已归档，最新汇总从 [LDraw 当前状态](ldraw-status.md)进入。
- `ui-gpt-designs/` 是被 Git 忽略的本地设计参考图，不属于受版本管理的文档；需要保留的参考图应自行备份到项目外。

## 维护约定

- 同一规则只维护一个来源，其余文件用链接引用；`PROJECT_INDEX.md` 负责定位，不重复记录批次过程。
- 当前事实、历史快照与未实施计划必须明确区分。涉及线上数量、开关、迁移或发布状态时，注明检查日期和证据，不从代码存在推断已上线。
- 合并或归档前迁移未完成事项及有效约束，并更新入口和引用；历史记录不继续承担当前待办职责。
