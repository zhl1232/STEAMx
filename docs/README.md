# 文档导航与唯一规则来源

核对日期：2026-10-13；代码基线 `0a3cdd8c9d5e537ae6026eeb78f28b9b3a7634cb`。本轮整理上下文，不执行生产迁移、发布、交易或真实账号验收。

[根 README](../README.md) 负责介绍和启动，[项目索引](../PROJECT_INDEX.md) 负责定位代码。本页规定现行文档分工；同一规则不在多份文档复制维护。默认检索范围和开发授权见 [AGENTS.md](../AGENTS.md)。

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
| [物理实验室](physics-lab.md) | 主题实验、教学范围、模型边界与跨站备份 |
| [游乐场入口与联网](playground-online-features.md) | 亲子目录、探索记录口径、对战、竞速及房间生命周期 |
| [LDraw 状态](ldraw-status.md) | 资源状态汇总，不把候选当上线 |
| [LDraw 发布](ldraw-publishing.md) | 资源上传、回读、挂载与缓存 |
| [维护入口保护](maintenance/repository-cleanup-phase2.md) | 旧命令拒绝执行、遗留 purge 风险与回归边界 |
| [小班材料覆盖](courses/lesson-kit-coverage-small-class.md) | 对应库存和核算限制 |
| [中班/大班材料覆盖](courses/lesson-kit-coverage-middle-senior.md) | 对应模型和核算限制 |
| [SEO 周报模板](seo-weekly-report-template.csv) | 页面与搜索词记录 |
| [sitemap 检查模板](seo-sitemap-check-template.csv) | 技术、实时测试和后台读取分层记录 |

## 状态与留存

每次更新涉及状态时，分别记录检查日期、提交/版本、环境、证据和仍未验证的项目。代码已合入、发布配置已纳入、迁移已执行、真实业务已验收是独立结论；没有证据写“本次未核验”。定价或数量注明对象、日期和来源，不改写历史 ID、计数或哈希来制造一致。

当前代码树只保留现行规则、必要数据、有效证据和未完成事项。旧全文、重复快照、一次性交付日志优先留在 Git 历史和原 PR，不为每次整理再建全文备份、备份索引或清理报告。删除前先迁出有效约束并修正引用；发布脚本读取的清单、数据库迁移和模型确认记录仍须保留。

历史证据不在本导航逐项展开。确需追溯某个模型或科学来源时，从对应专题定位具体版本；未决模型限制尚未迁出前，不删除其唯一证据。被 Git 忽略的本地资料不因本规则自动获得备份。

例如只读查看精简前某一份文档：

```sh
git show 0d322eda40dfdf81c7feb4f37703c9b38bea2b15:docs/phone-auth.md
```

原文档和旧脚本按原提交、原路径读取，不整目录恢复到工作树；浅克隆缺少该提交时须先取得相应历史，不能把缺失当作从未存在。历史资料的默认读取边界统一由根 `AGENTS.md` 约定，不依赖特定编辑器的配置文件；终端、MCP 和其他工具均按任务定点读取。
