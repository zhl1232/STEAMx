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
| `/` | `app/page.tsx` | 首页 — 桌面端 Hero 明确「探索项目 / 进入创造营」双 CTA，`lg+` 采用紧凑分类+自然频道、热门项目三列+个性推荐双栏信息仪表盘；移动端保留自然观察/排行榜横向快捷入口；下方展示 6 个热门项目、社区动态 Feed 与本周挑战入口 |
| `/explore` | `app/explore/page.tsx` | 探索页 — 项目搜索、分类/子分类筛选、排序；子路由 `observations/`（观察列表）、`species/`（物种档案） |
| `/project/[id]` | `app/project/[id]/page.tsx` | 项目详情 — 步骤、材料清单、评论、点赞/收藏、完成记录、打赏 |
| `/community` | `app/community/page.tsx` | 社区 — 讨论列表、发帖；子路由 `challenge/`（挑战详情）、`discussion/`（帖子详情） |
| `/nature` | `app/nature/page.tsx` | 自然观察首页 — Hero 下方专题分类（鸟类/昆虫/植物/真菌；各专题入口卡使用 `public/assets/nature-topic-*.webp` 独立背景图，左侧留白叠文字、右侧为主体插画；植物专题覆盖树木与水果干果），其后为最近观察地图流（观察记录列表按发布时间 `created_at` 倒序）；桌面端侧栏保留社区贡献与观察概览，移动端在地图流下方以紧凑四格统计条展示社区贡献；子路由 `observations/`（列表按发布时间倒序，移动端扁平卡片流并隐藏全局 AI FAB 避免遮挡内容）、`observations/[id]/`（详情：已通过记录显示社群共识条 + 动态时间轴 + 物种比较 Bottom Sheet + 底部评论/建议鉴定，可选补充生命阶段与性别；共识确认后仍可继续认同或提交不同鉴定；待审/拒绝记录仅作者可见审核状态；`...` 菜单含删除/举报）、`species/`（物种探索清单：按专题/搜索/已观察/待观察筛选，并显示自然观察进度）、`submit/`（移动端引导式发布；公开准确位置需显式确认）、`map/` |
| `/playground` | `app/playground/page.tsx` + `layout.tsx` | 益智游乐场 — 13 个互动游戏（2048、24点、五子棋、扫雷、汉诺塔、数独、N皇后、生命游戏挑战模式、数字华容道、记忆翻牌、速算闪电战、迷宫探险、七巧板）；迷宫页定位为「寻路算法实验」，支持手动通关后对比 BFS / DFS / A* 的探索格数、路线步数与回放动画；`layout.tsx` 统一 `surface-panel` / `Button` / `--tone-*` 侧栏与本局提示条，移动端游戏内页保留紧凑顶栏并隐藏横向全游戏导航/本局提示以优先露出游戏本体；扫雷页桌面端采用紧凑工具栏与轻量棋盘 shell，普通桌面收窄右侧课程面板以增加主游戏区宽度，移动端初级棋盘按容器等分完整显示、中高难度保留横向滑动，本地战绩挂载后读取以避免 SSR hydration mismatch；扫雷、五子棋、数独、N 皇后在手机端采用更大的触控棋盘并允许横向滑动；`/playground/*` 游戏内页隐藏全局移动底部导航避免遮挡棋盘/画布；首页推荐支持轮换，移动端先展示单个今日推荐并避免与全部游戏列表重复；游戏卡片均有独立图形 fallback |
| `/profile` | `app/profile/page.tsx` | 个人主页 — 桌面首屏按「个人 Hero → 本周计划 / 今日行动 → 能力雷达与作品观察摘要」组织，普通桌面主体摘要在宽版卡片内左右并列，大桌面再将经验等级、新手引导（仅未毕业时显示，毕业后由徽章墙承载纪念）与学习打卡放入 400px 右栏；移动端保留 4 个高频入口（内容、消息、钱包、商店）并继续展示本周探索计划、STEAM 雷达、自然观察进度和徽章；子路由 `library/`、`timeline/`、`likes/`、`followers/`、`following/` |
| `/settings` | `app/settings/page.tsx` | 用户设置 — 子路由 `profile/`、`appearance/`、`notifications/`、`privacy/`、`security/`、`about/` |
| `/login` | `app/login/page.tsx` | 登录页 — 手机号 + 短信验证码登录 |
| `/auth/callback` | `app/auth/callback/` | Supabase Auth OAuth 回调处理 |
| `/leaderboard` | `app/leaderboard/page.tsx` | 排行榜 — 经验值/等级排名 |
| `/shop` | `app/shop/page.tsx` | 积分商店 — 用金币兑换头像框、名字颜色等虚拟物品 |
| `/coins` | `app/coins/page.tsx` | 金币页 — 余额、收支记录 |
| `/messages` | `app/messages/page.tsx` | 消息中心 — 通知分类、私信会话列表、未读角标；子路由 `[userId]/` 聊天详情 |
| `/share` | `app/share/page.tsx` | 分享/创建项目页 |
| `/create` | `app/create/page.tsx` | 创造营 — PBL 挑战 + **训练营** Tab；`/create` 重定向自 `/community` |
| `/pbl/[id]` | `app/pbl/[id]/page.tsx` | PBL 挑战详情 — Hero + 任务说明 + 阶段工作台 + 作品墙；阶段工作台支持保存一句话项目方向并生成每阶段个人化计划提示；移动端任务说明完整展开，底部固定「记录过程 / 提交终稿」入口，不在正文重复相关项目 |
| `/courses` | `app/courses/page.tsx` | Scratch 训练营列表 |
| `/courses/[courseId]` | `app/courses/[courseId]/page.tsx` | 课程详情与课时列表 |
| `/courses/.../lessons/[lessonId]` | `app/courses/[courseId]/lessons/[lessonId]/` | 课时学习页（侧栏步骤 + iframe Scratch 编辑器） |
| `/courses/.../preview` | `app/courses/.../lessons/[lessonId]/preview/` | 手机端作品预览（player 模式） |
| `/resources/[id]` | `app/resources/[id]/page.tsx` | 学习资料卡详情页（服务端渲染，react-markdown 正文；PBL 挑战「相关资料」三分类脚手架中「资料卡」的落点） |
| `/users/[id]` | `app/users/[id]/` | 其他用户的公开主页 |
| `/admin` | `app/admin/page.tsx` | 管理后台 — 项目审核、探索记录审核、自然观察审核、挑战作品审核、举报/挑战/训练营管理；子路由 `projects/`、`moderator-applications/` |
| `/moderator/apply` | `app/moderator/apply/` | 申请成为审核员 |
| `/legal` | `app/legal/` | 法律条款 — `privacy/`（隐私政策）、`terms/`（服务条款） |
| `/badges-preview` | `app/badges-preview/page.tsx` | 徽章样式预览（仅开发环境可访问） |
| `/design-system` | `app/design-system/page.tsx` | 设计系统静态展示（仅开发环境） |
| `/migrate` | `app/migrate/page.tsx` | 数据迁移说明页（CLI 指引） |

### 全局文件
- `app/layout.tsx` — 根布局：Provider 嵌套顺序（QueryProvider → AuthProvider → ThemeProvider）
- `app/globals.css` — 全局样式与 CSS 变量；统一页面 shell 移动端横向 gutter：16px，桌面按各 shell 规则放大；自然频道不再定义独立 `--nature-*` 主题色，使用全站通用 token
- `app/template.tsx` — 页面过渡模板
- `app/error.tsx` / `app/not-found.tsx` — 全局错误与 404
- `app/manifest.ts` / `app/robots.ts` / `app/sitemap.ts` — PWA & SEO
- `proxy.ts` — Next.js 16 Proxy 入口：补种匿名推荐 `rec_viewer` cookie（替代已废弃的 `middleware.ts`）
- `AGENTS.md` / `.cursor/rules/project-context.mdc` — AI/自动化工具项目约定：先读索引、同步维护索引、禁止恢复 `middleware.ts`

---

## 2. API 路由 (`app/api/`)

30 个 API 模块，每个目录下含 `route.ts`：

| 模块 | 路径 | 功能 |
|------|------|------|
| admin | `api/admin/` | 项目审核、完成记录审核、自然观察审核（通过后发放观察 XP/徽章并入公开互动队列）、标签管理、举报处理、审核员申请审批、挑战 CRUD（resources 字段经 `lib/api/challenge-resources.ts` 三分类校验）、**训练营 CRUD**（`admin/courses/`）、**资料卡 CRUD**（`admin/resources/`，草稿/发布，仅草稿可删）、用户创建与会员状态手动开通 |
| assets | `api/assets/` | 本地开发用受限静态资源代理；仅代理已迁移到 OSS 的 `/birds`、`/insects`、`/trees`、`/fruits`、`/projects` 资源。本地默认经代理带生产 Referer 拉取 OSS，以模拟线上 CDN 防盗链；生产环境直连 `NEXT_PUBLIC_ASSETS_BASE_URL`；非生产设置 `NEXT_PUBLIC_ASSETS_DISPLAY_MODE=direct` 可绕过代理直连排查 |
| courses | `api/courses/` | 训练营列表/详情；课时 `.sb3` 保存与 signed URL；完成课时 +XP |
| auth | `api/auth/` | 短信发送/验证、OAuth 回调 |
| challenges | `api/challenges/` | 挑战列表与评分；作品提交 `[id]/submission`；阶段产出 `[id]/stages`（GET 全部）与 `[id]/stages/[index]`（PUT 落库）；阶段导师反馈 `[id]/stages/[index]/review`（保存当前产出、消耗 AI 配额、生成结构化反馈并写回 `ai_feedback`）；PBL 工作台 `[id]/workspace` 保存个人项目方向并返回受控个人化计划 |
| tutor | `api/tutor/` | **AI 导师小迪**统一对话 `chat`（GET 历史+配额+本地开场白，`quotaOnly=1` 只刷代币；POST SSE 流式，global 场景按 `surface` 页面标识（home/explore/nature/create/courses/community/playground/profile/users）差异化场景与开场白并注入个性化推荐项目候选、course 场景支持 `lessonId` 课时上下文、species 场景按物种 slug 注入档案（识别/生境/季节）；DELETE 归档当前线程并开启新对话）；历史对话只读回看 `conversations`（GET 按场景列归档线程+首条用户消息预览）与 `conversations/[id]`（GET 线程消息，归属校验）；图片接受三类来源（PBL 阶段产出 / 本人观察照片 / 聊天直传 `project-images/tutor-chat`）；落库失败发 `warning` 事件并退代币；代币门禁 `consume_ai_credit`（免费退款按当日 refund 流水抵扣）；Admin `admin/users/[id]/credits`、`admin/ai-usage` |
| comments | `api/comments/` | 项目评论 CRUD、点赞 |
| completions | `api/completions/` | 完成记录、评论、点赞、审核 |
| discussions | `api/discussions/` | 社区讨论 CRUD、点赞 |
| follows | `api/follows/` | 关注/取关、关注状态查询 |
| geo | `api/geo/` | 反向地理编码 |
| health | `api/health/` | Docker/负载均衡浅健康检查；仅验证 Next 服务存活，不访问数据库或外部服务 |
| home | `api/home/` | 首页推荐数据 |
| internal | `api/internal/` | 内部 Worker 入口：完成记录审核、自动互动队列执行（短回复/点赞/收藏）与历史 approved 项目低比例 backfill 入队 |
| leaderboard | `api/leaderboard/` | 排行榜数据 |
| messages | `api/messages/` | 私信发送、会话列表、消息线程、未读计数、会话标记已读 |
| moderator | `api/moderator/` | 审核员资格检查、申请 |
| notifications | `api/notifications/` | 通知列表、标记已读、通知未读计数；全局入口汇总通知 + 私信未读 |
| playground | `api/playground/` | 游乐场云端战绩徽章同步；`badges/sync` 读取 `playground_stats` 并补发已达成的游乐场徽章 |
| observations | `api/observations/` | 自然观察 CRUD；提交先进入待审核，公开列表/点赞/评论/鉴定仅开放已通过记录 |
| profile | `api/profile/` | 个人资料摘要、新手引导、学习打卡、本周探索计划（聚合 PBL 阶段/课程/自然观察/雷达等信号） |
| projects | `api/projects/` | 项目 CRUD、编辑；项目点赞服务端写入作者通知 |
| replies | `api/replies/` | 回复 CRUD |
| resources | `api/resources/` | 学习资料卡公开读取（仅 published） |
| reports | `api/reports/` | 举报提交 |
| settings | `api/settings/` | 用户设置更新 |
| species | `api/species/` | 物种查询；支持 `topic`、关键词和 `status=all/unobserved/observed`，返回当前筛选范围的自然观察进度统计 |
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
- `components/ui/button.tsx` — 全局按钮：默认圆角 `--radius-sm`（10px），移动端顶部按钮和普通操作走默认圆角；大号主 CTA / 审核动作 / 底栏固定按钮可使用 `shape="pill"`，紧凑图标按钮可用 `shape="square"`。
- `components/ui/loading-skeleton.tsx` — 项目/挑战/自然详情骨架屏；`ChallengeCardSkeleton` 支持可选 `className` 供页面局部统一圆角和外观。

### 3.2 布局 (`components/layout/`) — 13 个组件
- `conditional-app-shell.tsx` — 根据路由条件渲染 Header/BottomNav/Sidebar
- `bottom-nav.tsx` — 移动端底部导航
- `main-nav.tsx` — 桌面端顶部导航
- `mobile-global-header.tsx` — 移动端全局头部
- `header-search.tsx` — 头部搜索栏
- `user-button.tsx` — 用户头像菜单；有效会员/创始会员显示会员身份与到期状态
- `notification-bell.tsx` — 通知铃铛
- `share-button.tsx` — 分享按钮
- `login-dialog.tsx` — 登录引导弹窗
- `logo.tsx` — 品牌 Logo
- `theme-provider.tsx` / `theme-toggle.tsx` — 主题切换
- `error-boundary.tsx` — 错误边界

### 3.3 首页 (`components/home/`)
- `home-showcase.tsx` — 首页主体：Hero、分类入口、自然频道、6 个热门项目、个性推荐、社区动态与本周挑战；桌面 `lg+` 将自然频道和个性推荐提前到右侧栏以增强信息效率，分类入口与热门项目采用更紧凑的仪表盘密度，热门项目在常见桌面宽度三列展示；Hero 提供「开始探索项目 / 进入创造营」双 CTA；移动端将自然观察与排行榜合并为手动横向 snap 快捷入口，320px 窄屏隐藏 Hero 底部特性标签并缩短 Hero；自然观察频道图在中宽/宽屏保持鸟主体可见；页脚移除假二维码与过期活动信息
- `compact-project-grid-styles.ts` — 首页热门 / 探索列表共用的两列竖版项目卡网格与卡片样式 class
- `recommendation-panel.tsx` — 推荐项目面板

### 3.4 业务功能 (`components/features/`)

| 子目录 | 文件数 | 职责 |
|--------|--------|------|
| `bird-observation/` | 14 | 观察提交表单、照片上传、地图选点、观察卡片、物种热点面板、物种统计面板（无观察记录时隐藏）、评论区 |
| `challenge/` | 5 | 挑战提交表单（新建时按阶段产出汇总预填）、PBL 信息 `pbl-info`（「相关资料」按 参考项目/前置技能/资料卡 三分类分组渲染，带描述行）、评分星级、阶段工作台 `stage-workspace`（逐步解锁引导：未解锁阶段不渲染，仅显示"还有 N 步"折叠提示；支持保存个人项目方向并显示每阶段个人化计划；阶段产出防抖自动保存，唯一主按钮「完成这步」+完成清单(成功标准)+「请导师看看这步」生成并持久化 做得好/还缺/下一步 反馈卡）、提交作品画廊 |
| `courses/` | 3 | 训练营列表 `course-board`、课时侧栏 `lesson-sidebar`、Scratch iframe `scratch-workspace` |
| `community/` | 1 | 讨论列表（含搜索、排序、分页） |
| `gamification/` | 10 | 徽章图标/画廊、等级进度、排行榜、成就 Toast、每日登录同步（登录用户首页也挂载，临时失败自动重试）、观察游戏化同步 |
| `moderator/` | 2 | 审核员申请表单 |
| `tutor/` | 5 | 全局 AI 导师「小迪」（吉祥物史迪姆）：`tutor-context` Provider、`global-tutor-mount` 按路由感知场景（含课时页 `lessonId`）并用 React Query 预取当前小迪会话、`global-tutor-fab` 悬浮球+流式对话（聊天框可直传图片、场景照片一键发图、Scratch 课时页紧凑位；打开时优先消费预取缓存，⋯菜单含「开启新对话」与「历史对话」，归档线程列表+只读回看视图）、`tutor-session` 会话 query key/fetch helper、`tutor-message-content` 回复轻量 Markdown 渲染 + `[project:ID|标题]` 项目 chip + `[audio:slug|物种名]` 内联鸟鸣播放器 |
| `playground/` | 1 | 键盘帮助弹窗 |
| `project/` | 9 | 完成项目弹窗、项目详情操作栏、打赏弹窗、续做卡片 |
| `social/` | 2 | 关注按钮 |
| `shared/` | 2 | 通用评论卡片、底部回复框 |
| `profile/` | 16 | 头像上传、编辑资料弹窗、本周探索计划卡（失败回退今日行动卡，步骤统一用 3D spot icon，含新增 `plan-*` 图标）、STEAM 雷达图、新手引导行（毕业后整卡不再渲染）、学习打卡卡片、骨架屏；`profile-spot-icons` 统一内容层/导航 icon（`public/assets/profile-icons/` 3D WebP） |

### 3.5 管理后台 (`components/admin/`) — 11 个组件
项目审核卡片、探索记录审核、自然观察审核卡片、挑战管理（资源行支持三分类选择 + 描述，「资料卡」类型可从已发布资料卡库选取自动填链接）、**训练营管理** `course-management`、**资料卡管理** `resource-management`（Markdown 正文编辑、草稿/发布切换）、完成审核、审核员申请列表、举报列表、全部项目管理、用户会员管理 `user-membership-management`

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
- `notification-context.tsx` — 通知（获取、标记已读、通知未读 + 私信未读汇总计数；未读数请求有 1.5s 模块级短缓存/同飞去重以压住 StrictMode 与多入口刷新；生产可经 Supabase Realtime 私有通道 `unread-counts:<user_id>` 订阅 `notifications`/`messages` 表变更刷新，通道访问由 `realtime.messages` RLS 限定为本人，本地开发默认跳过 Realtime WebSocket 并保留 HTTP 兜底，页面回到前台兜底刷一次）
- `login-prompt-context.tsx` — 未登录操作引导弹窗

### 4.3 API 服务层 (`lib/api/`) — 24 个模块
服务端 API 的核心业务逻辑，被 `app/api/` 路由调用：
- `auth.ts` / `auth-rate-limit.ts` — 认证与频率限制
- `explore-data.ts` — 探索页数据查询（搜索、筛选、排序）
- `categories.ts` — 分类与子分类
- `challenge-submissions.ts` / `challenge-settlement.ts` — 挑战提交与结算
- `nature-observation-*.ts` — 自然观察全套（首页/数据/事件/热点/物种/封面/审核；物种列表按审核通过记录 + 社群共识或 AI 高置信度鉴定计算已观察/待观察进度；植物物种图集同时读取树木与水果 manifest；物种封面优先使用本地 `public/` 文件，缺失时再回退 OSS；数据库封面为空时回退 manifest 首张图）
- `nature-observation-progress.ts` — 用户自然观察进度摘要：按专题汇总已观察/待观察物种，并提供个人页待观察预览
- `nature-observation-observed-species.ts` — 已观察物种统计：审核通过记录上优先取社群共识物种，否则取 AI 置信度 ≥ 0.8 的鉴定结果
- `observation-gamification.ts` — 观察游戏化逻辑
- `lib/observations/submit-topic.ts` — 观察提交专题（birds/plants/insects）归一化与文案
- `lib/observations/traits.ts` — 观察生命阶段/性别枚举、选项与展示文案
- `lib/observations/display.ts` — 观察详情标题（物种名 / AI 建议 / 未知类别）、日期格式化
- `lib/observations/consensus-ui.ts` — 社群共识进度（2 票规则；确认后仍可继续认同/不同鉴定）与 UI 文案
- `lib/observations/activity-stream.ts` — 鉴定与评论合并为动态流
- `lib/nature/action-buttons.ts` — 自然观察操作按钮统一样式（`brand` / `outline` / `destructive`，默认 10px 圆角）
- `project-access.ts` / `project-validation.ts` — 项目权限、文字安全与封面/步骤图片归属校验
- `challenge-submission-validation.ts` — 挑战投稿标题/说明/图片说明敏感词校验，证明图片/视频必须来自当前账号上传
- `completion-access.ts` — 完成记录权限
- `validation.ts` — 通用输入验证、敏感词校验、上传 URL 归属/本地可信资源校验
- `upstream-errors.ts` / `rate-limit.ts` — 错误处理与限流
- `types.ts` — API 层类型

### 4.4 配置 (`lib/config/`)
- `categories.ts` — STEAM 五大分类定义与图标
- `category-images.ts` — 分类封面图路径
- `nature-topics.ts` — 自然主题（鸟类、昆虫、植物等；植物专题包含树木、花草与水果干果）
- `project-steam-weights.ts` — 项目 STEAM 能力权重计算
- `subcategory-steam-weights.ts` — 子分类权重映射

### 4.5 游戏化 (`lib/gamification/`)
- `badges.ts` — 全部徽章定义（独立/阶梯/系列）；阶梯系列用 `tierNames` 独立成就名，档位可用 `BADGE_TIER_LABELS` 作说明文本；资料页精选徽章每个阶梯系列只取最高已解锁档，徽章图鉴展示全量档位；连续打卡白金 `streak_platinum`（百日恒心）为连续登录 100 天；社区 `social` 阶梯统计发帖/评论/回复；自然观察合并为观察记录 `bird_observer` 与物种收集 `species_collector` 两条阶梯；游乐场收敛为跨游戏阶梯 `playground_explorer` / `playground_victories` 与 7 枚高难度彩蛋 `playground_star`（如 `tangram_all` 按当前 4 个剪影判定）
- `playground-badges.ts` — 从 `playground_stats.stats` 云端 JSON 解析各游戏战绩为 `UserStats`（含 `playgroundGamesPlayed` / `playgroundWinsTotal` 聚合），并为 `/api/playground/badges/sync` 补发游乐场阶梯与彩蛋徽章；保留游戏页前端即时 `checkBadges` 只用于当场反馈
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
- `next-action.ts` — 个人主页「今日行动」决策：按可领取新手引导、探索中项目、未完成新手引导、STEAM 雷达补短板、自然待观察物种、时间线回顾等顺序给出下一步（作为本周探索计划加载失败时的 UI 回退）
- `weekly-plan.ts` — 个人主页「本周探索计划」纯规则生成：3-5 步学习路径，聚合已完成时间线、PBL 阶段、在学课程、探索中项目、STEAM 雷达、自然观察与新手引导；同一摘要供小迪 profile 场景解读
- `growth-tasks.ts` — 新手引导系统（内部模块名仍为 growth-tasks）
- `steam-radar.ts` — STEAM 能力雷达图数据
- `study-checkin.ts` — 每日打卡展示逻辑；后端 `get_user_study_checkin_summary` 同时计入每日登录打卡、已通过项目终稿、已通过观察与待审/已通过挑战作品
- `settings.ts` — 设置项读写
- `avatar-options.ts` — 默认头像选项

### 4.9 其他模块
| 模块 | 文件 | 职责 |
|------|------|------|
| `lib/mappers/` | `project.ts`, `types.ts` | 数据库行 → 前端模型映射；`ChallengeResource` 三分类（`project`/`skill`/`reference`）+ 可选 `description`，`normalizeChallengeResources` 对历史旧 type 归一化并剔除 CTA 条目 |
| `lib/pbl/` | `challenge-workspace.ts`, `challenge-stage-review.ts`, `challenge-stage-progress.ts` | PBL 工作台个人项目方向、个人化计划 JSON 类型、确定性计划生成与数据库行映射；阶段导师反馈上下文/产出摘要构建；阶段产出快照比较与反馈失效判断 |
| `lib/learning-resources.ts` | `learning-resources.ts` | 资料卡共享常量/类型/映射（分类 `principle`/`material`/`method`/`skill`/`case`，状态 `draft`/`published`） |
| `lib/api/learning-resources.ts` | `learning-resources.ts` | 服务端读取已发布资料卡（React.cache 去重，供详情页与公开 API 共用） |
| `lib/api/challenge-resources.ts` | `challenge-resources.ts` | 挑战 resources 字段服务端校验（title/url 必填、type 三分类枚举） |
| `lib/shop/` | `items.ts` | 商店物品定义与价格 |
| `lib/ai/` | `qwen-vision.ts`, `observation-media-analysis.ts`, `upload-content-moderation.ts`, `auto-reply.ts` | 通义千问/DashScope AI：自然观察图像安全/质量/物种识别、通用上传图片安全审核、自动互动短回复生成 |
| `lib/auto-interactions.ts` | `auto-interactions.ts` | 自动互动队列：公开项目/完成记录/自然观察的延迟短回复、点赞与项目收藏 |
| `lib/sms/` | `aliyun.ts`, `send.ts` | 阿里云短信验证码 |
| `lib/content-filter/` | `index.ts`, `words-zh.ts`, `words-en.ts` | 敏感词过滤 |
| `lib/notifications/` | `navigation.ts` | 通知跳转路由映射 |
| `lib/community/` | `reply-utils.ts`, `featured-nature-challenges.ts` | 回复工具、精选挑战 |
| `lib/playground/` | `catalog.ts`, `storage.ts`, `minesweeper-stats.ts` | 游戏目录、本地/云端成绩存储；扫雷统一写入 `minesweeper_stats`，读取时经 `readMergedMinesweeperStats` 合并旧 `minesweeper_best_times` |
| `lib/utils/` | 11 个文件 | 文件校验、HTTP 工具、上传、手机号、拼音、自然导航、主题分类 |
| `lib/auth/` | `server.ts` | 服务端认证辅助 |
| `lib/testing/` | `playwright-smoke.ts` | E2E 测试辅助 |
| `lib/membership.ts` | `membership.ts` | 会员档位/周期、有效性判断与 AI 代币常量（免费 5 次/天、会员月发 1500 代币、图文扣费 1/2） |
| `lib/ai/tutor/` | `engine.ts`, `prompt.ts`, `student-profile.ts`, `context-builders.ts`, `audio-tags.ts`, `species-hints.ts`, `memory.ts`, `greeting.ts`, `resolve-context.ts` | AI 导师小迪：…物种对话时按提及物种注入「常见环境」（habitat_notes）与「本站公开观察记录」（topLocations 聚合），并约束不要把学生/站内地名观察说成「常见于XX」；…
| `lib/api/weekly-plan-data.ts` | `weekly-plan-data.ts` | 本周探索计划服务端数据聚合：并行读取个人作品/雷达/新手引导/自然观察、本周时间线、进行中 PBL 阶段与在学课程，返回共享 `WeeklyPlan` |
| `lib/api/ai-credits.ts` | `ai-credits.ts` | AI 代币 consume/refund/status RPC 封装 |

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
| `use-profile-observations` | `hooks/profile/` | 个人观察记录与自然观察进度 |
| `use-2048` 等 | `hooks/playground/` | 13 个游戏逻辑 Hook（2048/24点/五子棋/扫雷/汉诺塔/数独/N皇后/生命游戏、数字华容道、记忆翻牌、速算闪电战、迷宫探险、七巧板） |

---

## 6. 数据库 (`supabase/`)

- `supabase/migrations/` — **187 个**迁移文件；…；AI 导师统一表+笔记本：`20260610150000_tutor_messages_and_notebooks.sql`；小迪物种档案上下文：`20260610170000_tutor_species_context.sql`；小迪对话线程：`20260611140000_tutor_conversations.sql`；AI 代币体系：`20260610151000_ai_credit_system.sql`；PBL 工作台个人化计划：`20260615100000_challenge_workspaces.sql`；免费配额退款修复：`20260610160000_fix_ai_free_refund.sql`（均需 `pnpm db:push` 应用）
- `supabase/seed.sql` — 种子数据入口
- `supabase/scripts/prepare_migration.sql` — 迁移准备脚本

### 核心数据表
`profiles`（含 `membership_tier` / …） · … · **`species`**（自然观察物种，含 `nature_topic` 与植物属性 `life_form` / `cultivation_status` / `plant_uses`） · **`tutor_conversations`**（小迪对话线程，active/archived） · **`tutor_messages`**（小迪统一对话消息，归属 conversation） · **`tutor_notebooks`**（小迪长期记忆摘要） · **`ai_credit_wallets`** / **`ai_credit_logs`**（AI 代币钱包与流水） · **`challenge_stage_progress`** · **`challenge_workspaces`**（PBL 个人项目方向与个人化计划） · …

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
| `compress-project-images.mjs` | 压缩目录图片（`COMPRESS_IMAGES_DIR` / `COMPRESS_MAX_SIDE` / `COMPRESS_JPEG_QUALITY`）；`pnpm compress:fruit-images` 压缩水果图集至 1280px |
| `profile-icons-remove-bg.mjs` | 去除 `public/assets/profile-icons/` WebP 烘焙底色并写入透明通道 |
| `fetch-bird-media-from-wikimedia.mjs` | 从 Wikimedia 抓取鸟类图片 |
| `fetch-tree-images.mjs` | 从 Wikimedia 抓取树木图片 |
| `fetch-fruit-images.mjs` | 抓取水果/干果**果实图**（优先 iNaturalist 结果期观测 + Wikimedia 果实关键词搜索）；下载后自动压缩至 1280px |
| `sync-bird-media-to-db.mjs` | 同步鸟类媒体到数据库 |
| `migrate-public-to-oss.mjs` | 上传 OSS 静态资源（物种图、项目图、Scratch 素材库等；支持 `--only=fruits`；`--only=project-covers` 只同步 `public/projects` 根层旧项目封面） |
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

- `deploy/docker-compose.yml` — Docker 部署编排；含 `auto-interactions-worker` 后台服务，主站健康后循环调用内部自动互动队列执行接口
- `deploy/nginx.conf` — Nginx 反向代理配置
- `deploy/server-init.sh` — 服务器初始化脚本
- `deploy/auto-interactions-worker.mjs` — 自动互动队列 Docker worker（可在启动时按 `AUTO_INTERACTION_BACKFILL_*` 低比例补偿历史项目；随后按 `AUTO_INTERACTION_WORKER_INTERVAL_SECONDS` 周期 POST `/api/internal/auto-interactions/run`）
- `Dockerfile` — 生产镜像构建；将 Next standalone 与自动互动 worker 脚本复制进运行镜像
- `.github/workflows/ci.yml` — CI：Lint + TypeScript + Vitest + Build + Playwright
- `.github/workflows/release.yml` — Release：构建 Docker 镜像 + 同步 compose 文件 + SSH 部署

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
| `eslint.config.mjs` | ESLint 配置；忽略 `packages/scratch-host/dist/**` 构建产物，只 lint 源码 |
| `commitlint.config.js` | Git 提交信息规范 |
| `components.json` | shadcn/ui 组件配置 |
| `renovate.json` | Renovate 自动依赖更新 |
| `.env.example` | 环境变量模板 |
| `.impeccable.md` | 设计上下文（用户画像、品牌调性、设计原则） |

---

## 12. 静态资源 (`public/`)

| 目录 | 内容 |
|------|------|
| `public/assets/` | 页面背景图、英雄图（WebP/PNG）、游乐场插画；`/nature` 专题入口卡背景 `nature-topic-birds.webp` / `nature-topic-insects.webp` / `nature-topic-plants.webp` / `nature-topic-fungi.webp` |
| `public/assets/profile-icons/` | 个人主页模块 icon WebP（256px、新手引导、探索地图、时间线、快捷入口 action-*） |
| `public/assets/species-detail/` | 物种详情信息卡插图（鸟类、植物、昆虫专题） |
| `public/avatars/` | 12 个默认头像 SVG |
| `public/birds/` | 鸟类物种封面图与鸟鸣音频（已迁 OSS，本地目录 gitignore；配置 `NEXT_PUBLIC_ASSETS_BASE_URL` 后各环境先解析到同一资源域名，本地开发再经 `/api/assets` 模拟线上 Referer） |
| `public/insects/` | 昆虫物种封面图（已迁 OSS，本地目录 gitignore；静态图片重写策略同 `public/birds/`） |
| `public/trees/` | 树木物种封面图（已迁 OSS，本地目录 gitignore；静态图片重写策略同 `public/birds/`） |
| `public/fruits/` | 水果与干果物种图片（并入植物专题，已纳入 OSS 同步与 `/api/assets` 代理白名单；`images/` 本地目录 gitignore） |
| `public/projects/` | 项目封面图、步骤图（WebP）；`public/projects/*.webp` 根层旧封面、`public/projects/generated/*.webp` 与 `public/projects/steps/` 已迁 OSS，配置 `NEXT_PUBLIC_ASSETS_BASE_URL` 后各环境先解析到同一资源域名，本地开发再经 `/api/assets` 模拟线上 Referer |
| `public/icon*.png` | PWA 图标 |
