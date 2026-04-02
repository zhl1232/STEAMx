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

- [ ] 审查 `components/conditional-app-shell.tsx`
- [ ] 审查 `components/ui/mobile-page-header.tsx`
- [ ] 审查是否还有页面在自定义额外 sticky bar
- [ ] 把页面级 tab/header 的结构收敛到统一写法

重点：

- 避免一个页面出现 3 层 sticky
- 避免顶部区域高度和内边距每页都不一样
- 确保移动端回退、标题、右侧操作区布局一致

验收标准：

- 首页、社区、设置、项目详情在移动端顶部结构规则一致
- 不再新增 route-specific header hack

### A.2 卡片体系

- [ ] 重构 `components/features/community/challenge-card.tsx`
- [ ] 审查 `components/features/community/discussion-list.tsx` 内部 discussion card
- [ ] 审查 `components/profile/*` 中个人页卡片
- [ ] 审查 `components/features/project-showcase.tsx` 的展示卡片

重点：

- 同类卡片统一圆角、边框、阴影、信息层级
- 卡片优先显示内容差异，不优先显示装饰和统计
- hover 不应成为理解内容的前提

验收标准：

- 项目卡、挑战卡、讨论卡至少在表面层级上可视为同一系统
- 卡片内容阅读顺序稳定

### A.3 空状态 / 错误态 / 骨架屏

- [ ] 盘点 `loading.tsx`、空状态、错误提示组件
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

- [ ] 统一个人页桌面/移动端页头逻辑
- [ ] 收敛 header 的渐变、徽章、头像区层级
- [ ] 统一列表卡片与模块块级表面
- [ ] 统一统计区和操作区视觉语言

验收标准：

- `Profile` 看起来像 `Project` 和 `Settings` 的同一套系统
- 个人页不再单独使用另一种炫技风格

### B.2 Messages

范围建议：

- `app/messages/page.tsx`
- `app/messages/[userId]/page.tsx`
- `app/messages/layout.tsx`

任务：

- [ ] 统一消息列表与会话详情的容器系统
- [ ] 统一输入框、会话项、状态提示、顶部标题栏
- [ ] 移动端确认不会与全局 header / bottom nav 打架

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

- [ ] 统一子页面标题区
- [ ] 统一表单区与说明区表面
- [ ] 统一开关、列表项、危险操作区层级

验收标准：

- Settings 首页与各子页视觉连续
- 子页不再出现明显旧样式残留

---

## 阶段 C：次高频页面和专项清扫

目标：减少“剩余旧样式岛屿”。

### C.1 Legal / About / Simple Content Pages

- [ ] 审查 `app/legal/privacy/page.tsx`
- [ ] 审查 `app/legal/terms/page.tsx`
- [ ] 审查 `app/settings/about/page.tsx`

重点：

- 文本型页面也要使用统一页头、容器、段落节奏
- 不要保留旧的单独 sticky 头风格

### C.2 Explore 深层页

- [ ] 审查 `app/explore/species/*`
- [ ] 审查 `app/explore/observations/*`
- [ ] 审查自然观察相关详情页

重点：

- 和主 Explore 页保持同一家族感
- 用相同容器、标签、操作按钮写法

### C.3 Bird Observation 专题链路

- [ ] 审查 `app/bird-observation/page.tsx`
- [ ] 审查提交页相关 section components
- [ ] 审查观察记录详情页

重点：

- 专题可以有少量识别度，但不能脱离全站
- 表单、模块、说明卡片仍应沿用全局表面系统

---

## 阶段 D：文案与命名一致性清扫

目标：把“半成品感”继续压低。

### D.1 UI 文案

- [ ] 全站搜索 `Overview`
- [ ] 全站搜索 `Process`
- [ ] 全站搜索 `More`
- [ ] 全站搜索 `Step `
- [ ] 全站搜索 `Project Detail`

要求：

- 简中产品界面默认全部改成中文
- 保留真正必要的英文专有名词

### D.2 Metadata / SEO / 标题

- [ ] 搜索 `Steam Explore & Share`
- [ ] 搜索仍未统一到 `STEAM 探索` 的 metadata
- [ ] 检查各页面标题模板是否一致

---

## 阶段 E：认证后页面视觉核查

目标：确认只在登录后出现的页面没有脱轨。

使用账号：

- 邮箱：`66020423@qq.com`
- 密码：`123456`

建议核查路径：

- [ ] `/settings`
- [ ] `/settings/profile`
- [ ] `/settings/security`
- [ ] `/messages`
- [ ] `/messages/[userId]`
- [ ] `/profile`
- [ ] `/shop`
- [ ] `/coins`

核查项目：

- [ ] 顶部结构是否一致
- [ ] 是否有局部旧样式残留
- [ ] 列表、按钮、表单、提示块是否仍像同一产品
- [ ] 暗色主题下层级是否仍清楚

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

- [ ] 对齐 `ChallengeCard` 到新卡片体系
- [ ] 重构 discussion card
- [ ] 统一 `Profile` 页头和模块表面
- [ ] 统一 `Messages` 列表/详情页容器与顶部结构
- [ ] 统一 `Settings` 子页面
- [ ] 清扫全站中英文混杂 section label
- [ ] 登录后人工核查核心页面
