# UI 统一化续做计划（RFC + 任务清单）

## 1. 文档目的

这份文档用于承接 `docs/UI_GUIDELINES.md`，把“方向”转成“可执行任务”。

适用场景：

- 新开对话继续做 UI 收口
- 规划接下来 2 到 5 次提交的改造范围
- 做 PR 前确认哪些页面和组件应该优先统一

这不是重新设计产品，而是在**不推翻现有方向**的前提下，把全站逐步拉回同一套 UI 系统。

---

## 2. 背景

本轮已完成的基础工作：

- 建立全局字体基线：`Noto Sans SC` + `Noto Serif SC`
- 建立全局表面层级与基础样式工具类
- 统一桌面主导航、搜索框、底部导航的基础视觉
- 统一移动端页头组件能力
- 重构 `ProjectCard`
- 重构 `Community` 首页的桌面/移动端壳层
- 重构 `Settings` 首页
- 把 `Design System` 页面改成真实产品基线页
- 清理 `app/project/[id]` 中最明显的中英混杂文案

当前仍存在的问题：

- 若干旧页面仍保留旧的渐变、阴影、容器、sticky 结构
- 卡片体系还没完全统一，尤其是 `ChallengeCard`、讨论卡片、个人页卡片
- 设置子页面、消息页、个人页仍然有各自独立的局部视觉语言
- 一些页面仍有“产品像拼起来的”观感
- 还需要一次认证后页面的实机视觉核查

---

## 3. 非目标

本阶段不做以下事情：

- 不重做品牌或 Logo
- 不整体换主题色系统
- 不重写数据流或业务逻辑，只为 UI 大面积改接口
- 不把每个页面都改成高表现力 landing page
- 不引入新的大型 UI 库

---

## 4. 总体策略

执行顺序遵循下面的原则：

1. 先改影响面最大的共享层
2. 再改高频页面
3. 再改高重复组件
4. 最后做清扫和一致性补丁

判断是否该继续抽象的标准：

- 同一视觉模式在 2 个以上页面重复出现
- 同类页面产生了 2 套以上不同写法
- 修改一个页面时明显需要同步修另外 2 到 3 个地方

---

## 5. 执行阶段

## 阶段 A：共享组件继续收口

目标：先把“会扩散到全站”的组件做稳，减少后续页面返工。

### A.1 导航与页头

- [x] 审查 `components/conditional-app-shell.tsx`（本轮确认消息、设置、个人页、自然观察和 legal 移动端均由 shell 控制全局 header/bottom nav 显隐）
- [x] 审查 `components/ui/mobile-page-header.tsx`（本轮继续复用该组件，未新增 route-specific header）
- [x] 审查是否还有页面在自定义额外 sticky bar（本轮移除自然观察物种/详情页外包 sticky 头，保留必要 segmented subnav）
- [x] 把页面级 tab/header 的结构收敛到统一写法（本轮收敛 messages/profile/nature 深层页头与 segmented 写法）

重点：

- 避免一个页面出现 3 层 sticky
- 避免顶部区域高度和内边距每页都不一样
- 确保移动端回退、标题、右侧操作区布局一致

验收标准：

- 首页、社区、设置、项目详情在移动端顶部结构规则一致
- 不再新增 route-specific header hack

### A.2 卡片体系

- [x] 移除旧版社区 `ChallengeCard`，挑战列表已收敛到 `app/community/page.tsx` 内的新紧凑卡片
- [x] 审查 `components/features/community/discussion-list.tsx` 内部 discussion card（本轮改为 surface-card + filter-chip/token 色，统一空态/加载/错误块）
- [x] 审查 `components/profile/*` 中个人页卡片（本轮统一 mobile profile list、header surface 与空态）
- [x] 审查 `components/features/project-showcase.tsx` 的展示卡片（本轮统一作品墙卡片、空态和弹窗信息块，移除心得区旧 accent stripe）

重点：

- 同类卡片统一圆角、边框、阴影、信息层级
- 卡片优先显示内容差异，不优先显示装饰和统计
- hover 不应成为理解内容的前提

验收标准：

- 项目卡、挑战卡、讨论卡至少在表面层级上可视为同一系统
- 卡片内容阅读顺序稳定

### A.3 空状态 / 错误态 / 骨架屏

- [x] 盘点 `loading.tsx`、空状态、错误提示组件（本轮更新共享 skeleton、discussion/messages/profile 的状态块；Explore 状态保持现有新体系）
- [ ] 为 Explore / Community / Settings / Messages 统一空态结构
- [ ] 清理语气不一致或视觉差异过大的状态块

重点：

- 状态页要像产品内容的一部分，不像临时提示
- 文案语气保持统一

---

## 阶段 B：高频页面继续统一

目标：把用户最常见的入口页收成同一产品。

### B.1 Profile

范围建议：

- `app/profile/page.tsx`
- `components/profile/mobile-profile-page.tsx`
- `components/profile/profile-header.tsx`
- `components/profile/project-list.tsx`

任务：

- [x] 统一个人页桌面/移动端页头逻辑（本轮压回 page-shell/surface 节奏，移动端底部 safe-area 同步）
- [x] 收敛 header 的渐变、徽章、头像区层级（本轮弱化独立渐变与硬编码文本色，保留现有头像/等级资产）
- [x] 统一列表卡片与模块块级表面（本轮 ProjectList、MiniProjectCard、ObservationList、EmptyBlock 统一 surface 写法）
- [x] 统一统计区和操作区视觉语言（本轮统计文字、行动入口和成长任务块回到 token/surface 层级）

验收标准：

- `Profile` 看起来像 `Project` 和 `Settings` 的同一套系统
- 个人页不再单独使用另一种炫技风格

### B.2 Messages

范围建议：

- `app/messages/page.tsx`
- `app/messages/[userId]/page.tsx`
- `app/messages/layout.tsx`

任务：

- [x] 统一消息列表与会话详情的容器系统（本轮通知行、私信行、会话详情面板统一 surface-card/panel）
- [x] 统一输入框、会话项、状态提示、顶部标题栏（本轮统一消息空态、错误态、输入框文案和气泡表面）
- [x] 移动端确认不会与全局 header / bottom nav 打架（本轮补充 messages 列表/详情 safe-area 与最小高度）

重点：

- 消息页允许更工具化，但不能像另一套应用
- 列表行与聊天气泡不需要和首页一样花，但要共享表面和字体系统

### B.3 Settings 子页面

范围建议：

- `app/settings/about/page.tsx`
- `app/settings/appearance/page.tsx`
- `app/settings/notifications/page.tsx`
- `app/settings/privacy/page.tsx`
- `app/settings/profile/page.tsx`
- `app/settings/security/page.tsx`

任务：

- [x] 统一子页面标题区（本轮 SettingsSubpageShell 增加移动说明块，并为各子页补齐 kicker/description）
- [x] 统一表单区与说明区表面（本轮 profile/security/privacy/appearance/notifications/about 继续沿用 surface-panel/subtle）
- [x] 统一开关、列表项、危险操作区层级（本轮通知设置改为 switch 语义控件，设置首页补齐账号操作说明）

验收标准：

- Settings 首页与各子页视觉连续
- 子页不再出现明显旧样式残留

---

## 阶段 C：次高频页面和专项清扫

目标：减少“剩余旧样式岛屿”。

### C.1 Legal / About / Simple Content Pages

- [x] 审查 `app/legal/privacy/page.tsx`（本轮移除旧渐变标题块，保留统一文本容器）
- [x] 审查 `app/legal/terms/page.tsx`（本轮移除旧渐变标题块，保留统一文本容器）
- [x] 审查 `app/settings/about/page.tsx`（本轮补齐 Settings 子页标题区与说明节奏）

重点：

- 文本型页面也要使用统一页头、容器、段落节奏
- 不要保留旧的单独 sticky 头风格

### C.2 Explore 深层页

- [x] 审查 `app/explore/species/*`（本轮确认该路径已重定向到 `/nature/species/*`，并收口目标页容器/页头）
- [x] 审查 `app/explore/observations/*`（本轮确认该路径已重定向到 `/nature/observations/*`，并收口目标页容器/页头）
- [x] 审查自然观察相关详情页（本轮统一观察详情主 surface、移动页头和附属图片区/地图区表面）

重点：

- 和主 Explore 页保持同一家族感
- 用相同容器、标签、操作按钮写法

### C.3 Bird Observation 专题链路

- [x] 审查 `app/bird-observation/page.tsx`（旧路由已并入 `/nature` 与 `/nature/birds`，不再单独保留 bird-observation 页面）
- [x] 审查提交页相关 section components（当前提交链路由 `/nature/submit` + `ObservationSubmitForm` 承接）
- [x] 审查观察记录详情页（当前观察详情链路由 `/nature/observations/[id]` 承接）

重点：

- 专题可以有少量识别度，但不能脱离全站
- 表单、模块、说明卡片仍应沿用全局表面系统

### C.4 Admin / 审核员链路

- [x] 对照高保真稿 `mobile/32-admin-console.png` 收口 `app/admin/page.tsx`：补齐管理员身份区、统计卡、搜索筛选和列表内审核操作
- [x] 对照高保真稿 `mobile/33-reviewer-application.png` 收口 `app/moderator/apply/page.tsx` 与 `components/features/moderator/application-form.tsx`：补齐职责说明、资格检查、擅长领域、投入时间和保密提示
- [x] 对照高保真稿 `mobile/34-reviewer-application-management.png` 收口 `app/admin/moderator-applications/page.tsx` 与 `components/admin/moderator-applications-list.tsx`：补齐状态统计、状态筛选、搜索排序和已处理记录展示

---

## 阶段 D：文案与命名一致性清扫

目标：把“半成品感”继续压低。

### D.1 UI 文案

- [x] 全站搜索 `Overview`（本轮命中为文档/注释，不在目标 UI 可见文案中）
- [x] 全站搜索 `Process`（本轮未发现目标 UI 可见残留）
- [x] 全站搜索 `More`（本轮命中为代码变量/图标命名，不在目标 UI 可见文案中）
- [x] 全站搜索 `Step `（本轮命中为归档文档、代码注释或内部变量，不在目标 UI 可见文案中）
- [x] 全站搜索 `Project Detail`（本轮命中为 UI 指南示例，不在产品页面中）

要求：

- 简中产品界面默认全部改成中文
- 保留真正必要的英文专有名词

### D.2 Metadata / SEO / 标题

- [x] 搜索 `Steam Explore & Share`（本轮未发现目标 UI metadata 残留）
- [ ] 搜索仍未统一到 `STEAM 探索` 的 metadata
- [ ] 检查各页面标题模板是否一致

---

## 阶段 E：认证后页面视觉核查

目标：确认只在登录后出现的页面没有脱轨。

使用账号：

- 邮箱：`66020423@qq.com`
- 密码：`123456`

建议核查路径：

- [x] `/settings`（生产构建，移动/桌面、浅色/深色通过基础视觉核查）
- [x] `/settings/profile`（生产构建，移动/桌面、浅色/深色通过基础视觉核查）
- [x] `/settings/security`（生产构建，移动/桌面、浅色/深色通过基础视觉核查）
- [x] `/messages`（生产构建，移动/桌面、浅色/深色通过基础视觉核查）
- [ ] `/messages/[userId]`（本轮账号下未发现可用私信会话链接，未覆盖详情页实机核查）
- [x] `/profile`（生产构建，移动/桌面、浅色/深色通过基础视觉核查）
- [ ] `/shop`（桌面浅/深色通过；移动端仍停在账号加载态，待单独排查）
- [ ] `/coins`（桌面深色通过；移动端截图仍为加载 spinner，待单独排查）

核查项目：

- [x] 顶部结构是否一致（已渲染页面未发现全局 header / bottom nav 冲突）
- [ ] 是否有局部旧样式残留（`/shop`、`/coins` 移动端内容未进入，仍需补核查）
- [ ] 列表、按钮、表单、提示块是否仍像同一产品（已渲染页面通过，`/messages/[userId]` 与移动端 shop/coins 待补）
- [ ] 暗色主题下层级是否仍清楚（已渲染页面通过，待补未覆盖路径）

---

## 6. 每次提交建议粒度

建议不要把整轮 UI 统一化塞进一个超大提交。

推荐切分：

### 提交 1

- 共享卡片体系
- `ChallengeCard`
- discussion card
- 空状态/错误态

### 提交 2

- `Profile`
- `Messages`

### 提交 3

- `Settings` 子页面
- legal/about 文本页

### 提交 4

- Explore 深层页
- Bird Observation 专题页
- 文案一致性清扫

---

## 7. 验收标准

整个续做阶段完成后，应满足：

- 首页、探索、项目、社区、设置、个人页、消息页看起来是同一产品
- 移动端顶部结构规则统一
- 卡片系统明显收敛，不再各自为战
- 简中界面默认不再混入明显英文 section label
- 设计系统页展示的是“产品真实模式”，不是概念 demo
- `pnpm lint` 和 `pnpm build` 持续通过

---

## 8. 风险与注意事项

- 不要为追求统一而破坏已有较成熟页面的结构，尤其是 `app/project/[id]/page.tsx`
- 不要一边改页面一边重新定义主题基线，否则会反复返工
- 项目当前 worktree 可能已有其他未提交修改，避免误回滚
- 对认证页和消息页的视觉改造要特别注意移动端 sticky 与 safe area

---

## 9. 给下一次对话的直接提示词

建议在新对话里使用下面这段：

> 继续做 UI 统一化收口。先读 `docs/UI_GUIDELINES.md` 和 `docs/UI_CONTINUATION_PLAN.md`。不要重新设计方向，按计划从最高影响面的共享组件和高频页面开始推进。优先保证导航、页头、卡片和页面容器一致性，避免新增 one-off 样式。

---

## 10. 快速任务清单

如果只想给下一次对话一个最短执行入口，用这个：

- [x] 对齐 `ChallengeCard` 到新卡片体系（旧组件已移除，本轮确认挑战列表继续使用社区页内新紧凑卡片）
- [x] 重构 discussion card（本轮完成 discussion-list 卡片、筛选、状态块统一）
- [x] 统一 `Profile` 页头和模块表面（本轮完成 profile 主页与 profile 组件卡片收口）
- [x] 统一 `Messages` 列表/详情页容器与顶部结构（本轮完成 messages 列表和会话页 surface/safe-area 收口）
- [x] 统一 `Settings` 子页面（本轮完成 SettingsSubpageShell 与主要子路由标题/表面/开关层级）
- [x] 清扫全站中英文混杂 section label（本轮完成计划内关键字搜索，未发现目标 UI 可见残留）
- [x] 补齐 Admin / 审核员申请 / 审核员申请管理高保真稿对应页面（本轮完成 PC/移动端、浅色/暗色的 token 化实现）
- [ ] 登录后人工核查核心页面（本轮已部分完成；`/messages/[userId]`、移动端 `/shop`、移动端 `/coins` 待补）
