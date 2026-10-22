# 创探空间 — 项目功能索引

核对基线：2026-10-13，`0a3cdd8c9d5e537ae6026eeb78f28b9b3a7634cb`。本文件只帮助定位实现和规则，不维护额度、文件数量、批次日志或生产完成状态。

规则的唯一维护位置见 [文档导航](docs/README.md)，执行与发布授权见 [AGENTS.md](AGENTS.md)。遇到文档与代码不一致，先核对对应提交并修正文档；不要为迁就旧说明改变产品行为。

## 页面与学习主线

| 模块 | 先看这些位置 | 规则与边界 |
|---|---|---|
| 品牌、首页和全站布局 | `lib/brand.ts`、`lib/seo/site.ts`、`components/home/`、`components/layout/` | [SEO 页面身份](docs/seo-indexing-checklist.md)、[设计规范](docs/design-system.md) |
| 新人开始、可选指南和入门专题 | `app/start/`、`components/learning/`、`lib/product/`、`app/learn/` | [产品方向](docs/product-direction.md)、[内容质量](docs/content-quality.md) |
| 项目浏览、筛选、详情 | `app/explore/`、`app/project/`、`lib/project/`、`lib/explore/` | [产品架构](docs/product-architecture.md)、[探索记录](docs/EXPLORATION_RECORDS.md) |
| 课程目录、课时和工作区 | `app/courses/`、`lib/courses/`、`components/features/courses/` | [课程进度与奖励](docs/COURSE_PROGRESS_REWARDS_AND_STEAM_IMPLEMENTATION.md) |
| 积木模型、零件和套装核算 | `lib/courses/lesson-materials.ts`、`course-kit-config.ts`、`components/features/courses/lesson-materials-preparation.tsx`、`lib/utils/ldraw-*.ts`、`e2e/building-outline/`、`playwright.building-outline.config.ts` | [手机搭建](docs/courses/mobile-building-experience.md)、[小班材料覆盖](docs/courses/lesson-kit-coverage-small-class.md)、[中大班材料覆盖](docs/courses/lesson-kit-coverage-middle-senior.md) |
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
| 登录、密码、短信 | `components/auth/auth-flow.tsx`、`lib/context/login-prompt-context.tsx`、`lib/auth/visit-prompt.ts`、`hooks/use-login-continuation.ts`、`app/login/`、`app/api/auth/sms/`、`lib/auth/phone-provider.ts`、`lib/sms/` | [登录与短信](docs/phone-auth.md) |
| 管理员创建账号 | `app/api/admin/users/` | [管理员建号](docs/custom-sms-and-manual-users.md) |
| 注册资料补建 | `lib/supabase/`、相关 `handle_new_user` 迁移 | [资料补建](docs/ensure-profile.md) |
| 身份、内容访问与审核 | `lib/access/`、`lib/content-classification/`、`lib/content-filter/`、`app/admin/` | [互动资格](docs/TRUST_AND_INTERACTION_ACCESS.md)、[内容分级](docs/CONTENT_CLASSIFICATION_IMPLEMENTATION.md) |
| 个人中心、时间线和内容库 | `app/profile/`、`components/profile/`、`components/features/profile/`、`lib/profile/` | [产品架构](docs/product-architecture.md)、[设计规范](docs/design-system.md) |
| 等级、徽章与奖励 | `lib/gamification/`、`components/features/gamification/` | [课程奖励契约](docs/COURSE_PROGRESS_REWARDS_AND_STEAM_IMPLEMENTATION.md) |
| 欢迎消息与客服入口 | `components/features/communications/welcome-actions.tsx`、`lib/communications/types.ts`、`lib/product/support.ts`、`app/settings/about/` | [产品方向](docs/product-direction.md) |
| 私信、通知和自动互动 | `lib/messages/`、`lib/notifications/`、`lib/communications/`、`lib/auto-interactions.ts` | [互动资格](docs/TRUST_AND_INTERACTION_ACCESS.md) |
| 商品、供应商和订单 | `lib/store/`、`lib/store/service.ts` | [商城与履约](docs/STORE_CHANNEL_FULFILLMENT_DECISION.md) |
| 会员资格与开售准备 | `lib/membership.ts`（`/membership` 页面已下线，301 跳首页） | [开售交接](docs/MEMBERSHIP_PAGE_HANDOFF.md)；额度不在交接页重复维护 |

## 小迪与 AI

| 需要修改什么 | 实现入口 | 文档 |
|---|---|---|
| 模型接入与回复引擎 | `lib/ai/dashscope.ts`、`lib/ai/tutor/engine.ts`、`app/api/tutor/chat/` | [AI 开发规范](docs/AI_DEVELOPMENT_GUIDELINES.md) |
| 资源、工具、截图、鸟鸣规划 | `lib/ai/tutor/resource-search-planner.ts`、`tool-call-planner.ts`、`scratch-screenshot-diagnosis.ts`、`audio-tags.ts` | [AI 决策边界](docs/AI_DEVELOPMENT_GUIDELINES.md) |
| 用量、预算与结算 | `lib/ai/tutor/usage.ts`、相关 `*_tutor_*billing.sql` / `*_ai_credit_grants.sql` | [代币计费](docs/ai/tutor-credit-accounting.md) |
| 语音接入、音色与取消 | `lib/ai/tutor/speech.ts`、`speech-task.ts`、`voice-access.ts`、`voice-catalog.ts`、`app/api/tutor/speech/` | [语音协议与验收](docs/ai/voice-31-upgrade.md) |
| 面板、音频会话与缓存 | `components/features/tutor/` | [语音协议与验收](docs/ai/voice-31-upgrade.md) |
| 课程有限语音控制 | `components/features/courses/building-voice-controls.tsx`、`use-building-voice-controls.ts`、`building-voice-capture.ts`、`building-voice-preparation.ts`、`use-building-voice-preparation.ts`、`lib/courses/building-voice-commands.ts`、`building-voice-asr.ts`、`public/courses/vosk/v1/`、`scripts/prepare-building-vosk.py`、`playwright.building-vosk.config.ts` | [手机搭建](docs/courses/mobile-building-experience.md) |

## 工程、资源与发布

| 事项 | 实现入口 | 文档 |
|---|---|---|
| 命令、依赖、单元与浏览器检查 | `package.json`、`.github/workflows/ci.yml`、`__tests__/`、`e2e/` | [本地启动](README.md) |
| 数据库迁移 | `scripts/db-push.mjs`、`supabase/migrations/` | [数据库连接与迁移](docs/database-psql.md) |
| Docker、Nginx、worker 与回滚 | `Dockerfile`、`deploy/`、`.github/workflows/release.yml`、`scripts/release-scope.mjs` | [部署](docs/deployment.md) |
| LDraw 源文件、审核和正式资源 | `scripts/ldraw-models/`、`scripts/ldraw-reviews/`、`public/courses/ldraw/`、`scripts/publish-ldraw-assets.mjs` | [资源发布](docs/ldraw-publishing.md)、[资源状态](docs/ldraw-status.md) |
| 公开图片与 OSS 路径 | `lib/utils/asset-url.ts`、`lib/assets/`、`public/`、`.gitignore`、`.dockerignore` | [SEO 图片核验](docs/seo-indexing-checklist.md)、[LDraw 发布](docs/ldraw-publishing.md) |
| SEO、爬虫、sitemap 与推送 | `lib/seo/`、`lib/project/effective-updated-at.ts`、`scripts/check-seo.mjs`、`next.config.mjs`、`playwright.project-card.config.ts` | [索引检查](docs/seo-indexing-checklist.md)、[日常运营](docs/seo-daily-operations.md) |

历史批次命令不作为日常快捷命令列出。旧内容分诊自动工作流已移除，编排与固定数学题面命令仅拒绝执行；不要把旧 purge 当作通用孤儿资源清理器。保护边界见 [维护入口](docs/maintenance/repository-cleanup-phase2.md)。代码中的退役不等于历史生产数据清理已完成。

## 维护方式

新增模块时补“职责、代码入口、唯一规则来源”；产品常量、协议限额与执行结果只在对应专题更新。代码检出与文件检索负责精确定位，不在索引手工维护全量文件计数。

默认阅读范围见 [AGENTS.md](AGENTS.md)。旧索引和交付过程通过 Git 历史追溯，不在当前代码树保存另一套全文。
