# 文档导航

这里维护当前规则、操作说明和待办。代码位置见 [项目索引](../PROJECT_INDEX.md)，历史方案与验收过程放在 `archive/`，不作为当前实现说明。2026-10-12 完成一批方向、状态与归档整理；这次是代码和文档核对，不替代生产或真实家庭验收。

## 当前规则与开发规范

| 文档 | 用途 |
|---|---|
| [产品方向](product-direction.md) | 长期理念、首批用户假设、网站推广与商城准备的当前顺序 |
| [产品架构](product-architecture.md) | 项目、课程、实践、记录与商城的已有边界，以及待讨论差异 |
| [内容质量与验收](content-quality.md) | 材料/视频/模型/实物/家庭使用的证据口径与内容核验规则 |
| [AI 开发规范](AI_DEVELOPMENT_GUIDELINES.md) | 模型决策与服务端确定性边界 |
| [小迪代币计费](ai/tutor-credit-accounting.md) | 会员月度与每日赠币、实际模型用量、代币结算、客户展示与语音成本边界 |
| [设计规范](design-system.md) | 布局、组件、字体和样式约定 |
| [PBL 指南](PBL_CHALLENGE_GUIDE.md) | 挑战内容生产与当前系统规则 |
| [互动资格与内容访问](TRUST_AND_INTERACTION_ACCESS.md) | 能力矩阵、登录与账号限制、权限实现 |
| [商城渠道决策](STORE_CHANNEL_FULFILLMENT_DECISION.md) | 站内交易准备、人工采购与供应商代发；支付及开售条件 |
| [探索记录](EXPLORATION_RECORDS.md) | 普通项目记录的公开审核契约与本地文字恢复边界 |

## 维护与操作

| 文档 | 用途 |
|---|---|
| [数据库连接与迁移](database-psql.md) | 连接诊断、正式迁移入口与执行边界 |
| [应用部署](deployment.md) | Docker、CI 与生产发布操作 |
| [手机认证](phone-auth.md) | 登录、提供商切换与历史排查状态 |
| [注册资料补建](ensure-profile.md) | 触发器、服务端兜底与待核对的生产验收 |
| [短信与手动用户](custom-sms-and-manual-users.md) | 短信配置和账号创建流程 |
| [内容分级](CONTENT_CLASSIFICATION_IMPLEMENTATION.md) | 三轴规则、审核、开关与运维 |
| [课程进度与奖励](COURSE_PROGRESS_REWARDS_AND_STEAM_IMPLEMENTATION.md) | 完成契约、奖励、里程碑与审计 |
| [Scratch 维护与验收](SCRATCH_CURRICULUM_ROLLOUT.md) | 导入、旧课保护、发布顺序与真实账号保存/续学验收 |
| [小班材料覆盖](courses/lesson-kit-coverage-small-class.md) | 默认库存、替代规则与小班课时粗算范围 |
| [中班/大班材料覆盖](courses/lesson-kit-coverage-middle-senior.md) | 默认库存、扫描模型范围与缺件说明 |
| [物种图鉴](NATURE_SPECIES_ATLAS_IMPLEMENTATION.md) | 图鉴读模型、缩略图与发布核查 |
| [游乐场联网](playground-online-features.md) | 对战、竞速和房间生命周期 |
| [LDraw 当前状态](ldraw-status.md) | 历史发布基线、后续确认候选与待核对状态 |
| [手机积木搭建体验](courses/mobile-building-experience.md) | 成品图、视角连续性、明确开启的语音口令、识别成本与手机验收边界 |
| [LDraw 课程资源发布](ldraw-publishing.md) | 模型独立 OSS 发布、应用发布范围、首次启用与版本缓存规则 |
| [SEO / GEO 索引清单](seo-indexing-checklist.md) | Sitemap、站长验证、百度推送与高价值 URL |
| [SEO / GEO 日常检查](seo-daily-operations.md) | 发布检查、每日异常检查、三个专题及 Google/百度/Bing 效果跟踪 |
| [SEO 周报模板](seo-weekly-report-template.csv) | 按平台、页面、查询词记录真实数据和复查计划 |
| [站点地图检查模板](seo-sitemap-check-template.csv) | 分别记录公开技术检查、Google 实时测试和后台 sitemap 读取结果 |

## 待办与历史

- [下一步](next-step.md)：集中维护当前任务、优先级和关闭条件；网站试推广与商城准备并行，已完成事项回到模块说明。
- 待验收和专项依据：[会员开售差异](MEMBERSHIP_PAGE_HANDOFF.md)。科学五页样板与科学扩展批次已归档，见下方历史记录；其中未完成项仍由 [下一步](next-step.md) 承接。
- [2026-10-09 发布包](releases/2026-10-09/README.md) 保留原目录；其中资产清单仍被发布脚本读取，发布候选不等于生产完成。
- 2026-10-12 归档的批次记录：[趣味实验核对](archive/content/2026-09-21/fun-science-content.md)、[科教版内容整理](archive/content/2026-09-21/science-kit-content.md)、[视频分类调整](archive/content/2026-09-21/video-classification.md)、[探索页与封面调整](archive/explore/2026-09-22-optimization.md)、[3+ 模型 2026-09-15 发布](archive/ldraw/releases/2026-09-15/release-notes.md)、[内容分诊硬删除](archive/content/2026-08-13/content-triage.md)、[科学五页样板](archive/science/2026-10-09/science-samples-review.md)、[科学扩展批次](archive/science/2026-10-09/expansion/README.md)、[科学 55 项发布说明](archive/science/2026-10-10/README.md)。原路径保留迁移指引；science55 / science-expansion 目录下的 json 留在原处；原正文、数量与哈希作为历史证据保留。
- 历史产品方案：[PBL 阶段重构](archive/PBL_STAGE_FLOW_REDESIGN.md)、[免费课与积木变现](archive/free-course-and-brick-monetization-plan.md)、[2026-08-14 产品评审](archive/product-design-review-2026-08-14.md)。
- [LDraw 历史总账](archive/ldraw/ldraw-model-audit.md)、[状态历史快照](archive/ldraw/ldraw-status-history-2026-09-15.md)、[PROJECT_INDEX LDraw 过程归档](archive/ldraw/project-index-ldraw-history-2026-09-15.md)与各批次原始记录保留验收依据；[2026-09-08 确认记录](archive/ldraw/ldraw-confirmed-2026-09-08.md)和[2026-09-09 挂载记录](archive/ldraw/ldraw-mounted-2026-09-09.md)已归档，最新汇总从 [LDraw 当前状态](ldraw-status.md)进入。
- `ui-gpt-designs/` 是被 Git 忽略的本地设计参考图，不属于受版本管理的文档；需要保留的参考图应自行备份到项目外。

## 维护约定

- 同一规则只维护一个来源，其余文件用链接引用；`PROJECT_INDEX.md` 负责定位，不重复记录批次过程。
- 当前事实、阶段性决定、待验证假设、历史快照与未实施计划必须明确区分。涉及线上数量、开关、迁移或发布状态时，注明检查日期和证据，不从代码存在推断已上线。
- 合并或归档前迁移未完成事项及有效约束，并更新入口和引用；历史记录不继续承担当前待办职责。
- 已执行迁移、发布白名单和哈希清单保留当时事实，不为路径整理改写其历史内容；需要兼容旧引用时在旧文档路径留简短指引。脚本直接读取的文件须先核对依赖再移动。
- 关键状态写明检查日期与证据；没有重新核验时保留“待核对”，不能把代码合入、资源发布、数据库更新与实物验证合并成一个完成状态。
