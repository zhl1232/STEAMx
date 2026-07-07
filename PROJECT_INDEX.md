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
| `/project/[id]` | `app/project/[id]/page.tsx` | 项目详情 — 步骤、材料清单、评论、点赞/收藏、完成记录、打赏；若该项目是某课程课时的作品墙（`course_lessons.content.building3d.worksProjectId` 指向它，经 `getCourseLessonByWorksProjectId` 反查），移动端/桌面端均展示「回到课程」入口 `project-course-link`（站内同标签页跳 `/courses/[id]/lessons/[id]`） |
| `/community` | `app/community/page.tsx` | 社区 — 讨论列表、发帖；子路由 `challenge/`（挑战详情）、`discussion/`（帖子详情） |
| `/nature` | `app/nature/page.tsx` | 自然观察首页 — Hero 下方专题分类（鸟类/昆虫/植物/真菌；各专题入口卡使用 `public/assets/nature-topic-*.webp` 独立背景图，左侧留白叠文字、右侧为主体插画；植物专题覆盖树木与水果干果），其后为最近观察地图流（观察记录列表按发布时间 `created_at` 倒序）；桌面端侧栏保留社区贡献与观察概览，移动端在地图流下方以紧凑四格统计条展示社区贡献；子路由 `observations/`（列表按发布时间倒序，移动端扁平卡片流并隐藏全局 AI FAB 避免遮挡内容）、`observations/[id]/`（详情：已通过记录显示社群共识条 + 动态时间轴 + 物种比较 Bottom Sheet + 底部评论/建议鉴定，可选补充生命阶段与性别；共识确认后仍可继续认同或提交不同鉴定；待审/拒绝记录仅作者可见审核状态；`...` 菜单含删除/举报）、`species/`（物种探索清单：按专题/搜索/已观察/待观察筛选，并显示自然观察进度；进入详情前用 `lib/nature-species-scroll-restore.ts` 记录筛选、已加载页、滚动位置、点击物种卡锚点与列表 index，返回清单时按 index 补齐分页并把同一卡片恢复到原视口位置；详情页挂载 `species-detail-scroll-top.tsx`，客户端路由进入时强制回到顶部）、`submit/`（移动端引导式发布；公开准确位置需显式确认）、`map/` |
| `/playground` | `app/playground/page.tsx` + `layout.tsx` | 益智游乐场 — 13 个互动游戏（2048、24点、五子棋、扫雷、汉诺塔、数独、N皇后、生命游戏挑战模式、数字华容道、记忆翻牌、速算闪电战、迷宫探险、七巧板）；迷宫页定位为「寻路算法实验」，支持手动通关后对比 BFS / DFS / A* 的探索格数、路线步数与回放动画；`layout.tsx` 统一 `surface-panel` / `Button` / `--tone-*` 侧栏与本局提示条，移动端游戏内页保留紧凑顶栏并隐藏横向全游戏导航/本局提示以优先露出游戏本体；扫雷页桌面端采用紧凑工具栏与轻量棋盘 shell，普通桌面收窄右侧课程面板以增加主游戏区宽度，移动端初级棋盘按容器等分完整显示、中高难度保留横向滑动，本地战绩挂载后读取以避免 SSR hydration mismatch；扫雷、五子棋、数独、N 皇后在手机端采用更大的触控棋盘并允许横向滑动；`/playground/*` 游戏内页隐藏全局移动底部导航避免遮挡棋盘/画布，并继承小迪 `playground` surface 场景；首页推荐支持轮换，移动端先展示单个今日推荐并避免与全部游戏列表重复；游戏卡片均有独立图形 fallback |
| `/profile` | `app/profile/page.tsx` | 个人主页 — 桌面首屏按「个人 Hero → 本周计划 / 今日行动 → 能力雷达与作品观察摘要」组织，普通桌面主体摘要在宽版卡片内左右并列，大桌面再将经验等级、新手引导（仅未毕业时显示，毕业后由徽章墙承载纪念）与学习打卡放入 400px 右栏；移动端保留 4 个高频入口（内容、消息、钱包、商店）并继续展示本周探索计划、STEAM 雷达、自然观察进度和徽章；子路由 `library/`、`timeline/`、`likes/`、`followers/`、`following/` |
| `/settings` | `app/settings/page.tsx` | 用户设置 — 子路由 `profile/`、`appearance/`、`notifications/`、`privacy/`、`security/`、`about/` |
| `/login` | `app/login/page.tsx` | 登录页 — 手机号 + 短信验证码登录 |
| `/auth/callback` | `app/auth/callback/` | Supabase Auth OAuth 回调处理 |
| `/leaderboard` | `app/leaderboard/page.tsx` | 排行榜 — 经验值/等级排名 |
| `/shop` | `app/shop/page.tsx` | 积分商店 — 用金币兑换头像框、名字颜色等虚拟物品 |
| `/coins` | `app/coins/page.tsx` | 金币页 — 余额、收支记录 |
| `/messages` | `app/messages/page.tsx` | 消息中心 — 通知分类、私信会话列表、未读角标；子路由 `[userId]/` 聊天详情 |
| `/share` | `app/share/page.tsx` | 分享/创建项目页 |
| `/create` | `app/create/page.tsx` | 创造营 — **项目挑战** + **技能课程** Tab；`/create` 重定向自 `/community` |
| `/pbl/[id]` | `app/pbl/[id]/page.tsx` | 项目挑战详情 — Hero + 任务说明 + 阶段工作台 + 作品墙；阶段工作台支持保存一句话项目方向并生成每阶段个人化计划提示；移动端任务说明完整展开，底部固定「记录过程 / 提交终稿」入口，不在正文重复相关项目 |
| `/courses` | `app/courses/page.tsx` | 技能课程列表（Scratch 编程 + 3+/4+/5+ 大颗粒积木搭建 + 五子棋博弈论入门等） |
| `/courses/[courseId]` | `app/courses/[courseId]/page.tsx` | 课程详情与课时列表（左文右图 Hero：五子棋课用纯 SVG 棋盘装饰，其它课走 `image_url` 位图；课时卡带序号棋子 + 课时类型徽章） |
| `/courses/.../lessons/[lessonId]` | `app/courses/[courseId]/lessons/[lessonId]/` | 课时学习页（侧栏步骤 + 可选学习目标/教师引导 + 按 `lesson_type` 切换工作区：Scratch 编辑器 / 大颗粒积木 3D 搭建预览 / 游乐场实训导学；3D 用 three.js `LDrawLoader` 加载自托管 `.mpd`，`0 STEP` 驱动分步显隐；LDraw 课程模型优先通过 `.agents/skills/image-to-ldraw` 的 `part-metadata.json` 零件定义和 `validate-assembly.mjs` 统一校验支撑、穿模、管道端口连接与方向约束；playground 课时把游乐场游戏包成导学课，右侧「去实战」按钮跳到对应 `/playground/*` 游戏页；playground 课时在移动端用单栏：隐藏左侧 `LessonSidebar` 步骤列表，由 `PlaygroundWorkspace` 承载讲解 + 紧凑进度条 + 上一步/下一步/完成 + 底部「去实战」按钮，桌面端仍保留双栏） |
| `/courses/.../preview` | `app/courses/.../lessons/[lessonId]/preview/` | Scratch 课时手机端作品预览（player 模式；积木搭建课不使用此页） |
| `/resources/[id]` | `app/resources/[id]/page.tsx` | 学习资料卡详情页（服务端渲染，react-markdown 正文；PBL 挑战「相关资料」三分类脚手架中「资料卡」的落点） |
| `/users/[id]` | `app/users/[id]/` | 其他用户的公开主页 |
| `/admin` | `app/admin/page.tsx` | 管理后台 — 项目审核、探索记录审核、自然观察审核、挑战作品审核、举报/挑战/**技能课程**管理；子路由 `projects/`、`moderator-applications/` |
| `/moderator/apply` | `app/moderator/apply/` | 申请成为审核员 |
| `/legal` | `app/legal/` | 法律条款 — `privacy/`（隐私政策）、`terms/`（服务条款） |
| `/badges-preview` | `app/badges-preview/page.tsx` | 徽章样式预览（仅开发环境可访问） |
| `/xiaodi-preview` | `app/xiaodi-preview/page.tsx` | 小迪吉祥物 7 状态动画预览（仅开发环境；状态切换/自动轮播/深浅底/播一轮回 idle 演示；默认使用全状态 AI 8 帧候选帧集，并可切回原版 4 帧对比） |
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
| admin | `api/admin/` | 项目审核、完成记录审核、自然观察审核（通过后发放观察 XP/徽章并入公开互动队列）、标签管理、举报处理、审核员申请审批、挑战 CRUD（resources 字段经 `lib/api/challenge-resources.ts` 三分类校验）、**技能课程 CRUD**（`admin/courses/`）、**资料卡 CRUD**（`admin/resources/`，草稿/发布，仅草稿可删）、用户创建与会员状态手动开通 |
| assets | `api/assets/` | 受限静态资源代理；代理已迁移到 OSS 的 `/birds`、`/insects`、`/trees`、`/fruits`、`/projects`、**`/courses`**（课件 slides/PDF/视频/成品图/LDraw）资源。各环境默认经代理带 Referer 拉取 OSS（CDN 防盗链，直连会 403）；**OSS 404 时回退 `public/` 同名路径**（LDraw 打包 MPD 本地更完整时也优先本地）；设置 `NEXT_PUBLIC_ASSETS_DISPLAY_MODE=direct` 可绕过代理直连排查；服务端可读 `ASSETS_BASE_URL` 或 `NEXT_PUBLIC_ASSETS_BASE_URL` |
| courses | `api/courses/` | 技能课程列表/详情；课时 `.sb3` 保存与 signed URL；完成课时 +XP |
| auth | `api/auth/` | 短信发送/验证、OAuth 回调 |
| challenges | `api/challenges/` | 挑战列表与评分；作品提交 `[id]/submission`；投稿草稿 `[id]/submission/draft` 汇总阶段产出、图片、反馈与 STEAM 收获生成可编辑终稿草稿（AI 不可用时回退本地规则草稿）；阶段产出 `[id]/stages`（GET 全部）与 `[id]/stages/[index]`（PUT 落库）；阶段导师反馈 `[id]/stages/[index]/review`（保存当前产出、消耗 AI 配额、生成结构化反馈并写回 `ai_feedback`）；阶段导师工具 `[id]/stages/[index]/coach`（保存当前草稿后生成拆题/提示/总结受控 JSON，仅返回前端展示不写库）；PBL 工作台 `[id]/workspace` 保存个人项目方向并返回受控个人化计划 |
| tutor | `api/tutor/` | **AI 导师小迪**统一对话 `chat`（GET 历史+配额+本地开场白，`quotaOnly=1` 只刷代币；POST SSE 流式，global 场景按 `surface` 页面标识（home/explore/nature/create/courses/community/playground/profile/users）差异化场景与开场白并注入个性化推荐项目候选，`/playground/*` 游戏页归入 playground surface；course 场景支持 `lessonId` 课时上下文、species 场景按物种 slug 注入档案（识别/生境/季节），并可在回复流中发送白名单 `tool_call` 结构化事件；DELETE 归档当前线程并开启新对话）；历史对话只读回看 `conversations`（GET 按场景列归档线程+首条用户消息预览）与 `conversations/[id]`（GET 线程消息，归属校验）；图片接受三类来源（PBL 阶段产出 / 本人观察照片 / 聊天直传 `project-images/tutor-chat`）；落库失败发 `warning` 事件并退代币；代币门禁 `consume_ai_credit`（免费退款按当日 refund 流水抵扣）；Admin `admin/users/[id]/credits`、`admin/ai-usage` |
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
| playground | `api/playground/` | 游乐场云端战绩徽章同步；`badges/sync` 读取 `playground_stats` 并补发已达成的游乐场徽章；在线五子棋 `gomoku-rooms` 创建/加入/离开房间，加入接口按 6 位邀请码用 service role 查询 waiting 对局后再写入 guest，避免 RLS 把未加入用户的有效房间隐藏成不存在；邀请链接会等前端 auth 初始化完成后再自动加入，未登录时登录链接用 `next` 保留 `room` 参数 |
| observations | `api/observations/` | 自然观察 CRUD；提交先进入待审核，公开列表/点赞/评论/鉴定仅开放已通过记录 |
| profile | `api/profile/` | 个人资料摘要、新手引导、学习打卡、本周探索计划（聚合 PBL 阶段/课程/自然观察/雷达等信号）；`growth-tasks/sync` 与 `weekly-plan` 都会读取 `profiles.bio` 并调用 `get_user_stats_summary` 计算成长任务进度 |
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
- `mobile-shortcut-carousel.tsx` — 首页移动端自然频道/排行榜快捷卡横向 snap 轮播；滚动和点击分页点时同步当前指示点
- `compact-project-grid-styles.ts` — 首页热门 / 探索列表共用的两列竖版项目卡网格与卡片样式 class
- `recommendation-panel.tsx` — 推荐项目面板

### 3.4 业务功能 (`components/features/`)

| 子目录 | 文件数 | 职责 |
|--------|--------|------|
| `bird-observation/` | 14 | 观察提交表单、照片上传、地图选点、观察卡片、物种热点面板、物种统计面板（无观察记录时隐藏）、评论区；观察详情 AI 鉴定头像使用 `public/xiaodi-ai/` 小迪静帧 |
| `challenge/` | 5 | 挑战提交表单（新建时按阶段产出汇总预填，并可一键整理成可编辑投稿草稿：标题、作品说明/反思、阶段图片与 STEAM 收获）、PBL 信息 `pbl-info`（「相关资料」按 参考项目/前置技能/资料卡 三分类分组渲染，带描述行）、评分星级、阶段工作台 `stage-workspace`（逐步解锁引导：未解锁阶段不渲染，仅显示"还有 N 步"折叠提示；支持保存个人项目方向并显示每阶段个人化计划；阶段产出防抖自动保存，唯一主按钮「完成这步」+完成清单(成功标准)+导师工具「帮我拆题 / 给我提示 / 整理这步」返回受控参考卡；「请导师看看这步」生成并持久化 做得好/还缺/下一步 反馈卡；注册小迪 `pbl.focus_current_stage` 工具 handler，在卡住/下一步/反馈意图下展开并高亮当前阶段）、提交作品画廊 |
| `courses/` | 9 | 技能课程列表 `course-board`、课时侧栏 `lesson-sidebar`（可响应小迪 `course.focus_lesson_step` 聚焦并高亮当前课时步骤；可从 `content.learningGoals` / `content.teacherGuide` 渲染探究问题、学习目标、材料准备、引导提问、观察记录、延伸和家庭分享；课时页会把当前 active step 和 Scratch 步骤内的积木提示游标传给小迪，避免“下一步/卡住了”回跳到第 1 步，且同一步有多个积木动作时先逐个高亮再进入下一步骤；Scratch 课时可响应 `course.highlight_scratch_blocks` 在工作区提示并定位目标积木；底部「基于 Scratch · 作品保存在本平台」只在 `lesson_type=scratch` 时显示）、工作区路由 `lesson-workspace-renderer`（按 `lesson_type` 分发 Scratch / building_3d / playground）、Scratch iframe `scratch-workspace`、大颗粒积木 3D 搭建 `building-3d-workspace`（GLTF / LDraw `.mpd` 双分支；大颗粒新课优先使用 `scripts/ldraw-models/*.ldr` 源模型打包到 `public/courses/ldraw/*.mpd`，模型内 `0 STEP` 驱动分步显隐；学前大颗粒 12 课为真实 DUPLO/LDraw 网格搭法与原创 STEAM 课案，参考资源指向 LEGO Education 官方课程库与 LEGO 官方搭建说明入口；LDraw 模型质量入口统一走 `.agents/skills/image-to-ldraw` 的 `part-metadata.json` 零件端口/碰撞定义和 `validate-assembly.mjs`，assembly 可用 `tubeChecks` 声明管道端口连接和方向约束；配置了模型资源但加载失败时直接显示错误，不静默退回方块；当 `content.building3d` 提供 `slideImageUrls`/`videoUrl`/`slidesPdfUrl`/`finishedImageUrl` 时，工作区顶部出现「课件 / 3D 搭建」Tab：课件 Tab 是 PPT 翻页器（每页一张图），翻到 `videoSlideIndex`(1 基)那页就地用 `<video>` 播放抽出的内嵌动画，右上角「搭建说明」按钮另开 `slidesPdfUrl`，缺图的页有「待导入」占位；只有 `videoUrl` 而无幻灯片图时退化为独立「动画」Tab；无 PPT 图但有 PDF 时课件 Tab 内嵌 PDF；3D 搭建保持 three.js 常驻不随切 Tab 卸载，右侧零件栏顶部展示成品参考图——用于「课件（PPT 含内嵌动画）+ 搭建说明 + 成品图 + LDraw 3D」课时闭环，幻灯片图用 `scripts/normalize-slides.mjs` 从 PowerPoint 导出图整理而来；当 `content.building3d.worksProjectId` 指向某「背书项目」时，顶部多出「作品」Tab `lesson-works-gallery`（就地展示这一课的公开作品，数据来自 `GET /api/projects/[id]/completions`，含封面/作者/点赞，顶部带上传入口、上传后刷新），右侧操作区也保留「上传我的作品」入口 `lesson-work-upload`（仅在打开弹窗时局部挂 `ProjectProvider` 以满足 `CompleteProjectDialog` 的 `useProjects()` 依赖，复用项目侧 `POST /api/projects/[id]/completions` 提交实物照片→AI 审核→社区/个人主页展示），实现「课程教学 + 项目作品墙」的桥接）、游乐场实训 `playground-workspace`（把 `/playground/*` 游戏包成导学课：讲解 + 棋盘示意 + 「去实战」按钮跳回游戏页 + 本课进度条 + 完成课时 +XP；目前支持 `gameKey=gomoku` 五子棋，步骤可用 `visuals[].type=gomoku_board` 配置多张结构化棋盘图解；移动端单栏精简）、五子棋棋盘 SVG `gomoku-board`、步骤富文本 `lesson-rich-text` |
| `community/` | 1 | 讨论列表（含搜索、排序、分页） |
| `gamification/` | 10 | 徽章图标/画廊、等级进度、排行榜、成就 Toast、每日登录同步（登录用户首页也挂载，临时失败自动重试）、观察游戏化同步 |
| `moderator/` | 2 | 审核员申请表单 |
| `tutor/` | 6 | 全局 AI 导师「小迪」（吉祥物史迪姆）：`tutor-context` Provider（含场景 override、Scratch 编辑器上下文、scene capability、待发送消息队列与白名单 tool handler 注册/分发），`tool-handler-registry` 负责把后端 tool 名映射到当前页面提供的“聚焦课程步骤 / 聚焦 PBL 阶段”等前端能力，并反推出当前 scene capability 供请求一并上送，避免各页面自己逐个绑定工具名；`scene-capabilities` 同时管理页面动作能力和回复增强能力，`speciesAudio` 仅在物种档案/自然观察记录有鸟类音频时由服务端场景授权，课程场景不自动补鸟鸣；`global-tutor-mount` 按路由感知场景（含课时页 `lessonId`）并用 React Query 预取当前小迪会话、`global-tutor-fab` 使用 `<XiaoDi>` AI 8 帧候选作悬浮球，面板头部同一只小迪随 `listening/thinking/speaking` 状态切换，消息 loading 只保留文字提示以避免重复头像动画，并保留流式对话（聊天框可直传图片、场景照片一键发图、Scratch 课时页紧凑位；打开时优先消费预取缓存，⋯菜单含「开启新对话」与「历史对话」，归档线程列表+只读回看视图；消费 SSE `tool_call` 事件并交给当前场景 handler，支持 PBL 阶段聚焦与课时步骤聚焦；发送 Scratch 课时消息时附带当前选中角色/对象，避免默认说“小猫”）、`tutor-session` 会话 query key/fetch helper、`tutor-message-content` 回复轻量 Markdown 渲染 + Scratch 分类图例/积木形状富文本 + `[project:ID|标题]` 项目 chip + 经 `speciesAudio` 授权的 `[audio:slug|物种名]` 内联鸟鸣播放器、`xiaodi.tsx`+`xiaodi.module.css` 小迪吉祥物动画组件 `<XiaoDi state size onCycleEnd variant />`（默认 7 状态 idle/listening/thinking/speaking/success/error/working；原版每状态 4 帧 `public/xiaodi/<state>-<i>.webp` 逐帧切换，默认 `variant="ai-draft"` 使用 `public/xiaodi-ai/` 全状态 8 帧候选关键帧 + 状态化 CSS 补间：呼吸/前倾/摇摆/点头/弹跳发光/歪头/顿挫；状态切换 160ms 淡入淡出、根布局预载 idle/listening/thinking 首帧、挂载后预热帧集，帧/状态切换前等待目标帧 decode 且保留上一帧，避免加载期透明闪帧；AI 候选 idle/listening/thinking/speaking/error/success/working 分别约 3.6s/2.4s/2.8s/2.8s/1.8s/1.5s/2.6s 一轮；`prefers-reduced-motion` 降级静帧、`onCycleEnd` 支持 success/error 播一轮切回 idle） |
| `playground/` | 1 | 键盘帮助弹窗 |
| `project/` | 9 | 完成项目弹窗、项目详情操作栏、打赏弹窗、续做卡片 |
| `social/` | 2 | 关注按钮 |
| `shared/` | 2 | 通用评论卡片、底部回复框 |
| `profile/` | 16 | 头像上传、编辑资料弹窗、本周探索计划卡（失败回退今日行动卡，步骤统一用 3D spot icon，含新增 `plan-*` 图标）、STEAM 雷达图、新手引导行（毕业后整卡不再渲染）、学习打卡卡片、骨架屏；`profile-spot-icons` 统一内容层/导航 icon（`public/assets/profile-icons/` 3D WebP） |

### 3.5 管理后台 (`components/admin/`) — 11 个组件
项目审核卡片、探索记录审核、自然观察审核卡片、挑战管理（资源行支持三分类选择 + 描述，「资料卡」类型可从已发布资料卡库选取自动填链接）、**技能课程管理** `course-management`、**资料卡管理** `resource-management`（Markdown 正文编辑、草稿/发布切换）、完成审核、审核员申请列表、举报列表、全部项目管理、用户会员管理 `user-membership-management`

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
- `notification-context.tsx` — 通知（获取、标记已读、通知未读 + 私信未读汇总计数；未读数请求有 1.5s 模块级短缓存/同飞去重以压住 StrictMode 与多入口刷新；生产可经 Supabase Realtime 私有通道 `unread-counts:<user_id>` 订阅 `notifications`/`messages` 表变更刷新，通道访问由 `realtime.messages` RLS 限定为本人，本地开发默认跳过 Realtime WebSocket；Realtime 失败后自动断开并保留 HTTP 兜底，页面回到前台兜底刷一次）
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
| `lib/pbl/` | `challenge-workspace.ts`, `challenge-stage-review.ts`, `challenge-stage-progress.ts`, `stage-coach-actions.ts`, `challenge-submission-draft.ts` | PBL 工作台个人项目方向、个人化计划 JSON 类型、确定性计划生成与数据库行映射；阶段导师反馈上下文/产出摘要构建；阶段产出快照比较与反馈失效判断；导师工具动作（拆题/提示/总结）受控结果归一化；投稿草稿规则汇总、STEAM 收获提取与 AI 草稿归一化 |
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
| `lib/playground/` | `catalog.ts`, `storage.ts`, `minesweeper-stats.ts`, `gomoku-online.ts` | 游戏目录、本地/云端成绩存储；扫雷统一写入 `minesweeper_stats`，读取时经 `readMergedMinesweeperStats` 合并旧 `minesweeper_best_times`；在线五子棋共享房间/棋盘类型、空棋盘构造和房间码生成，落子权威逻辑由数据库 RPC `gomoku_place_stone` 执行 |
| `lib/utils/` | 11 个文件 | 文件校验、HTTP 工具、上传、手机号、拼音、自然导航、主题分类 |
| `lib/auth/` | `server.ts` | 服务端认证辅助 |
| `lib/testing/` | `playwright-smoke.ts` | E2E 测试辅助 |
| `lib/membership.ts` | `membership.ts` | 会员档位/周期、有效性判断与 AI 代币常量（免费 5 次/天、会员月发 1500 代币、图文扣费 1/2） |
| `lib/courses/` | `types.ts`, `lesson-types.ts`, `device.ts`, `scratch-messages.ts`, `scratch-validate.ts`, `scratch-hints.ts` | 技能课程课时类型（scratch / building_3d / playground / reading / video / quiz）、课时步骤可选结构化图解类型（目前 `gomoku_board` 支持黑白子、候选点、辅助线、获胜线），3D 步骤 `cameraHint` 支持 front/back/side/top/isometric 视角、课程内容可用 `learningGoals` / `teacherGuide` 声明学习目标与教师/家长引导、`building_3d` 内容优先用 `ldrawModelUrl` 指向自托管 LDraw `.mpd` 模型，模型内 `0 STEP` 驱动分步显隐，可选 `slideImageUrls`(PPT 逐页图)/`videoUrl`+`videoSlideIndex`(动画及其所在课件页号)/`slidesPdfUrl`(搭建说明)/`finishedImageUrl` 媒体字段驱动课时工作区的课件翻页器（含页内动画播放）与成品参考图，可选 `worksProjectId` 指向作品墙背书项目（搭完上传实物照，复用项目侧作品提交）；`brickInstances` 仅作为历史/开发兜底，不用于新增大颗粒课程、设备能力判断、Scratch iframe postMessage 协议（含 `EDITOR_CONTEXT` 选中角色/对象快照）、`.sb3` 积木校验；`scratch-hints.ts` 同时负责小迪 Scratch 积木提示规则、课时富文本标记解析与自然语言清洗，区分 Scratch 工具箱可找到的默认积木和拖出后要改的文字/参数，`requiredBlocks.anyOf` 会作为 flyout 定位候选 opcode 下发，并支持 `[[cat]]` / `[[block]]` 渲染成课程同款 Scratch 积木形状 |
| `lib/ai/tutor/` | `engine.ts`, `prompt.ts`, `student-profile.ts`, `context-builders.ts`, `reply-focus.ts`, `audio-tags.ts`, `species-hints.ts`, `memory.ts`, `greeting.ts`, `resolve-context.ts`, `tool-calls.ts`, `tool-registry.ts`, `tool-call-planner.ts`, `scene-capabilities.ts` | AI 导师小迪：…物种对话时按提及物种注入「常见环境」（habitat_notes）与「本站公开观察记录」（topLocations 聚合），并约束不要把学生/站内地名观察说成「常见于XX」；课时/阶段 UI 交互使用白名单 tool call，`scene-capabilities.ts` 定义前后端共享的 scene capability 契约（如 `focusCourseLessonStep`、`focusChallengeStage`），`context-builders.ts` 会按场景产出服务端 capability 上限（例如课程课时默认带 `focusCourseLessonStep`、PBL 阶段默认带 `focusChallengeStage`），POST 规划时再与前端当前真实挂载的 handler capability 取交集；`tool-registry.ts` 先按当前 scene 与 capability 限定可用工具，`tool-call-planner.ts` 只在这些可用工具里做 AI 决策，再由 registry 统一校验并生成真实 tool call；`tool-calls.ts` 仅保留工具名称和 payload 类型，不再用正则做“卡住/下一步/反馈”确定性判断；Scratch 课时会结合当前步骤、服务端归一化后的 pending `targetItemIndex` 游标和原始子动作数，决定是停留当前子动作、切到同一步下一个积木动作，还是进入下一课时步骤；`reply-focus.ts` 会把本轮页面工具的当前高亮子动作插到模型场景最前面，确保文本回复和高亮目标一致，避免“然后呢”触发同一步下一个动作时回复却提前讲下一步骤；planner 失败时不触发页面工具，但不影响主回复链路；…
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
| `use-2048` 等 | `hooks/playground/` | 13 个游戏逻辑 Hook（2048/24点/五子棋/扫雷/汉诺塔/数独/N皇后/生命游戏、数字华容道、记忆翻牌、速算闪电战、迷宫探险、七巧板）；在线五子棋 `use-game-room.ts` 优先订阅 Supabase Realtime，失败后自动降级为 4 秒 HTTP 轮询兜底，避免线上 WebSocket 不可用时持续重连刷错；各游戏 `stats` 初始化统一用空 stats（`EMPTY_STATS` 或显式空对象/数组字段），真实本地战绩在 `useEffect` 挂载后从 localStorage 异步加载，避免 SSR=0/CSR=真实值 造成 hydration mismatch（扫雷原本就是此模式） |

---

## 6. 数据库 (`supabase/`)

- `supabase/migrations/` — **249 个**迁移文件；…；AI 导师统一表+笔记本：`20260610150000_tutor_messages_and_notebooks.sql`；小迪物种档案上下文：`20260610170000_tutor_species_context.sql`；小迪对话线程：`20260611140000_tutor_conversations.sql`；AI 代币体系：`20260610151000_ai_credit_system.sql`；PBL 工作台个人化计划：`20260615100000_challenge_workspaces.sql`；在线五子棋对局表/服务端权威落子 RPC/Realtime 策略：`20260625180000_gomoku_matches.sql`、`20260625180100_gomoku_realtime_publication.sql`、`20260625180200_gomoku_realtime_channel_policy.sql`，RPC JSONB 路径类型修复：`20260627145000_fix_gomoku_jsonb_path_casts.sql`；五子棋博弈论入门课程种子与扩写（lesson_type=playground，结构化棋盘图解，不含外部参考资源链接）：`20260626140000_seed_gomoku_course.sql`、`20260626150000_enrich_gomoku_course.sql`、`20260626200000_clear_gomoku_lesson_resources.sql`；学前大颗粒积木工程启蒙课程种子与 12 课时扩展（lesson_type=building_3d，原创高塔/小车/小桥/动物小屋/坡道/齿轮/跷跷板/迷宫/花园/吊车/风车/小乐园内容，含 `learningGoals`、`teacherGuide`，后续统一切到自托管 LDraw `.mpd` 模型）：`20260627170000_seed_preschool_brick_engineering_course.sql`、`20260627172000_expand_preschool_brick_engineering_course.sql`、`20260627173000_preschool_brick_ldraw_models.sql`；学前大颗粒课程重做为公开 STEAM 方向下的原创 12 课（稳稳高塔、小车跑直线、小桥承重、动物小屋、高低平台、转向指针、左右平衡桥、迷宫路线、规律花园、升降高塔、十字转盘、积木小乐园），并保留每课自托管 LDraw 模型：`20260627174000_redesign_preschool_brick_curriculum.sql`；已执行环境的现实搭建修复与官方参考资源回填：`20260628125000_fix_preschool_brick_realistic_lessons.sql`；把「大颗粒积木工程启蒙」第一课「会跑的小车」替换为「埃菲尔铁塔」样板课（13 步严格对照搭建说明 PDF 的 13 页：外八字腿→蓝红交替分层→双层灰平台→收窄塔身→中央蓝红条纹塔尖；动画 mp4 + 搭建说明 PDF + 成品图 + 自托管 LDraw `eiffel-tower.mpd`，模型由 `scripts/ldraw-models/gen-eiffel.mjs` 4 重对称生成并通过悬空/穿模自检，演示乐高课件四件套 + 3D 闭环，资源本地 `public/courses/eiffel-tower/`）：`20260628140000_replace_first_brick_lesson_with_eiffel.sql`；随后将埃菲尔样板课落点改到「小小积木工程师：学前大颗粒启蒙」第 1 课（原「稳稳高塔」→「埃菲尔铁塔」），并把「大颗粒积木工程启蒙」第一课还原回「会跑的小车」：`20260628150000_move_eiffel_to_preschool_lesson1.sql`；课件100「抽屉」「大象」「大熊猫」「灯塔」「电话机」「电影院」「东方明珠」课时挂载本地 LDraw 模型/对齐 3D 步数：`20260705150000_lesson_37_chou_ti_ldraw_model.sql`、`20260705153000_lesson_38_elephant_ldraw_model.sql`、`20260705154000_lesson_39_panda_ldraw_model.sql`、`20260705155000_lesson_40_lighthouse_ldraw_model.sql`、`20260705160000_lesson_41_telephone_ldraw_model.sql`、`20260705162000_lesson_42_cinema_ldraw_model.sql`、`20260705161000_lesson_43_dong_fang_ming_zhu_ldraw_model.sql`、`20260705163000_lesson_43_dong_fang_ming_zhu_steps.sql`；埃菲尔铁塔 LDraw 课程字段刷新：`20260705164000_eiffel_tower_ldraw_refresh.sql`；个人资料 `profiles.bio` 明确建列与 Realtime `messages` 复制读取授权修复：`20260626211500_profiles_bio_column.sql`、`20260626211600_realtime_messages_select_grant.sql`；免费配额退款修复：`20260610160000_fix_ai_free_refund.sql`；函数 search_path 安全加固：`20260627150000_lock_function_search_path_empty.sql`（把全部 public schema routine 锁定到 `search_path = ''`，真正消除 Database Linter `function_search_path_mutable` 告警；先 `CREATE OR REPLACE` 重写 5 个含未全限定引用的函数补 `public.` 前缀，再用幂等 DO 块批量 ALTER 其余 routine；历史 `20260305100000` / `20260523140000` 用 `public` 不被 linter 接受；审计工具 `scripts/audit-function-search-path.mjs`）（均需 `pnpm db:push` 应用）
- `supabase/seed.sql` — 种子数据入口
- `supabase/scripts/prepare_migration.sql` — 迁移准备脚本

### 核心数据表
`profiles`（含 `membership_tier` / …） · … · **`species`**（自然观察物种，含 `nature_topic` 与植物属性 `life_form` / `cultivation_status` / `plant_uses`） · **`gomoku_matches`**（在线五子棋对局，`board`/`moves` JSONB 快照，落子走 `gomoku_place_stone` RPC） · **`tutor_conversations`**（小迪对话线程，active/archived） · **`tutor_messages`**（小迪统一对话消息，归属 conversation） · **`tutor_notebooks`**（小迪长期记忆摘要） · **`ai_credit_wallets`** / **`ai_credit_logs`**（AI 代币钱包与流水） · **`challenge_stage_progress`** · **`challenge_workspaces`**（PBL 个人项目方向与个人化计划） · …

完整类型定义：`lib/supabase/types.ts`

---

## 7. Scratch 编辑器子包 (`packages/scratch-host/`)

- 基于 **`@scratch/scratch-gui` 11.x**（官方 scratch-editor 生态）独立 Webpack 构建，与 Next.js 主站 React 19 隔离
- 构建：`pnpm --filter scratch-host build` → `pnpm --filter scratch-host copy-to-public` → 输出到 `public/scratch/`（整目录 gitignore，CI/Docker 的 `pnpm build` 会自动构建）
- Scratch 素材库 `public/scratch/assets/` 已迁 OSS（`scratch/assets/` 前缀）；配置 `NEXT_PUBLIC_ASSETS_BASE_URL` 后，生产环境 `/internalapi/asset/*` rewrite 到 OSS；本地开发默认 rewrite 到 `/api/assets/scratch/assets/*` 代理（带生产 Referer 绕过防盗链），未配置 base URL 时仍走本地 `public/scratch/assets/`
- 本地开发编辑器：`pnpm --filter scratch-host dev`（:8601），学习页 iframe 默认加载 `/scratch/index.html`
- 与主站通信：`lib/courses/scratch-messages.ts` postMessage 协议；保存走 `POST /api/courses/.../project`；主站可向 iframe 发送 `HIGHLIGHT_BLOCK_KEYWORDS` / `DISMISS_BLOCK_KEYWORDS`，host 内部显示/关闭积木关键词提示 overlay，并在可解析分类时尝试切换 Scratch toolbox 分类、按 `items.blockIds` opcode 或积木文案滚动并高亮 flyout 里的当前目标积木；主站对同一步多积木提示只向 iframe 下发当前 `targetItemIndex` 对应的关键词/item，避免一次只高亮第一个后直接跳步；host 会通过 `EDITOR_CONTEXT` 回传当前选中角色/对象、角色列表、坐标/方向/大小/造型/积木数摘要，课时页再随小迪 POST 注入场景

---

## 8. 脚本 (`scripts/`)

| 脚本 | 功能 |
|------|------|
| `db-push.mjs` | 数据库迁移推送工具（push/status/baseline） |
| `audit-function-search-path.mjs` | 只读审计 public schema 所有 routine 的 `search_path` 现状与函数体内未全限定表/视图引用，评估改成 `search_path = ''` 的安全性（配合 `20260627150000` 迁移） |
| `compress-project-images.mjs` | 压缩目录图片（`COMPRESS_IMAGES_DIR` / `COMPRESS_MAX_SIDE` / `COMPRESS_JPEG_QUALITY`）；`pnpm compress:fruit-images` 压缩水果图集至 1280px |
| `profile-icons-remove-bg.mjs` | 去除 `public/assets/profile-icons/` WebP 烘焙底色并写入透明通道 |
| `xiaodi-rembg.py` + `xiaodi-frames.mjs` | 小迪吉祥物动画帧管线：`scripts/xiaodi-src/<state>.jpg`（7 张 1024x512 白底 AI 生成图，一行 4 姿势）先经 rembg(isnet-general-use) AI 去底成 `<state>.rgba.png`（python venv：`python3 -m venv ~/.venvs/xiaodi && pip install rembg onnxruntime pillow numpy`，首跑下载 ~180MB 模型；纯白机器人+白底，阈值法会啃掉机身，必须走 AI 分割），再由 `node scripts/xiaodi-frames.mjs` 切 4 帧、清低 alpha 噪声、过滤 speaking/error 的远离主体小连通块、同状态身高归一后按每帧足部中心+脚底线注册到同一锚点，输出 `public/xiaodi/<state>-<0..3>.webp`（512x512 透明底，共 28 帧 ~1MB）与人工校验图 `tmp/xiaodi-preview.png` |
| `fetch-bird-media-from-wikimedia.mjs` | 从 Wikimedia 抓取鸟类图片 |
| `fetch-tree-images.mjs` | 从 Wikimedia 抓取树木图片 |
| `fetch-fruit-images.mjs` | 抓取水果/干果**果实图**（优先 iNaturalist 结果期观测 + Wikimedia 果实关键词搜索）；下载后自动压缩至 1280px |
| `sync-bird-media-to-db.mjs` | 同步鸟类媒体到数据库 |
| `migrate-public-to-oss.mjs` | 上传 OSS 静态资源（物种图、项目图、Scratch 素材库等；支持 `--only=fruits`；`--only=project-covers` 只同步 `public/projects` 根层旧项目封面；`--only=courses` 上传前会把课时 `slides/*` 和 `finished.*` PNG/JPG 转 WebP，避免课件大图原样进 OSS） |
| `fetch-scratch-assets.mjs` | 镜像 Scratch 素材库到本地，再经 migrate 脚本上传 OSS |
| `ldraw-models/` | 大颗粒 LDraw 源模型与生成脚本目录；逐课生成器、assembly JSON、`.ldr`、BOM/report 放在这里；埃菲尔铁塔以 `eiffel-tower.ldr` 为源，重新打包为 `public/courses/ldraw/eiffel-tower.mpd`，并由 `20260705164000_eiffel_tower_ldraw_refresh.sql` 刷新课程字段；lesson 33「长颈鹿」当前以 Studio 导出的 `3-chang-jing-lu.ldr` 为打包源，已打包为 `public/courses/ldraw/3-chang-jing-lu.mpd`（含本地 `3437pb049.dat` 眼睛件别名；`31191.dat`/`31195.dat`/`31452.dat`/`42029.dat` 采用 Studio CustomParts 同版定义，以保持管道、弯管和圆环方向与 Studio 导出一致；`gen-3-chang-jing-lu.mjs`/assembly JSON 仅作早期生成稿参考，重新生成会覆盖 Studio 对齐结果）；lesson 37「抽屉」以 Studio 导出的 `3-chou-ti.ldr` 为源，打包为 `public/courses/ldraw/3-chou-ti.mpd`，并由 `20260705150000_lesson_37_chou_ti_ldraw_model.sql` 挂载到课程；lesson 38「大象」以 Studio 导出的 `duplo_elephant_steps.ldr` 为源，清理尾部空 STEP/NOFILE 后打包为 `public/courses/ldraw/duplo_elephant_steps.mpd`，并由 `20260705153000_lesson_38_elephant_ldraw_model.sql` 挂载到课程；lesson 39「大熊猫」以 Studio 导出的 `duplo_panda_steps.ldr` 为源，清理尾部 NOFILE 后打包为 `public/courses/ldraw/duplo_panda_steps.mpd`，并由 `20260705154000_lesson_39_panda_ldraw_model.sql` 挂载到课程；lesson 40「灯塔」以 Studio 导出的 `duplo_lighthouse_steps.ldr` 为源，清理尾部 NOFILE 后打包为 `public/courses/ldraw/duplo_lighthouse_steps.mpd`，并由 `20260705155000_lesson_40_lighthouse_ldraw_model.sql` 挂载到课程；lesson 41「电话机」以 Studio 导出的 `duplo_telephone_steps.ldr` 为源，清理尾部 NOFILE 后打包为 `public/courses/ldraw/duplo_telephone_steps.mpd`，并由 `20260705160000_lesson_41_telephone_ldraw_model.sql` 挂载到课程；lesson 42「电影院」以 Studio 导出的 `duplo_cinema_steps.ldr` 为源，清理尾部 NOFILE 后打包为 `public/courses/ldraw/duplo_cinema_steps.mpd`，并由 `20260705162000_lesson_42_cinema_ldraw_model.sql` 挂载到课程；lesson 43「东方明珠」以 `3-dong-fang-ming-zhu.ldr` 为源，打包为 `public/courses/ldraw/3-dong-fang-ming-zhu.mpd`，并由 `20260705161000_lesson_43_dong_fang_ming_zhu_ldraw_model.sql` 挂载到课程、`20260705163000_lesson_43_dong_fang_ming_zhu_steps.sql` 同步侧栏 steps；`duplo_panda_steps.ldr` 熊猫源模型已改成 Studio 友好的纯主模型引用，不再内嵌 `31191/31193/31195/31452` 简化 fallback，避免 Studio 同名内嵌件和 CustomParts 正式件冲突；`3-chou-ti.ldr` 抽屉模型只保留主模型和 `1 ... 42029.dat` 引用，不内嵌 `0 FILE 42029.dat` 子文件，避免 Studio 把 42029 当子模型/重复零件定义导致显示异常；新增或修改模型后统一跑 `.agents/skills/image-to-ldraw/scripts/resolve-parts.mjs`、`validate-assembly.mjs`、必要时 `assembly-to-ldraw.mjs`，再用 `pack-ldraw-model.mjs` 打包为 `public/courses/ldraw/*.mpd`；侧视角/非从下往上堆叠的模型（`gen-3-bao-jian.mjs` 宝剑、`gen-3-chang-jing-long.mjs` 长颈龙）用 `u`/`v`/`depth` 网格 + 精确 `ldrawLine` 变换，sandwich 层间距要用 `part-metadata.json` 的 `heightLdu` 推导（不能写死 `±48`/`±24`，否则厚砖/薄板换用时间距会错），见 `.agents/skills/image-to-ldraw/references/duplo-ldraw-conventions.md` 的 Side-Built Models 章节；`validate-assembly.mjs` 对每个 `ldrawLine` 占位都强制要求显式 `support`（含 `{type:'manual',reason}`）并做真实碰撞检测，不再整体跳过 exact transform，历史遗留的越界/无支撑用占位级 `acceptedOverlaps`/`support.manual` 写明理由豁免（而不是件级 `collisionPolicy:'manual'` 一key 全放过）；新增件颜色是砖还是板存疑时用 `.agents/skills/image-to-ldraw/scripts/measure-thickness.mjs` 配合 `references/thickness-review.md` 的像素测量法和渲染图↔源图截图复核流程判定，不要凭邻近步骤或默认 `partId` 猜 |
| `ldraw-models/3-gang-qin.ldr`, `3-gou-wu-che.ldr`, `3-gui-zi.ldr`, `3-hu-die.ldr`, `3-hua-hua-ti.ldr`, `3-hua-jiao.ldr`, `3-huo-jian.ldr`, `3-ji-jiu-bao.ldr`, `3-jiang-bei.ldr` | 3+ 课件第 44「钢琴」、46「购物车」、49「柜子」、51「蝴蝶」、52「滑滑梯」、53「花轿」、55「火箭」、56「急救包」、57「奖杯」的得宝件限定 LDraw 源草稿；仅用于后续人工 Studio/PDF 修复，**未**打包成 MPD、**未**挂载课程、**未**生成迁移 |
| `ldraw-models/3-jing-che.ldr`, `3-jiu-hu-che.ldr`, `3-ju-ji-qiang.ldr`, `3-kua-hai-da-qiao.ldr`, `3-la-gan-xiang.ldr`, `3-la-ji-tong.ldr`, `3-lan-qiu-chang.ldr`, `3-lao-qiu-bi-sai.ldr`, `3-li-he.ldr`, `3-liang-ting.ldr`, `3-liu-bing-xie.ldr`, `3-long-zhou.ldr`, `3-lun-chuan.ldr` | 3+ 课件第 58「警车」至 70「轮船」的得宝件限定 LDraw 源草稿；参考 OSS 成品图与课程搭建说明轮廓生成，用于后续人工 Studio/PDF 修复，**未**打包成 MPD、**未**挂载课程、**未**生成迁移 |
| `ldraw-models/3-ma-che.ldr`, `3-mao-mao-chong.ldr`, `3-mei-li-de-xiao-qu.ldr`, `3-pang-xie.ldr`, `3-pen-zai.ldr`, `3-ping-heng-da-shi.ldr`, `3-qian-shui-jing.ldr`, `3-qian-shui-ting.ldr`, `3-qiu-qian.ldr`, `3-ren-xing-tian-qiao.ldr`, `3-sa-shui-hu.ldr`, `3-shan-yang.ldr`, `3-shen-mi-de-jin-zi-ta.ldr` | 3+ 课件第 71「马车」至 83「神秘的金字塔」的得宝件限定 LDraw 源草稿；参考 OSS 成品图与课程搭建说明轮廓生成，用于后续人工 Studio/PDF 修复，**未**打包成 MPD、**未**挂载课程、**未**生成迁移 |
| `ldraw-models/3-sheng-dan-lao-ren.ldr`, `3-shi-bo-guan.ldr`, `3-shi-wai-ka-fei-zhuo.ldr`, `3-shou-dian-tong.ldr`, `3-shu-kou-bei.ldr`, `3-shu-wu.ldr`, `3-shu-zhuang-tai.ldr`, `3-shuang-ceng-ba-shi.ldr`, `3-shui-shang-le-yuan.ldr`, `3-tai-qiu.ldr`, `3-tan-ke.ldr`, `3-tao-quan-quan.ldr`, `3-tian-e.ldr` | 3+ 课件第 84「圣诞老人」至 96「天鹅」的得宝件限定 LDraw 源草稿；参考 OSS 成品图与课程搭建说明轮廓生成，用于后续人工 Studio/PDF 修复，**未**打包成 MPD、**未**挂载课程、**未**生成迁移 |
| `ldraw-models/3-tiao-shui-chi.ldr`, `3-tu-shu-jia.ldr`, `3-tui-la-men.ldr`, `3-tui-tu-ji.ldr`, `3-wan-sheng-jie-nan-gua-tou.ldr`, `3-wang-yuan-jing.ldr`, `3-wo-niu.ldr`, `3-wo-shi-xiao-chu-shi.ldr`, `3-wu-gui.ldr`, `3-wu-long.ldr`, `3-xi-che-chang.ldr`, `3-xi-chen-qi.ldr`, `3-xi-shou-tai.ldr` | 3+ 课件第 97「跳水池」至 109「洗手台」的得宝件限定 LDraw 源草稿；参考 OSS 成品图与课程搭建说明轮廓生成，用于后续人工 Studio/PDF 修复，**未**打包成 MPD、**未**挂载课程、**未**生成迁移 |
| `ldraw-models/3-xia-shui-dao.ldr`, `3-xiang-pi-ting.ldr`, `3-xiao-fang-che.ldr`, `3-xiao-huo-che.ldr`, `3-xiao-ke-dou-zhao-ma-ma.ldr`, `3-xiao-niao-gui-chao.ldr`, `3-xiao-qiu-jie-li-sai.ldr`, `3-xiao-ti-deng.ldr`, `3-xiao-ya-zi-le-yuan.ldr`, `3-xue-gao-che.ldr`, `3-xun-lu-xue-qiao.ldr`, `3-you-er-yuan.ldr`, `3-you-guan-che.ldr` | 3+ 课件第 110「下水道」至 122「油罐车」的得宝件限定 LDraw 源草稿；参考 OSS 成品图与课程搭建说明轮廓生成，用于后续人工 Studio/PDF 修复，**未**打包成 MPD、**未**挂载课程、**未**生成迁移 |
| `ldraw-models/3-you-xiang.ldr`, `3-yu-gang.ldr`, `3-yun-dou.ldr`, `3-zhang-yu.ldr`, `3-zhao-xiang-ji.ldr`, `3-zu-qiu-chang.ldr`, `3-zuo-yi.ldr` | 3+ 课件第 123「邮箱」至 129「座椅」的得宝件限定 LDraw 源草稿；参考 OSS 成品图与课程搭建说明轮廓生成，用于后续人工 Studio/PDF 修复，**未**打包成 MPD、**未**挂载课程、**未**生成迁移 |
| `ldraw-models/4-an-jian-ji.ldr`, `4-ba-wang-long.ldr`, `4-ban-gong-yi.ldr`, `4-bao-jian.ldr`, `4-cha-che.ldr`, `4-chong-wu-gou.ldr`, `4-chun-jie-wu-shi.ldr`, `4-ci-xuan-fu-lie-che.ldr`, `4-da-long-xia.ldr`, `4-da-wen-zi.ldr`, `4-da-xiang.ldr`, `4-da-zha-xie.ldr`, `4-dao-dan-che.ldr` | 4+ 课件第 130「安检机」至 142「导弹车」的得宝件限定 LDraw 源草稿；参考 OSS 成品图与课程搭建说明轮廓生成，用于后续人工 Studio/PDF 修复，**未**打包成 MPD、**未**挂载课程、**未**生成迁移 |
| `ldraw-models/4-deng-long.ldr`, `4-dian-hua-ji.ldr`, `4-diao-che.ldr`, `4-dong-fang-ming-zhu.ldr`, `4-du-jiao-xian.ldr`, `4-e-yu.ldr`, `4-er-hu.ldr`, `4-er-tong-hua-ban-che.ldr`, `4-fan-chuan.ldr`, `4-fan-dou-che.ldr`, `4-fei-die.ldr`, `4-feng-che-fang.ldr`, `4-gao-tie-zhan.ldr` | 4+ 课件第 143「灯笼」至 155「高铁站」的得宝件限定 LDraw 源草稿；参考 OSS 成品图与课程搭建说明轮廓生成，用于后续人工 Studio/PDF 修复，**未**打包成 MPD、**未**挂载课程、**未**生成迁移 |
| `ldraw-models/4-gong-jian.ldr`, `4-gou-wu-che.ldr`, `4-hai-shi.ldr`, `4-han-xue-bao-ma.ldr`, `4-hu-die.ldr`, `4-hua-ban.ldr`, `4-hua-kai-hua-luo.ldr`, `4-huang-bao-che.ldr`, `4-huo-jian.ldr`, `4-ji-guan-qiang.ldr`, `4-ji-ta.ldr`, `4-jiu-hu-che.ldr`, `4-ju-ji-qiang.ldr` | 4+ 课件第 156「弓箭」至 168「狙击枪」的得宝件限定 LDraw 源草稿；参考 OSS 成品图与课程搭建说明轮廓生成，用于后续人工 Studio/PDF 修复，**未**打包成 MPD、**未**挂载课程、**未**生成迁移 |
| `ldraw-models/4-jun-jian.ldr`, `4-ke-ji.ldr`, `4-kong-que.ldr`, `4-kuai-ting.ldr`, `4-la-ji-fen-lei.ldr`, `4-lan-qiu-jia.ldr`, `4-lei-da.ldr`, `4-long-men-diao.ldr`, `4-long-zhou.ldr`, `4-lu-yin-ji.ldr`, `4-luo-tuo.ldr`, `4-mo-tian-lun.ldr`, `4-pang-xie.ldr` | 4+ 课件第 169「军舰」至 181「螃蟹」的得宝件限定 LDraw 源草稿；参考 OSS 成品图与课程搭建说明轮廓生成，用于后续人工 Studio/PDF 修复，**未**打包成 MPD、**未**挂载课程、**未**生成迁移 |
| `ldraw-models/4-qian-shui-ting.ldr`, `4-qing-ting.ldr`, `4-qiu-qian.ldr`, `4-re-qi-qiu.ldr`, `4-sai-che.ldr`, `4-she-xiang-ji.ldr`, `4-sheng-dan-xue-qiao.ldr`, `4-sheng-jiang-jiu-yuan-che.ldr`, `4-shi-zi-wang.ldr`, `4-shou-ge-ji.ldr`, `4-shu-bao.ldr`, `4-shuang-ceng-ba-shi.ldr`, `4-sun-wu-kong.ldr` | 4+ 课件第 182「潜水艇」至 194「孙悟空」的得宝件限定 LDraw 源草稿；参考 OSS 成品图与课程搭建说明轮廓生成，用于后续人工 Studio/PDF 修复，**未**打包成 MPD、**未**挂载课程、**未**生成迁移 |
| `ldraw-models/4-ta-diao.ldr`, `4-tai-deng.ldr`, `4-tai-yang-neng-re-shui-qi.ldr`, `4-tan-ke.ldr`, `4-tang-lang.ldr`, `4-tian-ping.ldr`, `4-tui-tu-ji.ldr`, `4-tuo-gua-che.ldr`, `4-tuo-niao.ldr`, `4-wa-li.ldr`, `4-wa-tu-ji.ldr`, `4-wai-xing-tan-ce-qi.ldr`, `4-wan-long.ldr` | 4+ 课件第 195「塔吊」至 207「腕龙」的得宝件限定 LDraw 源草稿；参考 OSS 成品图与课程搭建说明轮廓生成，用于后续人工 Studio/PDF 修复，**未**打包成 MPD、**未**挂载课程、**未**生成迁移 |
| `ldraw-models/4-wang-yuan-jing.ldr`, `4-wu-ren-ji.ldr`, `4-xian-wei-jing.ldr`, `4-xiang-wei-she.ldr`, `4-xiao-tu-zi.ldr`, `4-xie-la-qiao.ldr`, `4-xie-zi.ldr`, `4-xing-li-xiang.ldr`, `4-xuan-zhuan-fei-ji.ldr`, `4-xuan-zhuan-mu-ma.ldr`, `4-ya-lu-ji.ldr`, `4-yao-yao-ma.ldr`, `4-yi-long.ldr` | 4+ 课件第 208「望远镜」至 220「翼龙」的得宝件限定 LDraw 源草稿；参考 OSS 成品图与课程搭建说明轮廓生成，用于后续人工 Studio/PDF 修复，**未**打包成 MPD、**未**挂载课程、**未**生成迁移 |
| `ldraw-models/4-ying-er-che.ldr`, `4-you-wen.ldr`, `4-zhang-yu.ldr`, `4-zhao-xiang-ji.ldr`, `4-zhi-sheng-ji.ldr`, `4-zhi-zhu.ldr`, `4-zhong-guo-jie.ldr`, `4-zhong-guo-long.ldr`, `4-zuan-tu-che.ldr` | 4+ 课件第 221「婴儿车」至 229「钻土车」的得宝件限定 LDraw 源草稿；参考 OSS 成品图与课程搭建说明轮廓生成，用于后续人工 Studio/PDF 修复，**未**打包成 MPD、**未**挂载课程、**未**生成迁移 |
| `ldraw-models/5-bian-dan.ldr`, `5-bian-su-feng-shan.ldr`, `5-bing-chuang.ldr`, `5-bing-qiu-yun-dong-yuan.ldr`, `5-bu-gu-niao.ldr`, `5-ce-feng-yi.ldr`, `5-ce-ju-yi.ldr`, `5-cha-che.ldr`, `5-chang-pian-ji.ldr`, `5-che-ku-men.ldr`, `5-chou-you-ji.ldr`, `5-ci-xuan-fu-lie-che.ldr`, `5-da-bai-chui.ldr` | 5+ 课件第 230「扁担」至 242「大摆锤」的得宝件限定 LDraw 源草稿；参考 OSS 成品图与课程搭建说明轮廓生成，用于后续人工 Studio/PDF 修复，**未**打包成 MPD、**未**挂载课程、**未**生成迁移 |
| `ldraw-models/5-da-cha-de-xiao-niu.ldr`, `5-da-di-shu.ldr`, `5-da-zhuang-ji.ldr`, `5-dan-che.ldr`, `5-dan-gan-yun-dong-yuan.ldr`, `5-di-qiu-yi.ldr`, `5-diao-che.ldr`, `5-diao-shan.ldr`, `5-du-lun-shou-tui-che.ldr`, `5-dui-kang-qiu-zhuo.ldr`, `5-e-yu.ldr`, `5-fan-chuan.ldr`, `5-fan-dou-che.ldr` | 5+ 课件第 243「打镲的小牛」至 255「翻斗车」的得宝件限定 LDraw 源草稿；参考 OSS 成品图与课程搭建说明轮廓生成，用于后续人工 Studio/PDF 修复，**未**打包成 MPD、**未**挂载课程、**未**生成迁移 |
| `export-courseware-slides.mjs` | 批量把 `C:\Users\Administrator\Documents`（WSL 路径 `/mnt/c/Users/Administrator/Documents`）下的 3+/4+/5+ 课件 PPTX 导出到 `public/courses/<grade-pinyin-slug>/slides/slide-*`：先从 PPTX 包统计真实页数，跳过已完整目录，渲染到临时目录成功后再替换目标 `slide-*`，默认把 PNG/JPG 转 WebP 并刷新已有 `scripts/courseware/<slug>.json` 的 `slideImageUrls`；支持 `--dry-run`、`--force`、`--only=`、`--limit=`、`--upload`（只上传 WebP slides 到 `oss:courses/<slug>/slides/`，默认覆盖旧对象以修复早期单页导出）、`--skip-existing-upload`、`--no-webp`；LibreOffice 在沙箱/无图形后端环境可能失败，需在可用图形后端或沙箱外执行 |
| `import-courseware.mjs` | 课件文件夹→线上课程「资源管线」：按扩展名+关键词识别 PPT/视频/PDF/成品图 → 调 `pptx-to-slides.mjs` 切图（或 `--slides-dir`/`--build-slides-from-source`；后者会先生成到临时目录，成功后再替换已有 `slide-*.png/webp`，失败不动旧文件；默认导入时如自动切图失败但 `slides/` 已有多张图，会沿用现有幻灯片继续产出草稿）→ 幻灯片转 WebP（sharp，省~80%）→ 视频/PDF/成品图归一化到 `public/courses/<slug>/` → 可选 `--upload` 推 OSS → 产出 `scripts/courseware/<slug>.json`（building3d 内容草稿，steps/steps3d/LDraw 留空待人工/LLM 补；`videoSlideIndex` 可直接从 PPTX 关系文件探测，不依赖 LibreOffice 成功渲染）→（有 `--course/--lesson` 时）生成「作品墙」幂等迁移 `supabase/migrations/<ts>_<slug>_works_project.sql`（建/更新背书项目+打乐高/得宝标签+`jsonb_set` 回填课时 `worksProjectId`，`--no-works` 关闭、`--works-tags=`/`--works-title=` 自定义）；用法 `node scripts/import-courseware.mjs <课件文件夹> --slug=<slug> [--course= --lesson= --upload --no-webp --build-slides-from-source --no-works --dry-run]`；编排见 `.agents/skills/import-courseware` |
| `migrate-course-oss-images-to-webp.mjs` | 一次性把 OSS `courses/<slug>/slides/*.{png,jpg,jpeg}` 与 `courses/<slug>/finished.{png,jpg,jpeg}` 替换成同路径 `.webp`：列 OSS（若无 `ListBucket` 权限则从 Supabase 现有 URL 反推清单）→ 下载旧图（`--source=auto|oss|cdn`，OSS `GetObject` 被拒时可带 Referer 从 `NEXT_PUBLIC_ASSETS_BASE_URL` 读 CDN）→ sharp 转 WebP → 上传 `.webp` → 尝试删除旧对象（无 `DeleteObject` 权限时记录 `deleteSkipped` 并继续）→ 同步改 Supabase `course_lessons.content`/`courses.image_url`/背书 `projects.image_url` 与本地 `scripts/courseware/*.json`；必须显式 `--dry-run` 或 `--apply`，支持 `--only=`、`--quality=82`、`--concurrency=`、`--keep-originals`、`--no-db`、`--no-json`；`--cleanup-legacy --apply` 可在 WebP 已验证存在后按当前 WebP 引用反推并删除旧 PNG（需 OSS `DeleteObject` 权限）；需要 `ALIYUN_OSS_*` 与 Supabase service role 环境变量 |
| `upsert-courseware.mjs` | 300 课 MVP 批量上线（跳过 LDraw）：`--prepare` 改 JSON（OSS 绝对 URL、占位 steps、PPTX 探测 `videoSlideIndex`、去掉无模型 LDraw 引用）→ `--upload-assets` 只补传 `instructions.pdf`/`animation.mp4`/`finished.png`（slides 已传则 skip）→ 默认幂等 upsert 三门课（3+/4+/5+ 课件100）+ 300 `building_3d` 课时到 Supabase（pg/query）；`--dry-run`、`--only=<slug>` |
| `check-courseware-oss.mjs` | 用 OSS `headObject` 核对 300 课 WebP slides / PDF / video / WebP finished 是否已上传（图片检查 WebP，迁移前兼容旧 PNG 作为 legacy fallback；绕过 CDN 防盗链）；输出汇总 stats |
| `pptx-to-slides.mjs` | 一键把授课 `.pptx` 导成课件翻页器用的 `slide-01.png …`：LibreOffice(`soffice`) 转 PDF → poppler(`pdftoppm`) 切页 → 规范命名拷到课时 slides 目录，并探测内嵌视频在第几页提示设 `videoSlideIndex`。在部分环境无可用显示/图形后端时（常见于无桌面的容器/最小 WSL）会直接失败并提示补齐 `Xvfb/虚拟显示`；如仅已有 `slide-01.png` 会按占位图告警并提示补齐。需 `sudo apt install -y libreoffice poppler-utils fonts-noto-cjk fonts-wqy-zenhei`（中文字体必装，否则中文渲染成「□」豆腐块，脚本会预警）；用法 `node scripts/pptx-to-slides.mjs <input.pptx> [输出目录] [--dpi=150]` |
| `normalize-slides.mjs` | 当已有现成幻灯片图（如手动从 PowerPoint 导出的 PNG）时，按文件名数字自然排序规范成 `slide-01.png …` 拷到课时 `public/courses/<lesson>/slides/`；用法 `node scripts/normalize-slides.mjs <源目录> [输出目录]` |
| `pack-ldraw-model.mjs` | 把 `scripts/ldraw-models/*.ldr` 递归抓取依赖打包成单个自托管 `.mpd` + `LDConfig.ldr` 到 `public/courses/ldraw/`（大颗粒积木 3D 课用，零件库 CC BY / CCAL）；打包时优先使用 `scripts/ldraw-models/parts|p|models/` 本地自定义件，再复用已提交 `.mpd` 内联依赖作为缓存，最后联网抓取；会规范输入 LDraw 文本的 LF/行尾空白，并忽略源 `.ldr` 开头的 Studio `0 FILE ...` 标记，由输出名统一生成 MPD 主模型块；用法 `node scripts/pack-ldraw-model.mjs <source.ldr> <outName>` |

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
| `package.json` | 依赖与脚本；主站依赖基线为 Next 16.2.x / React 19.2.x / Supabase JS 2.108.x |
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

### 常用 pnpm 脚本（`package.json`）

| 命令 | 说明 |
|------|------|
| `pnpm type-check` | TypeScript 类型检查（`tsgo --noEmit`，`@typescript/native-preview` 原生编译器）；CI 使用此命令 |
| `pnpm type-check:tsc` | 同上，但使用经典 `tsc --noEmit`（与 `tsgo` 的 lib 定义可能不完全一致） |
| `pnpm lint` / `pnpm lint:eslint` | oxlint 快速检查产品源码（`app`/`components`/`hooks`/`lib`/Scratch 源码/根配置，跳过脚本与 agent 模板）/ ESLint 全量 Next.js 规则 |
| `pnpm test` / `pnpm test:e2e` | Vitest 单元测试 / Playwright E2E |

---

## 12. 静态资源 (`public/`)

| 目录 | 内容 |
|------|------|
| `public/assets/` | 页面背景图、英雄图（WebP/PNG）、游乐场插画；`/nature` 专题入口卡背景 `nature-topic-birds.webp` / `nature-topic-insects.webp` / `nature-topic-plants.webp` / `nature-topic-fungi.webp` |
| `public/assets/profile-icons/` | 个人主页模块 icon WebP（256px、新手引导、探索地图、时间线、快捷入口 action-*） |
| `public/assets/species-detail/` | 物种详情信息卡插图（鸟类、植物、昆虫专题） |
| `public/avatars/` | 12 个默认头像 SVG |
| `public/xiaodi/` | 小迪吉祥物动画帧（7 状态 × 4 帧 WebP，512x512 透明底，按脚底线与足部中心统一锚定；由 `scripts/xiaodi-rembg.py` + `scripts/xiaodi-frames.mjs` 生成，供 `components/features/tutor/xiaodi.tsx` 使用） |
| `public/xiaodi-ai/` | 小迪 AI 生成候选关键帧（7 状态 × 8 帧 WebP，512x512 透明底；由内置生图工具生成、`tmp/imagegen/` 草案经本地 chroma-key 去底、切帧、孤立碎片过滤并按脚底线/足部中心重新锚定得到；默认 `variant="ai-draft"` 使用，`/xiaodi-preview` 可切回原版 4 帧对比） |
| `public/birds/` | 鸟类物种封面图与鸟鸣音频（已迁 OSS，本地目录 gitignore；配置 `NEXT_PUBLIC_ASSETS_BASE_URL` 后各环境先解析到同一资源域名，本地开发再经 `/api/assets` 模拟线上 Referer） |
| `public/insects/` | 昆虫物种封面图（已迁 OSS，本地目录 gitignore；静态图片重写策略同 `public/birds/`） |
| `public/trees/` | 树木物种封面图（已迁 OSS，本地目录 gitignore；静态图片重写策略同 `public/birds/`） |
| `public/fruits/` | 水果与干果物种图片（并入植物专题，已纳入 OSS 同步与 `/api/assets` 代理白名单；`images/` 本地目录 gitignore） |
| `public/projects/` | 项目封面图、步骤图（WebP）；`public/projects/*.webp` 根层旧封面、`public/projects/generated/*.webp` 与 `public/projects/steps/` 已迁 OSS，配置 `NEXT_PUBLIC_ASSETS_BASE_URL` 后各环境先解析到同一资源域名，本地开发再经 `/api/assets` 模拟线上 Referer |
| `public/icon*.png` | PWA 图标 |
