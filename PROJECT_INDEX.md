# STEAM 探索 — 项目功能索引

> 本文档为 AI 阅读代码时的导航索引。按功能模块组织，标注每个模块的职责与关键文件位置。
>
> 开发约定：
> - AI/自动化工具开始改动前，先阅读本文档对应模块；不确定文件归属时，先补充索引再改代码。
> - 新增功能、新路由、共享模块、脚本、数据库结构或重要行为变更时，同步更新本文档。
> - 本项目使用 Next.js 16，根级请求拦截入口必须使用 `proxy.ts` 并导出 `proxy`；不要新建或恢复已废弃的 `middleware.ts`。

---

## 1. 页面路由 (`app/`)

| 路由 | 入口文件 | 功能说明 |
|------|----------|----------|
| `/` | `app/page.tsx` | 首页 — 推荐项目轮播、6 个热门项目、社区动态 Feed、STEAM 分类磁贴入口 |
| `/explore` | `app/explore/page.tsx` | 探索页 — 项目搜索、分类/子分类筛选、排序；子路由 `observations/`（观察列表）、`species/`（物种档案） |
| `/project/[id]` | `app/project/[id]/page.tsx` | 项目详情 — 步骤、材料清单、评论、点赞/收藏、完成记录、打赏 |
| `/community` | `app/community/page.tsx` | 社区 — 讨论列表、发帖；子路由 `challenge/`（挑战详情）、`discussion/`（帖子详情） |
| `/nature` | `app/nature/page.tsx` | 自然观察首页 — Hero 下方专题分类（鸟类/昆虫/树木/真菌；专题图经统一 OSS 资源重写链路加载），其后为最近观察地图流（观察记录列表按发布时间 `created_at` 倒序）；桌面端侧栏保留社区贡献与观察概览；子路由 `observations/`（列表按发布时间倒序）、`observations/[id]/`（详情：已通过记录显示社群共识条 + 动态时间轴 + 物种比较 Bottom Sheet + 底部评论/建议鉴定，可选补充生命阶段与性别；共识确认后仍可继续认同或提交不同鉴定；待审/拒绝记录仅作者可见审核状态；`...` 菜单含删除/举报）、`species/`、`submit/`（移动端引导式发布；公开准确位置需显式确认）、`map/` |
| `/playground` | `app/playground/page.tsx` | 益智游乐场 — 10 个互动游戏（2048、24点、五子棋、扫雷、汉诺塔、数独、N皇后、排序可视化、电路、生命游戏） |
| `/profile` | `app/profile/page.tsx` | 个人主页 — 作品展示、STEAM 雷达图、成长任务、学习打卡；子路由 `library/`、`timeline/`、`likes/`、`followers/`、`following/` |
| `/settings` | `app/settings/page.tsx` | 用户设置 — 子路由 `profile/`、`appearance/`、`notifications/`、`privacy/`、`security/`、`about/` |
| `/login` | `app/login/page.tsx` | 登录页 — 手机号 + 短信验证码登录 |
| `/auth/callback` | `app/auth/callback/` | Supabase Auth OAuth 回调处理 |
| `/leaderboard` | `app/leaderboard/page.tsx` | 排行榜 — 经验值/等级排名 |
| `/shop` | `app/shop/page.tsx` | 积分商店 — 用金币兑换头像框、名字颜色等虚拟物品 |
| `/coins` | `app/coins/page.tsx` | 金币页 — 余额、收支记录 |
| `/messages` | `app/messages/page.tsx` | 消息中心 — 通知分类、私信会话列表、未读角标；子路由 `[userId]/` 聊天详情 |
| `/share` | `app/share/page.tsx` | 分享/创建项目页 |
| `/create` | `app/create/page.tsx` | 创造营 — PBL 挑战 + **训练营** Tab；`/create` 重定向自 `/community` |
| `/courses` | `app/courses/page.tsx` | Scratch 训练营列表 |
| `/courses/[courseId]` | `app/courses/[courseId]/page.tsx` | 课程详情与课时列表 |
| `/courses/.../lessons/[lessonId]` | `app/courses/[courseId]/lessons/[lessonId]/` | 课时学习页（侧栏步骤 + iframe Scratch 编辑器） |
| `/courses/.../preview` | `app/courses/.../lessons/[lessonId]/preview/` | 手机端作品预览（player 模式） |
| `/users/[id]` | `app/users/[id]/` | 其他用户的公开主页 |
| `/admin` | `app/admin/page.tsx` | 管理后台 — 项目审核、探索记录审核、自然观察审核、挑战作品审核、举报/挑战/训练营管理；子路由 `projects/`、`moderator-applications/` |
| `/moderator/apply` | `app/moderator/apply/` | 申请成为审核员 |
| `/legal` | `app/legal/` | 法律条款 — `privacy/`（隐私政策）、`terms/`（服务条款） |
| `/badges-preview` | `app/badges-preview/page.tsx` | 徽章样式预览（仅开发环境可访问） |
| `/design-system` | `app/design-system/page.tsx` | 设计系统静态展示（仅开发环境） |
| `/migrate` | `app/migrate/page.tsx` | 数据迁移说明页（CLI 指引） |

### 全局文件
- `app/layout.tsx` — 根布局：Provider 嵌套顺序（QueryProvider → AuthProvider → ThemeProvider）
- `app/globals.css` — 全局样式与 CSS 变量；统一页面 shell 移动端横向 gutter：16px，桌面按各 shell 规则放大
- `app/template.tsx` — 页面过渡模板
- `app/error.tsx` / `app/not-found.tsx` — 全局错误与 404
- `app/manifest.ts` / `app/robots.ts` / `app/sitemap.ts` — PWA & SEO
- `proxy.ts` — Next.js 16 Proxy 入口：补种匿名推荐 `rec_viewer` cookie（替代已废弃的 `middleware.ts`）
- `AGENTS.md` / `.cursor/rules/project-context.mdc` — AI/自动化工具项目约定：先读索引、同步维护索引、禁止恢复 `middleware.ts`

---

## 2. API 路由 (`app/api/`)

29 个 API 模块，每个目录下含 `route.ts`：

| 模块 | 路径 | 功能 |
|------|------|------|
| admin | `api/admin/` | 项目审核、完成记录审核、自然观察审核（通过后发放观察 XP/徽章并入公开互动队列）、标签管理、举报处理、审核员申请审批、挑战 CRUD、**训练营 CRUD**（`admin/courses/`） |
| assets | `api/assets/` | 本地开发用受限静态资源代理；仅代理已迁移到 OSS 的 `/birds`、`/insects`、`/trees`、`/projects` 资源。本地默认经代理带生产 Referer 拉取 OSS，以模拟线上 CDN 防盗链；生产环境直连 `NEXT_PUBLIC_ASSETS_BASE_URL`；非生产设置 `NEXT_PUBLIC_ASSETS_DISPLAY_MODE=direct` 可绕过代理直连排查 |
| courses | `api/courses/` | 训练营列表/详情；课时 `.sb3` 保存与 signed URL；完成课时 +XP |
| auth | `api/auth/` | 短信发送/验证、OAuth 回调 |
| challenges | `api/challenges/` | 挑战列表与评分 |
| comments | `api/comments/` | 项目评论 CRUD、点赞 |
| completions | `api/completions/` | 完成记录、评论、点赞、审核 |
| discussions | `api/discussions/` | 社区讨论 CRUD、点赞 |
| follows | `api/follows/` | 关注/取关、关注状态查询 |
| geo | `api/geo/` | 反向地理编码 |
| home | `api/home/` | 首页推荐数据 |
| internal | `api/internal/` | 内部 Worker 入口：完成记录审核、自动互动队列执行（短回复/点赞/收藏） |
| leaderboard | `api/leaderboard/` | 排行榜数据 |
| messages | `api/messages/` | 私信发送、会话列表、消息线程、未读计数、会话标记已读 |
| moderator | `api/moderator/` | 审核员资格检查、申请 |
| notifications | `api/notifications/` | 通知列表、标记已读、通知未读计数；全局入口汇总通知 + 私信未读 |
| observations | `api/observations/` | 自然观察 CRUD；提交先进入待审核，公开列表/点赞/评论/鉴定仅开放已通过记录 |
| profile | `api/profile/` | 个人资料摘要、成长任务、学习打卡 |
| projects | `api/projects/` | 项目 CRUD、编辑；项目点赞服务端写入作者通知 |
| replies | `api/replies/` | 回复 CRUD |
| reports | `api/reports/` | 举报提交 |
| settings | `api/settings/` | 用户设置更新 |
| species | `api/species/` | 物种查询 |
| tips | `api/tips/` | 打赏 |
| upload | `api/upload/` | 图片上传（Supabase Storage）：魔数/大小校验 + 通义千问图片安全审核，不通过或审核不可用时删除已上传对象 |
| upload-video | `api/upload-video/` | 视频上传 |
| users | `api/users/` | 用户公开信息查询 |
| xp | `api/xp/` | 经验值增减 |

---

## 3. 组件 (`components/`)

### 3.1 基础 UI (`components/ui/`) — 39 个组件
基于 shadcn/ui + Radix UI 的基础组件库：
`alert` · `avatar` · `avatar-with-frame` · `badge` · `button` · `card` · `checkbox` · `countdown-timer` · `dialog` · `difficulty-stars` · `dropdown-menu` · `filter-chip` · `image-upload` · `input` · `label` · `leaderboard-skeleton` · `loading-skeleton` · `mobile-page-header` · `optimized-image` · `page-status` · `progress` · `radio-group` · `report-dialog` · `role-badge` · `scroll-area` · `search-highlight` · `select` · `separator` · `sheet` · `skeleton` · `slider` · `surface` · `table` · `tabs` · `textarea` · `toast` · `toaster` · `tone-badge`
- `components/ui/loading-skeleton.tsx` — 项目/挑战/自然详情骨架屏；`ChallengeCardSkeleton` 支持可选 `className` 供页面局部统一圆角和外观。

### 3.2 布局 (`components/layout/`) — 13 个组件
- `conditional-app-shell.tsx` — 根据路由条件渲染 Header/BottomNav/Sidebar
- `bottom-nav.tsx` — 移动端底部导航
- `main-nav.tsx` — 桌面端顶部导航
- `mobile-global-header.tsx` — 移动端全局头部
- `header-search.tsx` — 头部搜索栏
- `user-button.tsx` — 用户头像菜单
- `notification-bell.tsx` — 通知铃铛
- `share-button.tsx` — 分享按钮
- `login-dialog.tsx` — 登录引导弹窗
- `logo.tsx` — 品牌 Logo
- `theme-provider.tsx` / `theme-toggle.tsx` — 主题切换
- `error-boundary.tsx` — 错误边界

### 3.3 首页 (`components/home/`)
- `home-showcase.tsx` — 首页主体：轮播、分类磁贴、6 个热门项目、推荐流、社区动态；自然观察频道图在桌面小屏保持整图显示
- `compact-project-grid-styles.ts` — 首页热门 / 探索列表共用的两列竖版项目卡网格与卡片样式 class
- `recommendation-panel.tsx` — 推荐项目面板

### 3.4 业务功能 (`components/features/`)

| 子目录 | 文件数 | 职责 |
|--------|--------|------|
| `bird-observation/` | 14 | 观察提交表单、照片上传、地图选点、观察卡片、物种热点面板、物种统计头像排行、评论区 |
| `challenge/` | 5 | 挑战提交表单、PBL 信息、评分星级、阶段指南、提交作品画廊 |
| `courses/` | 3 | 训练营列表 `course-board`、课时侧栏 `lesson-sidebar`、Scratch iframe `scratch-workspace` |
| `community/` | 1 | 讨论列表（含搜索、排序、分页） |
| `gamification/` | 10 | 徽章图标/画廊、等级进度、排行榜、成就 Toast、每日登录同步（登录用户首页也挂载，临时失败自动重试）、观察游戏化同步 |
| `moderator/` | 2 | 审核员申请表单 |
| `playground/` | 1 | 键盘帮助弹窗 |
| `project/` | 9 | 完成项目弹窗、项目详情操作栏、打赏弹窗、续做卡片 |
| `social/` | 2 | 关注按钮 |
| `shared/` | 2 | 通用评论卡片、底部回复框 |
| `profile/` | 15 | 头像上传、编辑资料弹窗、STEAM 雷达图、成长任务行、学习打卡卡片、骨架屏 |

### 3.5 管理后台 (`components/admin/`) — 9 个组件
项目审核卡片、探索记录审核、自然观察审核卡片、挑战管理、**训练营管理** `course-management`、完成审核、审核员申请列表、举报列表、全部项目管理

### 3.6 认证 (`components/auth/`)
- `auth-flow.tsx` — 完整登录/注册流程（手机号 + 验证码）

### 3.7 个人资料 (`components/profile/`) — 8 个组件
移动端个人主页、资料头部、作品库、点赞列表、时间线、用户列表、项目列表

### 3.8 其他
- `components/providers/query-provider.tsx` — TanStack Query Provider
- `components/icons/coin-icon.tsx` — 金币图标

---

## 4. 核心库 (`lib/`)

### 4.1 Supabase (`lib/supabase/`)
- `client.ts` — 浏览器端 Supabase 客户端
- `server.ts` — 服务端 Supabase 客户端（含 Cookie 处理）
- `admin.ts` — Service Role 管理客户端
- `rpc.ts` — RPC 调用封装
- `env.ts` — 环境变量读取
- `types.ts` — 数据库类型定义（自动生成）

### 4.2 上下文 (`lib/context/`)
- `auth-context.tsx` — 认证状态（用户、角色、登录/登出）
- `project-context.tsx` — 项目操作（CRUD、点赞、收藏、评论、完成记录）
- `community-context.tsx` — 社区操作（讨论、回复、点赞）
- `gamification-context.tsx` — 游戏化（XP 增减、徽章检查、等级计算）
- `notification-context.tsx` — 通知（获取、标记已读、通知未读 + 私信未读汇总计数）
- `login-prompt-context.tsx` — 未登录操作引导弹窗

### 4.3 API 服务层 (`lib/api/`) — 24 个模块
服务端 API 的核心业务逻辑，被 `app/api/` 路由调用：
- `auth.ts` / `auth-rate-limit.ts` — 认证与频率限制
- `explore-data.ts` — 探索页数据查询（搜索、筛选、排序）
- `categories.ts` — 分类与子分类
- `challenge-submissions.ts` / `challenge-settlement.ts` — 挑战提交与结算
- `nature-observation-*.ts` — 自然观察全套（首页/数据/事件/热点/物种/封面/审核）
- `observation-gamification.ts` — 观察游戏化逻辑
- `lib/observations/submit-topic.ts` — 观察提交专题（birds/plants/insects）归一化与文案
- `lib/observations/traits.ts` — 观察生命阶段/性别枚举、选项与展示文案
- `lib/observations/display.ts` — 观察详情标题（物种名 / AI 建议 / 未知类别）、日期格式化
- `lib/observations/consensus-ui.ts` — 社群共识进度（2 票规则；确认后仍可继续认同/不同鉴定）与 UI 文案
- `lib/observations/activity-stream.ts` — 鉴定与评论合并为动态流
- `lib/nature/action-buttons.ts` — 自然观察操作按钮统一样式（`tone=nature` / `outline` / `destructive` + `pill`）
- `project-access.ts` / `project-validation.ts` — 项目权限、文字安全与封面/步骤图片归属校验
- `challenge-submission-validation.ts` — 挑战投稿标题/说明/图片说明敏感词校验，证明图片/视频必须来自当前账号上传
- `completion-access.ts` — 完成记录权限
- `validation.ts` — 通用输入验证、敏感词校验、上传 URL 归属/本地可信资源校验
- `upstream-errors.ts` / `rate-limit.ts` — 错误处理与限流
- `types.ts` — API 层类型

### 4.4 配置 (`lib/config/`)
- `categories.ts` — STEAM 五大分类定义与图标
- `category-images.ts` — 分类封面图路径
- `nature-topics.ts` — 自然主题（鸟类、植物等）
- `project-steam-weights.ts` — 项目 STEAM 能力权重计算
- `subcategory-steam-weights.ts` — 子分类权重映射

### 4.5 游戏化 (`lib/gamification/`)
- `badges.ts` — 全部徽章定义（独立/阶梯/系列）；阶梯系列用 `tierNames` 独立成就名，档位可用 `BADGE_TIER_LABELS` 作说明文本；资料页精选徽章每个阶梯系列只取最高已解锁档，徽章图鉴展示全量档位
- `experience-rules.ts` — XP 经验规则与等级表；每日登录同步由 `DailyCheckInSync` 调用 `daily_check_in`，成功后触发连续打卡徽章检查
- `observation-events.ts` — 观察事件类型
- `types.ts` — 游戏化类型定义

### 4.6 SEO (`lib/seo/`)
- `metadata.ts` — 页面元数据构建工具 `buildPageMetadata()`
- `site.ts` — 站点基础配置（名称、URL、描述）

### 4.7 首页 (`lib/home/`)
- `recommendations.ts` — 首页推荐算法（6 个热门项目：按 STEAM 分类各取 1 个后用全站热门补齐；推荐流支持个性化/热门兜底）
- `community-feed.ts` — 社区动态 Feed 数据
- `category-tiles.ts` — 分类磁贴数据

### 4.8 个人资料 (`lib/profile/`)
- `timeline.ts` — 用户活动时间线
- `growth-tasks.ts` — 新手成长任务系统
- `steam-radar.ts` — STEAM 能力雷达图数据
- `study-checkin.ts` — 学习打卡逻辑
- `settings.ts` — 设置项读写
- `avatar-options.ts` — 默认头像选项

### 4.9 其他模块
| 模块 | 文件 | 职责 |
|------|------|------|
| `lib/mappers/` | `project.ts`, `types.ts` | 数据库行 → 前端模型映射 |
| `lib/shop/` | `items.ts` | 商店物品定义与价格 |
| `lib/ai/` | `qwen-vision.ts`, `observation-media-analysis.ts`, `upload-content-moderation.ts`, `auto-reply.ts` | 通义千问/DashScope AI：自然观察图像安全/质量/物种识别、通用上传图片安全审核、自动互动短回复生成 |
| `lib/auto-interactions.ts` | `auto-interactions.ts` | 自动互动队列：公开项目/完成记录/自然观察的延迟短回复、点赞与项目收藏 |
| `lib/sms/` | `aliyun.ts`, `send.ts` | 阿里云短信验证码 |
| `lib/content-filter/` | `index.ts`, `words-zh.ts`, `words-en.ts` | 敏感词过滤 |
| `lib/notifications/` | `navigation.ts` | 通知跳转路由映射 |
| `lib/community/` | `reply-utils.ts`, `featured-nature-challenges.ts` | 回复工具、精选挑战 |
| `lib/playground/` | `catalog.ts`, `storage.ts` | 游戏目录、本地/云端成绩存储 |
| `lib/utils/` | 11 个文件 | 文件校验、HTTP 工具、上传、手机号、拼音、自然导航、主题分类 |
| `lib/auth/` | `server.ts` | 服务端认证辅助 |
| `lib/testing/` | `playwright-smoke.ts` | E2E 测试辅助 |

### 4.10 根级工具文件
- `lib/schemas.ts` — Zod 验证 Schema（项目、评论、讨论等）
- `lib/logger.ts` — 结构化日志工具
- `lib/rate-limit.ts` — 内存速率限制器
- `lib/utils.ts` — `cn()` 样式合并工具
- `lib/date-utils.ts` — 日期格式化
- `lib/subcategories.ts` — 子分类定义
- `lib/reverse-geocode.ts` — 反向地理编码
- `lib/comment-image.ts` — 评论图片处理
- `lib/completion-records.ts` — 完成记录查询
- `lib/home-featured-slides.ts` — 首页轮播配置

---

## 5. Hooks (`hooks/`)

| Hook | 文件 | 功能 |
|------|------|------|
| `use-danmaku` | `hooks/use-danmaku.ts` | 弹幕系统 |
| `use-follow` | `hooks/use-follow.ts` | 关注/取关逻辑 |
| `use-messages` | `hooks/use-messages.ts` | 私信会话、消息分页、未读数与会话已读 |
| `use-moderator-eligibility` | `hooks/use-moderator-eligibility.ts` | 审核员资格检查 |
| `use-observation-interactions` | `hooks/use-observation-interactions.ts` | 观察记录互动（点赞等） |
| `use-toast` | `hooks/use-toast.ts` | Toast 通知管理 |
| `use-gamification-data` | `hooks/gamification/` | 游戏化数据（徽章、XP、等级） |
| `use-profile-observations` | `hooks/profile/` | 个人观察记录 |
| `use-2048` 等 | `hooks/playground/` | 19 个游戏逻辑 Hook（2048/24点/五子棋/扫雷/汉诺塔/数独/N皇后/排序/电路/生命游戏） |

---

## 6. 数据库 (`supabase/`)

- `supabase/migrations/` — **168 个**迁移文件（含 schema、RLS、RPC、种子数据）；训练营：`20260528100000_courses_training_camp.sql`、`20260528110000_seed_scratch_course.sql`；登录连续天数 RPC：`20260603120000_restore_user_login_stats_rpc.sql`；私信已读状态：`20260604120000_messages_read_state.sql`；自动互动账号与队列：`20260605100000_auto_interactions.sql`；观察流发布时间排序索引：`20260606222929_observation_created_at_order_indexes.sql`
- `supabase/seed.sql` — 种子数据入口
- `supabase/scripts/prepare_migration.sql` — 迁移准备脚本

### 核心数据表
`profiles` · `projects` · … · `challenges` · … · **`courses`** · **`course_lessons`** · **`user_lesson_progress`** · **`auto_interaction_jobs`** · Storage bucket **`scratch-projects`**

完整类型定义：`lib/supabase/types.ts`

---

## 7. Scratch 编辑器子包 (`packages/scratch-host/`)

- 基于 **`@scratch/scratch-gui` 11.x**（官方 scratch-editor 生态）独立 Webpack 构建，与 Next.js 主站 React 19 隔离
- 构建：`pnpm --filter scratch-host build` → `pnpm --filter scratch-host copy-to-public` → 输出到 `public/scratch/`（整目录 gitignore，CI/Docker 的 `pnpm build` 会自动构建）
- Scratch 素材库 `public/scratch/assets/` 已迁 OSS（`scratch/assets/` 前缀）；生产环境配置 `NEXT_PUBLIC_ASSETS_BASE_URL` 后，`/internalapi/asset/*` 会 rewrite 到 OSS
- 本地开发编辑器：`pnpm --filter scratch-host dev`（:8601），学习页 iframe 默认加载 `/scratch/index.html`
- 与主站通信：`lib/courses/scratch-messages.ts` postMessage 协议；保存走 `POST /api/courses/.../project`

---

## 8. 脚本 (`scripts/`)

| 脚本 | 功能 |
|------|------|
| `db-push.mjs` | 数据库迁移推送工具（push/status/baseline） |
| `compress-project-images.mjs` | 项目图片 WebP 压缩 |
| `fetch-bird-media-from-wikimedia.mjs` | 从 Wikimedia 抓取鸟类图片 |
| `fetch-tree-images.mjs` | 从 Wikimedia 抓取树木图片 |
| `sync-bird-media-to-db.mjs` | 同步鸟类媒体到数据库 |
| `migrate-public-to-oss.mjs` | 上传 OSS 静态资源（物种图、项目图、Scratch 素材库等；`--only=project-covers` 只同步 `public/projects` 根层旧项目封面） |
| `fetch-scratch-assets.mjs` | 镜像 Scratch 素材库到本地，再经 migrate 脚本上传 OSS |

---

## 9. 测试

- `__tests__/` — **50+ 个** API 路由单元测试 + 组件测试
- `e2e/` — Playwright 冒烟测试（`smoke.spec.ts`、`messages.spec.ts`）+ 集成测试
- 各目录内 `*.test.ts(x)` — 就近放置的单元测试
- `vitest.config.ts` / `vitest.setup.ts` — Vitest 配置
- `playwright.config.ts` / `playwright.integration.config.ts` — Playwright 配置

---

## 10. 部署与 CI

- `deploy/docker-compose.yml` — Docker 部署编排
- `deploy/nginx.conf` — Nginx 反向代理配置
- `deploy/server-init.sh` — 服务器初始化脚本
- `Dockerfile` — 生产镜像构建
- `.github/workflows/ci.yml` — CI：Lint + TypeScript + Vitest + Build + Playwright
- `.github/workflows/release.yml` — Release：构建 Docker 镜像 + SSH 部署

---

## 11. 配置文件

| 文件 | 用途 |
|------|------|
| `package.json` | 依赖与脚本 |
| `pnpm-lock.yaml` / `pnpm-workspace.yaml` | pnpm 包管理 |
| `tsconfig.json` | TypeScript 配置（`@/` 路径别名） |
| `next.config.mjs` | Next.js 配置（图片域名、输出模式等） |
| `tailwind.config.ts` | Tailwind CSS 配置（自定义主题） |
| `postcss.config.js` | PostCSS 配置 |
| `eslint.config.mjs` | ESLint 配置 |
| `commitlint.config.js` | Git 提交信息规范 |
| `components.json` | shadcn/ui 组件配置 |
| `renovate.json` | Renovate 自动依赖更新 |
| `.env.example` | 环境变量模板 |
| `.impeccable.md` | 设计上下文（用户画像、品牌调性、设计原则） |

---

## 12. 静态资源 (`public/`)

| 目录 | 内容 |
|------|------|
| `public/assets/` | 页面背景图、英雄图（WebP/PNG）、游乐场插画 |
| `public/assets/timeline/` | 个人探索轨迹 3D 图标资源 |
| `public/assets/species-detail/` | 物种详情信息卡插图（鸟类、树木、昆虫专题） |
| `public/avatars/` | 12 个默认头像 SVG |
| `public/birds/` | 鸟类物种封面图与鸟鸣音频（已迁 OSS，本地目录 gitignore；配置 `NEXT_PUBLIC_ASSETS_BASE_URL` 后各环境先解析到同一资源域名，本地开发再经 `/api/assets` 模拟线上 Referer） |
| `public/insects/` | 昆虫物种封面图（已迁 OSS，本地目录 gitignore；静态图片重写策略同 `public/birds/`） |
| `public/trees/` | 树木物种封面图（已迁 OSS，本地目录 gitignore；静态图片重写策略同 `public/birds/`） |
| `public/projects/` | 项目封面图、步骤图（WebP）；`public/projects/*.webp` 根层旧封面、`public/projects/generated/*.webp` 与 `public/projects/steps/` 已迁 OSS，配置 `NEXT_PUBLIC_ASSETS_BASE_URL` 后各环境先解析到同一资源域名，本地开发再经 `/api/assets` 模拟线上 Referer |
| `public/icon*.png` | PWA 图标 |
