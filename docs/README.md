# 文档导航与唯一规则来源

核对日期：2026-10-13；代码基线 `0d322eda40dfdf81c7feb4f37703c9b38bea2b15`。本轮只整理文档，没有执行生产迁移、发布、交易或真实账号验收。

[根 README](../README.md) 负责介绍和启动，[项目索引](../PROJECT_INDEX.md) 负责定位代码。本页规定现行文档分工；同一规则不在多份文档复制维护。

## 规则由谁维护

| 主题 | 唯一维护文档 | 其他文档的职责 |
|---|---|---|
| 长期方向、用户假设与产品约束 | [产品方向](product-direction.md) | 架构和待办只链接，不重述经营决定 |
| 模块、数据和实践关系 | [产品架构](product-architecture.md) | 索引只列实现入口 |
| 当前任务及关闭条件 | [下一步](next-step.md) | 专项文档提供技术与验收依据，不另建竞争待办表 |
| 内容证据与验收口径 | [内容质量](content-quality.md) | 批次记录只保存当次证据，不代替规则 |
| 数据库连接、迁移命令与写入边界 | [数据库连接与迁移](database-psql.md) | README、编辑器规则、部署文档仅链接命令契约 |
| 应用发布、切换与故障恢复 | [生产部署](deployment.md) | 指定版本允许迁移名单以该提交的 workflow 为准；发布记录是快照 |
| 登录、认证提供商与短信配置 | [登录与短信](phone-auth.md) | [管理员建号](custom-sms-and-manual-users.md) 只维护管理接口和使用限制 |
| 代币发放、扣费、退款与预算 | [小迪代币计费](ai/tutor-credit-accounting.md) | 会员交接和待办不复制额度或换算规则 |
| 会员开售、履约与验收 | [会员开售交接](MEMBERSHIP_PAGE_HANDOFF.md) | 不据此认定真实收款、退款或权益验收通过 |
| 语音模型、配置、音色、共享预算和取消 | [语音协议与验收](ai/voice-31-upgrade.md) | 课程文档只维护课程控制体验；计费文档只说明是否纳入代币 |
| 手机搭建、有限口令及课程内限制 | [手机积木搭建](courses/mobile-building-experience.md) | 模型接入和价格不在此另写一份 |
| AI 语义决策与确定性协议边界 | [AI 开发规范](AI_DEVELOPMENT_GUIDELINES.md) | 各功能引用规范，不扩大有限口令例外 |
| 页面身份、品牌验收、验证文件及推送入口 | [SEO 索引清单](seo-indexing-checklist.md) | [日常运营](seo-daily-operations.md) 只维护频率、故障流程和记录方法 |
| 商城渠道、采购和履约边界 | [商城决策](STORE_CHANNEL_FULFILLMENT_DECISION.md) | 方向、架构和待办不另外承诺自动采购或已开售 |

“唯一来源”是文档分工，不允许文档覆盖实际代码、已确认产品决定或生产证据。发现冲突须核对日期、提交与适用环境，再修正对应来源；不得为匹配旧说明改变产品行为。

## 其他现行专题

| 文档 | 负责内容 |
|---|---|
| [设计规范](design-system.md) | 布局、组件、字体和样式 |
| [PBL 指南](PBL_CHALLENGE_GUIDE.md) | 挑战内容及系统契约 |
| [品牌源素材](brand-assets/README.md) | 非运行时品牌导出稿、配色备选与统一 Logo 入口 |
| [互动资格](TRUST_AND_INTERACTION_ACCESS.md) | 阅读、写入、角色与安全资格 |
| [内容分级](CONTENT_CLASSIFICATION_IMPLEMENTATION.md) | 三轴规则、审核和开关 |
| [探索记录](EXPLORATION_RECORDS.md) | 普通项目记录、公开审核与草稿恢复 |
| [课程进度与奖励](COURSE_PROGRESS_REWARDS_AND_STEAM_IMPLEMENTATION.md) | 完成契约、奖励、里程碑和审计 |
| [Scratch 维护与验收](SCRATCH_CURRICULUM_ROLLOUT.md) | 导入、旧课保护和真实账号续学 |
| [注册资料补建](ensure-profile.md) | 触发器、服务端兜底和待核验事项 |
| [物种图鉴](NATURE_SPECIES_ATLAS_IMPLEMENTATION.md) | 图鉴读模型、缩略图和核查 |
| [游乐场联网](playground-online-features.md) | 对战、竞速及房间生命周期 |
| [LDraw 状态](ldraw-status.md) | 资源状态汇总，不把候选当上线 |
| [LDraw 发布](ldraw-publishing.md) | 资源上传、回读、挂载与缓存 |
| [维护入口退役与第二轮资源清理](maintenance/repository-cleanup-phase2.md) | 旧生产删除链停用、历史脚本入口、资源范围与验证边界 |
| [小班材料覆盖](courses/lesson-kit-coverage-small-class.md) | 对应库存和核算限制 |
| [中班/大班材料覆盖](courses/lesson-kit-coverage-middle-senior.md) | 对应模型和核算限制 |
| [SEO 周报模板](seo-weekly-report-template.csv) | 页面与搜索词记录 |
| [sitemap 检查模板](seo-sitemap-check-template.csv) | 技术、实时测试和后台读取分层记录 |

## 当前、历史与验证状态

每次更新涉及状态时，分别记录：检查日期、提交/版本、环境、证据、仍未验证的项目。代码已合入、发布配置已纳入、迁移已执行、真实业务已验收是四个独立结论；没有证据写“本次未核验”，不能把旧的“未执行”改成新的“已完成”。

生产状态属于相应版本的发布/验收记录，不在多个通用指南维护“本次尚未上线”。定价或数量必须注明对象、日期和来源；不同批次的计数、原 ID 和哈希不为表面一致而改写。

新规则更新其唯一来源，并检查入链文档是否重复了旧值。历史命令、测试结果和排障过程放入 `archive/`；删除跳转页前核对仓库入链及外部兼容需要，体积小的兼容入口不以数量为清理目标。可被脚本读取的清单须先检查依赖，不因它是 JSON 或放在 docs 内就删除。

## 发布记录与历史入口

- [2026-10-13 运行时迁移配置快照](releases/2026-10-13/runtime-migrations.md)：解释当前基线的白名单与发布边界，不是生产执行凭证。
- [旧昆虫工具归档](archive/scripts/2026-10-13/README.md)：两个缺少输入且无调用的旧入口的源代码快照；不代表生产数据清理已完成。
- [2026-10-09 发布包](releases/2026-10-09/README.md)：其资产清单仍保留原位置和历史事实。
- [本轮文档整理与原始快照](archive/documentation/2026-10-13/README.md)：完整旧索引、登录排障、会员交付、语音/计费/手机验收原记录。
- [科学第三批](archive/science/2026-10-12/batch3.md)、[科学第四批](archive/science/2026-10-12/batch4.md)：原文和计数保留；根目录旧地址只作迁移指引。
- [科学 55 项](archive/science/2026-10-10/README.md)、[科学扩展](archive/science/2026-10-09/expansion/README.md)、[科学五页样板](archive/science/2026-10-09/science-samples-review.md)、[趣味实验](archive/content/2026-09-21/fun-science-content.md)、[科教版](archive/content/2026-09-21/science-kit-content.md)、[视频分类](archive/content/2026-09-21/video-classification.md)。
- [探索页历史](archive/explore/2026-09-22-optimization.md)、[内容分诊历史](archive/content/2026-08-13/content-triage.md)、[3+ 发布记录](archive/ldraw/releases/2026-09-15/release-notes.md)、[LDraw 历史总账](archive/ldraw/ldraw-model-audit.md)、[LDraw 状态历史快照](archive/ldraw/ldraw-status-history-2026-09-15.md)、[PROJECT_INDEX LDraw 过程归档](archive/ldraw/project-index-ldraw-history-2026-09-15.md)、[2026-09-08 确认记录](archive/ldraw/ldraw-confirmed-2026-09-08.md)、[2026-09-09 挂载记录](archive/ldraw/ldraw-mounted-2026-09-09.md)。
- 历史产品方案：[PBL 阶段重构](archive/PBL_STAGE_FLOW_REDESIGN.md)、[免费课与积木变现](archive/free-course-and-brick-monetization-plan.md)、[2026-08-14 产品评审](archive/product-design-review-2026-08-14.md)。未完成项继续由 [下一步](next-step.md) 承接。

PR #76、#79 已与本页同批合入主分支（源素材移动与旧维护入口退役见上方对应文档）；合入代码不等于生产数据清理已完成。被 Git 忽略的本地设计图（`ui-gpt-designs/`）需自行备份到项目外，不能把文档整理当作它们已有备份的证明。
