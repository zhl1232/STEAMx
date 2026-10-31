# 创探空间 — 全局设计规范

> 面向 3–16 岁儿童与青少年、家长与教师。界面应鼓励式、清晰、偏探索感；桌面端优先宽容器，信息分区清楚。
> 本规范与 [`/design-system`](../app/design-system/page.tsx) 展示页、`app/globals.css` 及 `components/ui/*` 保持一致。

展示页仅供本地 `NODE_ENV=development` 使用，其他模式由服务端返回 404；完整入口限制与验收见 [SEO 索引清单](seo-indexing-checklist.md#内部开发入口与关闭的商城)。

## 设计原则

1. **一套壳层、多种专题**：首页/探索/项目/社区/自然/个人等共用布局与组件；自然、社区可有专题色，但不另起一套设计系统。
2. **语义优先于色值**：使用 CSS 变量与命名组件，避免页面内 `#...` 与随意 `max-w-*`。
3. **圆角五档**：`xs` 8px · `sm` 10–12px · `md` 16px · `lg` 20–22px · `pill` 胶囊。
4. **字重克制**：面板与列表用 `font-semibold`；`font-black` 仅用于专题 Hero（`text-display`）。

---

## 布局 Shell

| 等级 | CSS 类 / 组件 | 宽度 | 典型页面 |
|------|----------------|------|----------|
| 宽版浏览与工作区 | `app-shell-wide` / `<AppWideShell>` | 1840px | 首页、探索、课程与结课凭证、项目/作品详情与探索记录、自然首页/图鉴/观察列表/地图/发布页、本人/他人主页与个人内容库/时间线/关注/粉丝/获赞、商店、排行榜、消息中心、3D 课本目录与课时 |
| 标准 | `app-shell-standard` / `page-shell` / `<AppStandardShell>` | 72rem (6xl) | 普通管理端列表、公告与商城管理、课时材料清单 |
| 阅读型 | `app-shell-reading` / `<AppReadingShell>` | 64rem (5xl) | 设置、账号中心、个人订单 |
| 窄阅读 | `app-shell-narrow` | 48rem (3xl) | 法律、帮助、私信会话、公告列表与文章、资源文章、图片来源署名 |

```tsx
import { AppWideShell, AppReadingShell } from "@/components/layout/app-shell"

<AppWideShell className="pb-24 pt-5">
  {/* 页面内容 */}
</AppWideShell>
```

**禁止**：在页面内写 `max-w-[1840px]`、`max-w-5xl` 等，除非有文档记录的例外。

以上数值是包含左右内边距的最大外框宽度，不是固定宽度；所有 shell 都以 `w-full min-w-0` 随视口收缩。宽版页面桌面内边距统一为 32px，其他档位为 24px，手机默认 16px。同一页面只使用一层限宽 shell，不再套一个不同档位的 `max-w-*`；不得通过单页桌面 padding 覆盖公共边线。

消息中心 `/messages` 使用宽版 shell，加载态保持同档宽度；桌面分类导航在 `md` 断点使用三列两行，`lg` 起使用六列一行，手机保留短标签横排。私信会话 `/messages/[userId]` 保留窄阅读宽度。

替换页面列表或内容的加载态、空态和错误态，使用与成功态相同的 shell 档位和左右内边距；列表骨架行也应与正常行对齐，不额外叠加水平 padding。独立的整页错误、404 等集中状态卡是例外：共用 `PageStatus` 的标准外壳，内部卡片可居中限宽至 42rem，保持提示文字易读，不要求铺满原页面。正文面板自身的内边距不替代页面 shell；不要使用没有定义的 `app-shell` CSS 类。

骨架占位统一使用 `components/ui/skeleton.tsx` 的 `bg-muted` 和脉冲动画，圆角与尺寸按对应内容设置；不要在父容器重复添加脉冲动画。基础组件与图片占位遵循减少动态效果偏好。移动页头复用 `MobilePageHeader`，列表间距、卡片高度和断点与成功态对齐，不添加成功态不存在的标题卡或额外留白。

商城 `/store` 及其子路由使用聚焦选购与履约的导航：手机由页面提供返回、标题及商城服务入口，隐藏全站 Logo／通知／头像顶栏与学习区底部 Tab，不预留学习导航的底部空间；顶部安全区由应用壳统一保留，页面不重复叠加。桌面保留品牌、返回主站及账号操作，收起学习主导航；页脚仍只在桌面显示。该规则同样覆盖目录关闭时可访问的订单、优惠券与客服，不改变登录和访问权限；相似前缀如 `/storefront` 不属于商城路径。

个人中心以“继续探索、回看成果”为主线。手机资料卡保留身份、真实简介、四项统计与四个快捷入口，不再叠加徽章条和经验进度。未填写简介不代填个人介绍。正文按继续探索、最近作品、默认收起的成长与荣誉、打卡、购物与服务排列；成长区保留等级、经验、徽章图鉴和按需展开的探索足迹。自然观察进度仅在已有观察记录时出现。资料编辑、内容库、消息、硬币和排行榜入口保留。

桌面在 `xl` 起采用主内容与 360px 辅栏，超宽屏辅栏为 440px；主栏先展示继续探索和近期作品，有观察时再展示近期观察。等级、打卡、通知和服务置于辅栏。排行榜在资料头仅保留文字入口。作品统计与“全部作品”直达 `/profile/library?tab=works`。

探索建议两端默认展示一个优先行动，其他建议按需展开；标题下不展示泛化引导副标题，保留具体任务说明；只保留外层卡片，任务列表不叠加底框或任务边框，展开多项时用细分隔线区分，仅当前行动使用主按钮，手机主按钮跨图标与文字两列、相对卡片居中，桌面保持右侧操作；其他建议采用图标、内容与右侧文字操作的紧凑横列；不将动态建议数量展示为固定计划完成率。手机操作有效高度至少 44px，避免用过小文字压缩任务。探索足迹说明来自参与记录而非能力测评，不在个人页额外随机选取某一维度的突破指南。购物链接与帮助链接以间距和分隔线分组。

个人中心骨架与成功态保持相同布局顺序和断点；手机共用安全区顶距及 430px 内容限宽，不添加独立顶部栏；探索建议占位复用 `WeeklyPlanCardSkeleton`。

小屏保留现有单列/双列断点、全屏媒体和安全区，不因统一桌面外框而提前展开侧栏。3D 课时在手机保留无外侧边距的嵌入区，标题和导航自行留边；图鉴保留手机 20px 的既有内边距。正文行长、表单、图片和游戏棋盘可以在外框内按内容限宽，这些内部约束不属于页面 shell。游乐场棋盘及沉浸工作区保持各自交互尺寸。

游乐场首页复用布局层的宽版 shell，不展示桌面侧栏和重复的可见页面标题。物理实验室与 3D 物理课本属于内容集合，以并排插图卡作为主入口；天平称重、记忆翻牌、函数战争使用同尺寸主题色推荐卡，桌面三列、手机单列，推荐依据目录 `featured` 标记，不代表人气排序。其余玩法使用紧凑横向图文卡，手机单列、`sm` 起双列、`xl` 起三列，不加分组标题或折叠目录。入口与玩法插图引用 `public/assets/playground-art/` 下的本地素材；科学入口和全部玩法使用对应 `*-v2.webp`，统一青蓝、象牙白与琥珀色的立体木质插图。玩法图片明暗主题共用单一透明素材，不切换深色图片。图片容器不添加额外底框；扫雷由插图中的浅色棋盘保证地雷对比，24 点使用同风格的数字牌插图。首页不提供搜索，两个科学入口占满内容宽度，全部现行玩法直接展示。探索记录以分隔行和摘要呈现，展开仅保留三个无卡片统计、可折叠口径说明和徽章链接，不重复铺设主题列表与徽章墙。平板和桌面不再叠加页面水平内边距，左右边线与宽版 shell 对齐；游戏页保留侧栏及原有内容间隔。手机外壳不留边，由首页内容层提供 16px 留边；游戏棋盘仍遵守各自的交互尺寸。

桌面顶栏内容区使用 `app-header-bar`（与宽版 shell 同宽）。全局平台公告横幅使用 `app-shell-wide`，与顶栏边线对齐；公告列表及文章正文仍使用窄阅读档。

内容分级审核页使用 `app-shell-wide`，为队列、内容档案与审核表单提供桌面工作空间。`xl` 起队列与详情并排，队列宽度限制在 19–24rem；`2xl` 起详情内的档案与表单并排，较小屏幕保持上下排列。

首页兴趣入口使用“科学、技术、工程、艺术、数学、游乐场”作为展示名称，保留原学科分类参数、图标和已有的宽屏简介，不展示项目或玩法数量。桌面主视觉使用原始照片在右侧裁切，限制画面宽度并渐隐到卡片底色；不要将低高度横幅放大撑满宽屏。图片 `sizes` 随实际展示宽度变化，手机继续使用同一图片的底部局部构图。

首页主视觉的“搭积木、做实验、学编程、观察自然”在手机和桌面共用文本链接与目的地，悬停显示下划线。桌面常规主视觉高度保持原有断点；仅在视口宽 1024–1535px 且高不超过 850px 时压缩至 300px。桌面作品与自然观察双栏中，右栏宽度为 320–400px，观察卡片保持 112px 高度与近方形缩略图，文字紧凑排列，右栏按内容自然结束，不拉伸卡片或强制与作品区底部对齐。首页最多读取 5 条真实观察；宽度小于 1024px 展示 3 条，1024–1535px 展示 4 条，1536px 起展示 5 条，数量不足时按实际展示；手机保持原有布局。登录浮条保持现有强调方式。

### 作品详情

作品详情以展示成果与交流为主，搭建教学由来源课程或项目承载。桌面页头紧凑排列作品名与完成状态，来源入口集中在作者信息区，不重复展示“作品详情”“作品主图”“作者与支持”等结构标签。桌面保留宽版外壳，1024px 起按约 62% / 38% 分为两栏：左侧作品媒体、创作记录与下方留言，右侧作者、互动与来源；两栏随页面自然滚动，不固定侧栏或单独滚动留言，右侧允许自然留白。作品图片按可用视口限高；手机单张作品使用竖向画框并完整展示图片，探索过程中的照片布局保持独立。

来源卡左侧展示缩略图和来源标题，右侧将“做同款”与右箭头并排组成品牌蓝操作提示，整卡可点击，完整跳转说明由无障碍名称提供。评论操作行保留点击热区，避免再叠加较大的上下留白。作者资料与互动分行，点赞、投币和留言入口保留文字，留言入口跳到同页交流区并避开固定页头。作品交流的回复、取消回复、举报、展开回复与发表按钮点击高度至少为 44px，保持轻量视觉，不通过增大文字替代触控空间。

### 页脚

`components/layout/site-footer.tsx` 的桌面导航保留“关于我们、联系我们、新手开始、常见问题、用户协议、隐私政策”，按“关于我们、帮助中心、规则与隐私”分组。联系我们落到关于页的联系区，该区保留反馈按钮；不重复列出“提交反馈”或指向隐私政策的“安全与隐私”。安全说明仍由隐私政策、用户协议与常见问题承载。

页脚整块仅在 `md` 及以上宽度展示，包括品牌、导航、版权、ICP备案与公安备案；手机端隐藏。关于页及设置中的联系和规则入口保留，应用壳仍预留底部导航安全空间。

### 安装应用与全屏

`app/manifest.ts` 请求 `display: fullscreen`，保持原有应用 `id`、作用域和启动地址。不支持该显示模式的浏览器按标准回退到 standalone 等模式；已有安装的 manifest 更新时机由浏览器决定。fullscreen 是启动显示偏好，不保证每款 Android、手势导航或 iOS 都隐藏系统栏，也不等同于元素 Fullscreen API。安装提示同时识别 fullscreen、standalone 和 iOS 的 `navigator.standalone`，进入全屏时撤下已显示的安装提示。

保留 `viewport-fit=cover` 和实际交互控件的 safe-area 保护，不为隐藏系统栏全局删除安全区。3D 沉浸布局以 `dvh` 跟随可用视口；普通应用壳与系统栏分别验收。Android 已安装 PWA 的新装/更新、横竖屏、状态栏与手势区域仍须真机核对。

---

## 颜色 Token（`app/globals.css` :root）

### 品牌与表面

| Token | 用途 |
|-------|------|
| `--brand-blue` / `--brand-green` / `--brand-amber` | 主品牌、成功 CTA、强调 |
| `--surface-raised` / `--surface-muted` / `--surface-border` | 卡片与面板 |
| `--app-canvas` | 页面背景渐变起点 |

### 导航

| Token | 用途 |
|-------|------|
| `--nav-active` / `--nav-hover` | 主导航激活与悬停 |
| `--nav-logo` | Logo 字标 |
| `--nav-bar-bg` / `--nav-bar-border` | 顶栏、底栏 |

组件类：`.nav-link`、`.nav-link-active`、`.nav-logo-text`、`.bottom-nav-bar`、`.app-desktop-header`。

### 自然专题

| Token | 用途 |
|-------|------|
| `--nature-canvas` | 自然模块页面背景 |
| `--nature-accent` | 主按钮、强调 |
| `--nature-foreground` / `--nature-muted` | 正文与辅助 |

页面根节点可加 `theme-nature-page`。

### 语义状态

| Token | 组件 |
|-------|------|
| `--status-success` / `-surface` / `-border` | 通过、完成、自然类成功 |
| `--status-warning` | 待审核、提醒 |
| `--status-danger` | 拒绝、错误 |
| `--status-info` | 信息提示 |

```tsx
import { StatusBadge, StatusAlert } from "@/components/ui/status-badge"

<StatusBadge status="success">已通过</StatusBadge>
<StatusAlert status="warning">等待审核</StatusAlert>
```

---

## 表面层级（Surface）

| Variant | CSS | 用途 |
|---------|-----|------|
| `panel` | `surface-panel` | 主内容区、大面板 |
| `card` | `surface-card` | 列表卡、区块 |
| `subtle` | `surface-subtle` | 设置项、说明块 |

```tsx
import { Surface } from "@/components/ui/surface"

<Surface variant="card" interactive className="p-5">...</Surface>
```

**禁止**：`Card` 上再叠 `surface-*` 类，或手写一整套 `rounded-* border bg-white shadow-*`。

---

## 按钮（Button）

| Prop | 值 | 说明 |
|------|-----|------|
| `variant` | `default` `outline` `ghost` `destructive` … | 与 shadcn 一致 |
| `tone` | `brand` `success` `warning` `danger` | 语义色（覆盖默认背景） |
| `shape` | `default` `soft` `pill` `square` | 圆角档位 |

```tsx
<Button tone="brand">普通品牌操作</Button>
<Button tone="success" className="h-12 flex-1">开始项目</Button>
<Button variant="outline" shape="soft">普通操作</Button>
<Button tone="success" shape="pill">批准通过</Button>
<Button tone="danger" shape="pill">拒绝</Button>
```

按钮默认圆角为 `--radius-sm`（10px），用于工具栏、表单输入框与次级操作按钮。页面首屏大号主 CTA、引导性主要行动入口（如「开始探索项目」「挑一节积木课」「立即进入」「查看榜单」）、审核操作与底栏固定按钮统一使用 `shape="pill"`（全圆角胶囊），与大面积内容容器卡片（统一为 `--radius-md` / 16px）形成清晰的“容器骨架 vs 触发按键”层级；紧凑图标按钮可用 `shape="square"`。不要写 `bg-green-600`、`rounded-[12px]`。
链接型按钮优先使用 `<Button asChild>`；如果整张卡片已经是 `Link`，内部右侧的按钮视觉必须复用 `buttonVariants({ tone, shape })`，不要手写 `rounded-*`、`bg-*` 形成局部圆角漂移。

积木课程工作区是明确的场景例外：课程内容与作品视图的顶栏整组复用 `components/features/courses/lesson-control-styles.ts`，文字按钮使用 40px 高的胶囊，纯图标按钮使用 40px 圆形；课程切换、作品、回到课程、目录、零件、语音和全屏保持同一套尺寸与圆角。选中状态通过底色和文字颜色表达，不单独改变形状。不能为满足点击热区而直接放大可见按钮；如需扩大热区，应单独处理透明点击范围。这一规则不扩展到作品区上传按钮或全站普通表单按钮。
纯展示性的特性要点（Feature Items）禁止使用实体药丸背景，保持通透自然的图标+文本排版，避免被误判为可点击按钮。

商城与官方客服沿用这套规范：购买、确认订单、发送留言等主要操作使用品牌色胶囊按钮，返回、查看订单和咨询入口通过 `Button asChild` 表达层级；文件选择由中文按钮触发原生文件输入，不展示浏览器默认文件按钮作为另一套视觉样式。

---

## 排版角色

| 类名 | 用途 |
|------|------|
| `text-display` | 专题 Hero 大标题（慎用） |
| `text-page-title` | 页面 H1 |
| `text-panel-title` | 面板 / 卡片标题 |
| `text-metric` | 统计数字 |
| `text-label` | 辅助标签 |
| `section-kicker` | 分区英文/小标签 |

标题与正文使用项目全局字体变量；等宽字体为 JetBrains Mono，用于游乐场分数、管理端 ID 等场景。当前 `lib/fonts.ts` 仅通过 `next/font/google` 加载 JetBrains Mono；新增字体前需先在实现中落地并同步本节。

---

## 控件

- **分段**：`segmented-control` + `segmented-option` / `segmented-option-active`（激活态为 **品牌蓝** `--brand-blue`，不要用 `bg-foreground` 黑底）
- **筛选**：`<FilterChip>`（`tone="green" | "amber"`）
- **表单**：`control-field`
- **移动端子导航**：`mobile-subnav`（与 `MobilePageHeader` / `MobileGlobalHeader` 配合）

新增路由若自管移动 Header，需加入 `conditional-app-shell.tsx` 的 `pageOwnedMobileHeaderRoots` 并注明原因。第一课 `/textbook/p1a-1-1` 使用精确路径判断：手机和低矮横屏由阅读器与目录返回共用一行导航，收起站点页头、页脚及底栏；其他课本路由不受影响，离开即恢复。

---

## 弹窗（Dialog）

`DialogContent` 支持 `size` 与 `chrome`：

| size | 说明 |
|------|------|
| `sm` | 默认表单（`max-w-lg`） |
| `md` | `max-w-2xl` |
| `lg` | 审核/管理（`max-w-3xl max-h-[85vh]`） |
| `xl` | 大面板 |
| `fullscreenMobile` | 移动端全屏、桌面居中 |

| chrome | 说明 |
|--------|------|
| `standard` | 默认边框 |
| `review` | 管理端审核弹窗（浅底 + 强阴影） |
| `media` | 媒体预览（无默认 padding） |

```tsx
<DialogContent size="lg" chrome="review" className="p-0">
  ...
</DialogContent>
```

## 专题工具类

| 类名 | 模块 |
|------|------|
| `community-hero-title` / `community-hero-lead` / `community-tab` / `community-challenge-card` | 社区 |
| `nature-section-card` / `nature-hero-panel` / `nature-icon-accent` / `nature-link` / `nature-stat-icon` | 自然 |
| `admin-panel-card` | 管理端面板 |
| `admin-section` | 管理端表单分区（含 padding） |
| `nature-topic-card` / `nature-observation-card` | 自然首页横向卡片 |
| `nature-chip` / `nature-interaction-pill` | 自然观察元信息 |
| `theme-nature-trees` | 树木子专题背景 |
| `rounded-panel` / `rounded-[var(--radius-lg)]` | 大面板圆角（替代 `24px`） |
| `nature-hero-glass` / `nature-data-card` / `nature-contribution-card` | 自然侧栏玻璃/数据/贡献卡 |
| `nature-empty-state` / `nature-action-link` / `nature-list-row` | 自然空状态、操作按钮、列表行 |
| `app-empty-state` | 通用空状态（探索记录流等） |
| `exploration-cta-banner` / `exploration-cta-icon` | 探索记录页「开始探索」横幅 |
| `app-canvas-community` | 社区页背景渐变 |
| `community-nature-cta` | 挑战页「补充观察记录」链接 |
| `community-related-project-link` | 挑战详情相关项目卡片 |
| `profile-action-cta` | 个人页移动端卡片内次级行动按钮（今日任务、空状态、新手引导必须统一使用；不要做成实心主按钮） |
| `profile-soft-cta` / `profile-success-cta` / `profile-stats-bar` | 个人页桌面次要 CTA 与统计条 |
| `skip-link` | 键盘用户「跳到主内容」 |

---

探索页使用完整宽版列表，不设桌面标签侧栏；不设独立标签选择入口。分类与三个快捷主题在浏览、搜索和筛选状态中持续可见；主题行右侧使用“推荐／最新”文字及下箭头作为轻量排序入口，展开选择热门推荐／最新发布，不显示额外“主题／排序”标签。两端均同排，窄屏主题局部横滑；材料主题隐藏排序入口，不显示“材料优先”。筛选面板仅展示子分类、难度及年龄，手机面板按内容占高、最高 85dvh，桌面保留右侧满高；探索 URL 只接受三个快捷主题，其他标签忽略且不展示条件。手机项目使用连续双列网格，按当前列表顺序排列，不再按学科分段；普通与材料探索卡片共用图片、标题、正文分类、年龄及成人陪同提示，年龄与陪同同行展示，空间不足时自然换行。材料卡片在适龄信息后额外展示材料数量或匹配摘要，不在图片上叠加分类，也不为普通卡片预留材料空行。分类插画宽度随容器在 52–64px 之间变化，保留横滑和右侧渐隐提示。加载态沿用相同宽版网格及分类尺寸。筛选弹层使用可见标题“筛选项目”，年龄字段显示“孩子年龄”，下方就近说明仅优先排序、不排除其他项目。手机搜索入口、筛选入口和主题按钮的点击高度至少 44px。探索主题胶囊的可见高度为 32px、字号 14px；已选条件的可见最小高度为 28px、字号 12px，使用淡底无描边；两者均由外层透明按钮保留至少 44px 点击高度，不以放大胶囊代替触控空间。材料选择标题行与常见材料行紧邻排列，不额外叠加段间距。手机全屏搜索使用 Dialog 焦点管理：打开时聚焦输入框，Tab 留在弹层中，关闭后恢复到搜索入口。

探索页响应式变更需覆盖以下 CSS 视口，浏览器回归入口为 `e2e/explore-responsive.spec.ts`：

| 场景 | 代表尺寸（宽 × 高） | 检查重点 |
|------|-------------------|----------|
| 手机窄屏与常用屏 | 320×740、375×812、390×844、430×932 | 搜索与筛选常驻且点击区至少 44px；主题横滑；连续列表保持双列，无页面横向溢出 |
| 平板竖屏 | 768×1024、820×1180 | 切换至桌面工具栏，内容收缩不被导航挤压 |
| 平板横屏 | 1024×768、1180×820 | 搜索、筛选与卡片按容器宽度排列；筛选内容可滚动，底部取消与确认始终可达 |
| PC | 1280×800、1440×900、1920×1080 | 主列表使用完整宽度；网格按容器宽度显示列数，1280px、1440px、1920px 均为四列 |

跨断点调整窗口时，已打开的搜索弹层继续可见、可退出，不留下锁住页面的空遮罩；筛选弹层取消后恢复入口焦点。各档检查浅色，手机和平板额外抽查深色；浏览器视口模拟不能替代真机软键盘、系统栏及安全区验收。


## 专题页约定

- **自然**：`theme-nature-page` + `--nature-*`；Hero 可保留大图与强对比，但 shell、卡片、主按钮接回全局。
- **社区**：Hero 可用 `text-display`；CTA 使用 `--status-success` 或 `tone="success"`。
- **游乐场**：可更强玩法视觉，但仍复用 shell、Button、Surface。

---

## 新增 UI 检查清单

- [ ] 容器是否使用 `app-shell-*` / `App*Shell`？
- [ ] 主按钮是否 `Button` + `tone` / `shape`？
- [ ] 颜色是否来自 token（无裸 `#`）？
- [ ] 卡片是否仅通过 `Surface` 或 `surface-*` 一类入口？
- [ ] 圆角是否在 8 / 12 / 16 / 20 / pill 附近？
- [ ] 移动 Header 是否走统一机制？
- [ ] 状态是否 `StatusBadge` / status token？

---

## 相关文件

| 路径 | 说明 |
|------|------|
| `app/globals.css` | Token 与 `@layer components` 工具类 |
| `components/layout/app-shell.tsx` | Shell 组件 |
| `components/ui/button.tsx` | 按钮 variant |
| `components/ui/surface.tsx` | 表面组件 |
| `components/ui/status-badge.tsx` | 状态徽章/提示 |
| `components/features/design-system-content.tsx` | `/design-system` 展示 |
| `docs/next-step.md` | 当前待推进事项与维护顺序 |
