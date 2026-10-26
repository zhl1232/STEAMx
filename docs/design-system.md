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
| 宽版仪表盘 | `app-shell-wide` / `<AppWideShell>` | 1840px | 首页、探索、项目详情、社区、自然、个人、商店、排行榜 |
| 标准 | `app-shell-standard` / `page-shell` / `<AppStandardShell>` | 72rem (6xl) | 管理端列表、次级列表 |
| 阅读型 | `app-shell-reading` / `<AppReadingShell>` | 64rem (5xl) | 设置、账号中心 |
| 窄阅读 | `app-shell-narrow` | 48rem (3xl) | 法律、帮助、消息 |

```tsx
import { AppWideShell, AppReadingShell } from "@/components/layout/app-shell"

<AppWideShell className="pb-24 pt-5">
  {/* 页面内容 */}
</AppWideShell>
```

**禁止**：在页面内写 `max-w-[1840px]`、`max-w-5xl` 等，除非有文档记录的例外。

桌面顶栏内容区使用 `app-header-bar`（与宽版 shell 同宽）。

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

新增路由若自管移动 Header，需加入 `conditional-app-shell.tsx` 的 `pageOwnedMobileHeaderRoots` 并注明原因。

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
