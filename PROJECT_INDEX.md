# 创探空间 — 项目功能索引

核对基线：2026-10-13，`0d322eda40dfdf81c7feb4f37703c9b38bea2b15`。本文件只帮助定位实现和规则，不维护额度、文件数量、批次日志或生产完成状态。

规则的唯一维护位置见 [文档导航](docs/README.md)，执行与发布授权见 [AGENTS.md](AGENTS.md)。遇到文档与代码不一致，先核对对应提交并修正文档；不要为迁就旧说明改变产品行为。

## 页面与学习主线

| 模块 | 先看这些位置 | 规则与边界 |
|---|---|---|
| 品牌、首页和全站布局 | `lib/brand.ts`、`lib/seo/site.ts`、`components/home/`、`components/layout/` | [SEO 页面身份](docs/seo-indexing-checklist.md)、[设计规范](docs/design-system.md) |
| 探索指南和入门专题 | `components/learning/`、`lib/product/`、`app/learn/` | [产品方向](docs/product-direction.md)、[内容质量](docs/content-quality.md) |
| 项目浏览、筛选、详情 | `app/explore/`、`app/project/`、`lib/project/`、`lib/explore/` | [产品架构](docs/product-architecture.md)、[探索记录](docs/EXPLORATION_RECORDS.md) |
| 课程目录、课时和工作区 | `app/courses/`、`lib/courses/`、`components/features/courses/` | [课程进度与奖励](docs/COURSE_PROGRESS_REWARDS_AND_STEAM_IMPLEMENTATION.md) |
| 积木模型、零件和套装核算 | `lib/courses/lesson-materials.ts`、`course-kit-config.ts`、`components/features/courses/lesson-materials-preparation.tsx`、`lib/utils/ldraw-*.ts` | [手机搭建](docs/courses/mobile-building-experience.md)、[小班材料覆盖](docs/courses/lesson-kit-coverage-small-class.md)、[中大班材料覆盖](docs/courses/lesson-kit-coverage-middle-senior.md) |
| Scratch 工作区与内容 | `packages/scratch-host/`、`components/features/courses/`、`lib/courses/` | [Scratch 维护与验收](docs/SCRATCH_CURRICULUM_ROLLOUT.md) |
| PBL 挑战 | `app/create/`、`app/pbl/`、`lib/pbl/`、`components/features/challenge/` | [PBL 指南](docs/PBL_CHALLENGE_GUIDE.md) |
| 一次实践与过程记录 | `lib/journeys/`、`lib/project/record-input.ts`、`record-draft.ts`、`app/api/journeys/` | [产品架构](docs/product-architecture.md)、[探索记录](docs/EXPLORATION_RECORDS.md) |
| 统一作品及分享 | `lib/works/`、`components/features/works/`、`app/works/` | [内容质量](docs/content-quality.md)、[互动资格](docs/TRUST_AND_INTERACTION_ACCESS.md) |
| 自然首页、物种图鉴和观察 | `app/nature/`、`lib/nature-species-atlas.ts`、`lib/api/nature-observation-*`、`components/features/bird-observation/` | [物种图鉴](docs/NATURE_SPECIES_ATLAS_IMPLEMENTATION.md)、[内容质量](docs/content-quality.md) |
| 游乐场及联网玩法 | `app/playground/`、`lib/playground/` | [联网玩法](docs/playground-online-features.md) |

表中的短文件名相对于同格明确给出的目录；带 `*` 的位置表示文件组，不是可直接执行的路径。

## 账号、互动与服务

| 模块 | 实现入口 | 唯一规则来源 |
|---|---|---|
| 登录、密码、短信 | `components/auth/auth-flow.tsx`、`app/login/`、`app/api/auth/sms/`、`lib/auth/phone-provider.ts`、`lib/sms/` | [登录与短信](docs/phone-auth.md) |
| 管理员创建账号 | `app/api/admin/users/` | [管理员建号](docs/custom-sms-and-manual-users.md) |
| 注册资料补建 | `lib/supabase/`、相关 `handle_new_user` 迁移 | [资料补建](docs/ensure-profile.md) |
| 身份、内容访问与审核 | `lib/access/`、`lib/content-classification/`、`lib/content-filter/`、`app/admin/` | [互动资格](docs/TRUST_AND_INTERACTION_ACCESS.md)、[内容分级](docs/CONTENT_CLASSIFICATION_IMPLEMENTATION.md) |
| 个人中心、时间线和内容库 | `app/profile/`、`components/profile/`、`components/features/profile/`、`lib/profile/` | [产品架构](docs/product-architecture.md)、[设计规范](docs/design-system.md) |
| 等级、徽章与奖励 | `lib/gamification/`、`components/features/gamification/` | [课程奖励契约](docs/COURSE_PROGRESS_REWARDS_AND_STEAM_IMPLEMENTATION.md) |
| 私信、通知和自动互动 | `lib/messages/`、`lib/notifications/`、`lib/communications/`、`lib/auto-interactions.ts` | [互动资格](docs/TRUST_AND_INTERACTION_ACCESS.md) |
| 商品、供应商和订单 | `lib/store/`、`lib/store/service.ts` | [商城与履约](docs/STORE_CHANNEL_FULFILLMENT_DECISION.md) |
| 会员资格与开售准备 | `lib/membership.ts`、`app/membership/` | [开售交接](docs/MEMBERSHIP_PAGE_HANDOFF.md)；额度不在交接页重复维护 |

## 小迪与 AI

| 需要修改什么 | 实现入口 | 文档 |
|---|---|---|
| 模型接入与回复引擎 | `lib/ai/dashscope.ts`、`lib/ai/tutor/engine.ts`、`app/api/tutor/chat/` | [AI 开发规范](docs/AI_DEVELOPMENT_GUIDELINES.md) |
| 资源、工具、截图、鸟鸣规划 | `lib/ai/tutor/resource-search-planner.ts`、`tool-call-planner.ts`、`scratch-screenshot-diagnosis.ts`、`audio-tags.ts` | [AI 决策边界](docs/AI_DEVELOPMENT_GUIDELINES.md) |
| 用量、预算与结算 | `lib/ai/tutor/usage.ts`、相关 `*_tutor_*billing.sql` / `*_ai_credit_grants.sql` | [代币计费](docs/ai/tutor-credit-accounting.md) |
| 语音接入、音色与取消 | `lib/ai/tutor/speech.ts`、`speech-task.ts`、`voice-access.ts`、`voice-catalog.ts`、`app/api/tutor/speech/` | [语音协议与验收](docs/ai/voice-31-upgrade.md) |
| 面板、音频会话与缓存 | `components/features/tutor/` | [语音协议与验收](docs/ai/voice-31-upgrade.md) |
| 课程有限语音控制 | `components/features/courses/building-voice-controls.tsx`、`use-building-voice-controls.ts`、`building-voice-capture.ts`、`lib/courses/building-voice-commands.ts` | [手机搭建](docs/courses/mobile-building-experience.md) |

## 工程、资源与发布

| 事项 | 实现入口 | 文档 |
|---|---|---|
| 命令、依赖、单元与浏览器检查 | `package.json`、`.github/workflows/ci.yml`、`__tests__/`、`e2e/` | [本地启动](README.md) |
| 数据库迁移 | `scripts/db-push.mjs`、`supabase/migrations/` | [数据库连接与迁移](docs/database-psql.md) |
| Docker、Nginx、worker 与回滚 | `Dockerfile`、`deploy/`、`.github/workflows/release.yml`、`scripts/release-scope.mjs` | [部署](docs/deployment.md) |
| LDraw 源文件、审核和正式资源 | `scripts/ldraw-models/`、`scripts/ldraw-reviews/`、`public/courses/ldraw/`、`scripts/publish-ldraw-assets.mjs` | [资源发布](docs/ldraw-publishing.md)、[资源状态](docs/ldraw-status.md) |
| 公开图片与 OSS 路径 | `lib/utils/asset-url.ts`、`lib/assets/`、`public/`、`.gitignore`、`.dockerignore` | [SEO 图片核验](docs/seo-indexing-checklist.md)、[LDraw 发布](docs/ldraw-publishing.md) |
| SEO、爬虫、sitemap 与推送 | `lib/seo/`、`scripts/check-seo.mjs`、`next.config.mjs` | [索引检查](docs/seo-indexing-checklist.md)、[日常运营](docs/seo-daily-operations.md) |

历史批次命令不作为日常快捷命令列出。按本索引基线，旧内容分诊入口和固定数学题面工具仍存在；退役方案在 PR #79，未合并不能写成已停用。不要执行旧编排或把旧 purge 当作通用孤儿资源清理器。其索引修订应在退役实际合并后核对本节，而非机械应用旧版字符串补丁。

## 维护方式

新增模块时补“职责、代码入口、唯一规则来源”；产品常量、协议限额与执行结果只在对应专题更新。代码检出与文件检索负责精确定位，不在索引手工维护全量文件计数。

本轮压缩前的完整索引及历史实现说明保留在 [文档快照](docs/archive/documentation/2026-10-13/README.md)。它是追溯材料，不是第二套现行规范；尚未重新核验的细节应从本表代码入口核对，不将历史“尚未发布”或数量沿用为现状。
