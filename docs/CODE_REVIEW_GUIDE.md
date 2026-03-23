# 全站代码 Review 指南（任务清单）

按 **章节顺序** 执行；每一项审完后把 `- [ ]` 改成 `- [x]`（或直接在编辑器里勾选任务框）。

**建议优先级**：阶段 0→1→2 → 页面（认证/钱相关先）→ API 对照 → 横切收尾。

---

## 使用说明

- [x] 已阅读本节：未通过项请记 issue（附文件/行号），勿只改勾选不记问题
- [x] 页面与 API 尽量 **同域对照** 审，避免漏服务端校验
- [x] 需要更细粒度时，可在任意任务下自行追加子项 `- [ ] 子检查点…`

---

## 阶段 0：环境与基线（约 30 分钟）

- [x] **0.1** 运行 `pnpm lint`、`pnpm test`、`pnpm build`（或 CI 等价）— 无失败；若有 flaky 已记录
- [x] **0.2** 浏览 `eslint.config.mjs`、`vitest.config.ts`、`playwright.config.ts`、`playwright.integration.config.ts`、`.github/workflows/ci.yml` — 与当前栈一致
- [x] **0.3** 敏感配置：`env` 示例与文档仅占位符，仓库无密钥

---

## 阶段 1：路由与壳层（约 1 小时）

- [x] **1.1** `app/layout.tsx` — 根布局、Provider 顺序、字体与主题
- [x] **1.2** `components/conditional-app-shell.tsx` — 登录页无顶栏、Profile 顶栏、`ProjectProvider` 挂载范围
- [x] **1.3** `components/main-nav.tsx`、`bottom-nav.tsx`、`mobile-nav.tsx` — 未登录隐藏项、`promptLogin` 与受保护路由一致
- [x] **1.4** `app/**/layout.tsx`（`app/admin/layout.tsx`、`app/community/layout.tsx`、`app/messages/layout.tsx`、`app/playground/layout.tsx`、`app/settings/layout.tsx`、`app/profile/layout.tsx`、`app/users/[id]/layout.tsx`、`app/share/layout.tsx`、`app/shop/layout.tsx`、`app/coins/layout.tsx`）— 与壳层无重复/冲突

---

## 阶段 2：认证与账户安全（约 1～2 小时）

- [x] **2.1** `app/login/page.tsx` + `app/auth/callback/route.ts` — 登录 UX、回调、Session、登出
- [x] **2.2** `app/api/auth/sms/send`、`verify`、`password/change` — SMS 与改密流程
- [x] **2.3** `app/settings/security/page.tsx` + 上述 API — 错误提示、限流（对照 `docs/SECURITY_RATE_LIMIT.md`）

---

## 阶段 3：核心业务页面（探索 / 项目 / 分享 / 社区）

审每页时建议自检：加载/空/错、权限、控制台无 error、数据与隐私、移动端；并对照相关 `lib/api/*`、`context/*`、API Route。

### 3.1 首页与落地

- [x] **P-01** `/` — `app/page.tsx` — 首页 Feed；LCP、数据获取与缓存、`ProjectProvider` 数据流
- [x] **P-02** `/login` — `app/login/page.tsx` — 登录；壳层、重定向、错误态
- [x] **P-03** `/migrate` — `app/migrate/page.tsx` — 迁移/引导；可见性、幂等、无副作用重复执行

### 3.2 探索与项目

- [x] **P-10** `/explore` — `app/explore/page.tsx` — 探索列表；筛选/分页、`lib/api/explore-data.ts`、`lib/api/categories.ts`、空态与加载
- [x] **P-11** `/project` — `app/project/page.tsx` — 项目入口；与 `/explore` 职责是否重叠
- [x] **P-12** `/project/[id]` — `app/project/[id]/page.tsx` — 项目详情；点赞/评论、404、SEO metadata
- [x] **P-13** `/project/pixel-art` — `app/project/pixel-art/page.tsx` — 像素画；性能、保存
- [x] **P-14** `/project/color-lab` — `app/project/color-lab/page.tsx` — 色彩实验；状态与路由
- [x] **P-15** `/share` — `app/share/page.tsx` — 发布；未登录、表单校验、`lib/api/validation.ts`、上传

### 3.3 用户与资料

- [x] **P-20** `/profile` — `app/profile/page.tsx` — 我的；`profile/layout`、gamification
- [x] **P-21** `/users/[id]` — `app/users/[id]/page.tsx` — 他人主页；隐私、关注、`app/api/users/[id]/*`

### 3.4 社区

- [x] **P-30** `/community` — `app/community/page.tsx` — 社区首页；列表性能、标签、`context/community-context.tsx`、`app/api/discussions*`
- [x] **P-31** `/community/discussion/[id]` — `app/community/discussion/[id]/page.tsx` — 讨论详情；评论/回复/点赞、权限
- [x] **P-32** `/community/challenge/[id]` — `app/community/challenge/[id]/page.tsx` — 挑战；参与、提交、`app/api/challenges/*`
  - [x] 挑战评分仅允许针对已审核通过的挑战作品，避免绕过页面约束给普通项目写入 challenge rating

---

## 阶段 4：社交、消息、排行榜、商店与金币

关注：权限、分页/虚拟列表、乐观更新与回滚、通知与未读数。

### 4.1 消息

- [x] **P-40** `/messages` — `app/messages/page.tsx` — 会话列表；`app/messages/layout.tsx`、Tab、未登录、未读同步
- [x] **P-41** `/messages/[userId]` — `app/messages/[userId]/page.tsx` — 单聊；实时/轮询、发送 API、线程拉取与回退

### 4.2 排行榜、商店、金币

- [x] **P-50** `/leaderboard` — `app/leaderboard/page.tsx` — 排行榜；登录可见与导航一致、API 分页
  - [x] `main-nav` / `mobile-nav` 不再把 `/leaderboard` 误判为受保护路由，和实际公开页面保持一致
- [x] **P-51** `/shop` — `app/shop/page.tsx` — 商店；兑换、错误处理
- [x] **P-52** `/coins` — `app/coins/page.tsx` — 金币/积分；与 `docs/GAMIFICATION.md` 一致

---

## 阶段 5：设置、法务、版主、管理端

### 5.1 设置与法务

- [x] **P-60** `/settings` — `app/settings/page.tsx` — 设置首页；子路由入口完整
- [x] **P-61** `/settings/profile` — `app/settings/profile/page.tsx` — 资料；校验、头像上传
- [x] **P-62** `/settings/appearance` — `app/settings/appearance/page.tsx` — 外观；`next-themes` 一致
- [x] **P-63** `/settings/notifications` — `app/settings/notifications/page.tsx` — 通知偏好；与 notifications API
- [x] **P-64** `/settings/privacy` — `app/settings/privacy/page.tsx` — 隐私；字段与 DB/RLS
- [x] **P-65** `/settings/security` — `app/settings/security/page.tsx` — 安全；改密、手机（与阶段 2 可合并审）
- [x] **P-66** `/settings/about` — `app/settings/about/page.tsx` — 关于；外链有效
- [x] **P-67** `/legal/terms` — `app/legal/terms/page.tsx` — 用户协议；文案与版本
- [x] **P-68** `/legal/privacy` — `app/legal/privacy/page.tsx` — 隐私政策

### 5.2 版主与管理端

- [x] **P-70** `/moderator/apply` — `app/moderator/apply/page.tsx` — 版主申请；`moderator/eligibility`、重复提交
- [x] **P-80** `/admin` — `app/admin/page.tsx` — 管理首页；`app/admin/layout.tsx`、权限门闸
- [x] **P-81** `/admin/projects/[id]` — `app/admin/projects/[id]/page.tsx` — 项目审核；review、completion review API
- [x] **P-82** `/admin/moderator-applications` — `app/admin/moderator-applications/page.tsx` — 版主审核列表与状态 API

---

## 阶段 6：游乐场与设计演示

关注：纯客户端状态、localStorage/同步、无障碍与移动端。

### 6.1 游乐场横切

- [x] **PG-LAYOUT** `app/playground/layout.tsx` — 侧栏、游戏列表、`usePlaygroundSync`、清除云端/本地
- [x] **PG-STORAGE** `lib/playground/storage.ts` — 与布局/同步一致、无脏数据风险

### 6.2 各子游戏

- [x] **PG-00** `/playground` — `app/playground/page.tsx` — 游乐场首页
- [x] **PG-01** `/playground/minesweeper` — `app/playground/minesweeper/page.tsx` — 扫雷；边界、首次点击
- [x] **PG-02** `/playground/minesweeper/course` — `app/playground/minesweeper/course/page.tsx` — 扫雷教程
- [x] **PG-03** `/playground/gomoku` — `app/playground/gomoku/page.tsx` — 五子棋；AI、性能
- [x] **PG-04** `/playground/life` — `app/playground/life/page.tsx` — 生命游戏；画布、大网格
- [x] **PG-05** `/playground/2048` — `app/playground/2048/page.tsx` — 2048；`use2048`、键盘与触控
- [x] **PG-06** `/playground/24game` — `app/playground/24game/page.tsx` — 24 点；表达式校验
- [x] **PG-07** `/playground/hanoi` — `app/playground/hanoi/page.tsx` — 汉诺塔；动画与状态
- [x] **PG-08** `/playground/sorting` — `app/playground/sorting/page.tsx` — 排序可视化；取消/重置
- [x] **PG-09** `/playground/sudoku` — `app/playground/sudoku/page.tsx` — 数独
- [x] **PG-10** `/playground/nqueens` — `app/playground/nqueens/page.tsx` — N 皇后
- [x] **PG-11** `/playground/circuit` — `app/playground/circuit/page.tsx` — 电路拼图；持久化

### 6.3 工具 / 演示页

- [x] **X-01** `/design-system` — `app/design-system/page.tsx` — 设计系统展示
- [x] **X-02** `/badges-preview` — `app/badges-preview/page.tsx` — 徽章预览；生产是否需屏蔽

---

## 阶段 7：API Route（按域，与页面对照）

每项建议过一遍：**鉴权 → 输入校验 → 业务不变量 → 错误码 → 限流/滥用**。

### 7.1 认证

- [x] **A-01** `app/auth/callback/route.ts` — OAuth / Supabase 回调
  - [x] `exchangeCodeForSession` / provider 回调失败时重定向回 `/login` 并透出错误态，避免静默跳转造成“登录失败但回首页”的假成功体验
- [x] **A-02** `app/api/auth/sms/send/route.ts` — 发短信
- [x] **A-03** `app/api/auth/sms/verify/route.ts` — 验证短信
- [x] **A-04** `app/api/auth/password/change/route.ts` — 修改密码

### 7.2 用户与关注

- [x] **U-01** `app/api/users/[id]/route.ts`
- [x] **U-02** `app/api/users/[id]/steam-radar/route.ts`
- [x] **U-03** `app/api/follows/route.ts`
- [x] **U-04** `app/api/follows/status/route.ts`
- [x] **U-05** `app/api/follows/count/route.ts`
- [x] **U-06** `app/api/following-feed/route.ts`

### 7.3 项目与完成态、上传

- [x] **PR-01** `app/api/projects/route.ts`
- [x] **PR-02** `app/api/projects/[id]/like/route.ts`
- [x] **PR-03** `app/api/projects/[id]/comments/route.ts`
- [ ] **PR-04** `app/api/completions/[id]/likes/route.ts`
- [ ] **PR-05** `app/api/completions/[id]/comments/route.ts`
- [ ] **PR-06** `app/api/completions/[id]/tips/route.ts`
- [x] **PR-07** `app/api/upload/route.ts`
- [ ] **PR-08** `app/api/upload-video/route.ts`

### 7.4 讨论与评论

- [ ] **D-01** `app/api/discussions/route.ts`
- [x] **D-02** `app/api/discussions/[id]/route.ts`
- [x] **D-03** `app/api/discussions/[id]/like/route.ts`
  - [x] 缺失讨论时使用 `maybeSingle()` 返回 404，避免 `single()` 无记录落成 500
- [ ] **D-04** `app/api/discussions/tags/route.ts`
- [ ] **C-01** `app/api/comments/route.ts`
- [ ] **C-02** `app/api/comments/[id]/route.ts`
- [x] **C-03** `app/api/comments/[id]/like/route.ts`
  - [x] 缺失评论时使用 `maybeSingle()` 返回 404，避免 `single()` 无记录落成 500
- [ ] **R-01** `app/api/replies/route.ts`
- [ ] **R-02** `app/api/replies/[id]/route.ts`
- [x] **R-03** `app/api/replies/[id]/like/route.ts`
  - [x] 复核回复点赞路由的不存在分支与 RPC 错误处理

### 7.5 挑战

- [x] **CH-01** `app/api/challenges/route.ts`
- [x] **CH-02** `app/api/challenges/[id]/route.ts`
- [x] **CH-03** `app/api/challenges/[id]/participation/route.ts`
- [x] **CH-04** `app/api/challenges/[id]/submissions/route.ts`
- [x] **CH-05** `app/api/challenges/ratings/route.ts`
  - [x] 评分写入前校验目标项目必须是已审核通过的挑战作品，避免任意项目混入 `challenge_ratings`
- [x] **CH-06** `app/api/challenges/ratings/[projectId]/route.ts`
  - [x] 评分汇总读取同样复用挑战作品校验，避免暴露非挑战项目的 challenge rating 数据

### 7.6 消息

- [x] **M-01** `app/api/messages/conversations/route.ts`
- [x] **M-02** `app/api/messages/send/route.ts`
- [x] **M-03** `app/api/messages/threads/[userId]/route.ts`

### 7.7 通知

- [x] **N-01** `app/api/notifications/route.ts`
- [x] **N-02** `app/api/notifications/unread-count/route.ts`
- [x] **N-03** `app/api/notifications/mark-read/route.ts`
- [x] **N-04** `app/api/notifications/mark-all-read/route.ts`
- [x] **N-05** `app/api/notifications/clear/route.ts`

### 7.8 排行榜、打赏、举报

- [x] **L-01** `app/api/leaderboard/route.ts`
- [ ] **T-01** `app/api/tips/route.ts`
- [ ] **T-02** `app/api/tips/my/route.ts`
- [ ] **RP-01** `app/api/reports/route.ts`
- [ ] **RP-02** `app/api/admin/reports/route.ts`
- [x] **RP-03** `app/api/admin/reports/[id]/route.ts`

### 7.9 管理端

- [ ] **AD-01** `app/api/admin/users/route.ts`
- [ ] **AD-02** `app/api/admin/tags/route.ts`
- [ ] **AD-03** `app/api/admin/tags/[id]/route.ts`
- [x] **AD-04** `app/api/admin/challenges/route.ts`
- [x] **AD-05** `app/api/admin/challenges/[id]/route.ts`
- [x] **AD-06** `app/api/admin/challenges/[id]/status/route.ts`
- [ ] **AD-07** `app/api/admin/projects/[id]/review/route.ts`
- [ ] **AD-08** `app/api/admin/completions/[id]/review/route.ts`

### 7.10 版主

- [x] **MO-01** `app/api/moderator/eligibility/route.ts`

---

## 阶段 8：功能横切（非单页）

- [ ] **X-AUTH** `context/auth-context.tsx`、`context/login-prompt-context.tsx` — 未登录操作与导航一致
- [ ] **X-COMMUNITY** `context/community-context.tsx` — 社区页状态、筛选条件与 API 请求一致
- [ ] **X-GAME** `context/gamification-context.tsx`、`docs/GAMIFICATION.md` — 积分与 UI 同步
- [x] **X-NOTIF** `components/notification-bell.tsx`、`context/notification-context.tsx` — 轮询/实时、未读数
  - [x] 轮询合并第一页新通知时保持 `hasMore` 已完成状态，不重复打开“继续加载”
- [ ] **X-PROJ** `context/project-context.tsx` — 与 `ConditionalAppShell` 挂载范围一致
- [ ] **X-SEARCH** `components/header-search.tsx` — 防抖、空结果、跳转
- [ ] **X-UPLOAD** `components/ui/image-upload.tsx` + upload API — 大小、类型、失败重试
- [x] **X-VALIDATION** `lib/api/validation.ts`、`lib/api/rate-limit.ts`、`lib/api/auth-rate-limit.ts` — 共享校验与限流策略未漂移
- [ ] **X-REPORT** `app/api/reports/route.ts` + UI（grep `reports`）— 频率、重复举报
- [ ] **X-I18N** 全站抽检 — 中英文混排、外链合法

---

## 阶段 9：横切收尾

- [ ] **9.1** `lib/supabase/types.ts` — 与查询/写入字段一致
- [ ] **9.2** `docs/supabase-security-inventory.md` + RLS 假设 — 与 API 行为一致
- [ ] **9.3** 性能抽检 — 大列表、图片/视频、Recharts 等无 obvious 回归
- [ ] **9.4** `__tests__/api.discussions-route.test.ts`、`__tests__/api.completion-review-route.test.ts`、`__tests__/badges.test.ts`、`e2e/smoke.spec.ts`、`e2e/messages.spec.ts`、`e2e/integration/core-flow.spec.ts`、`e2e/integration/community-like-persist.spec.ts`、`lib/testing/playwright-smoke.ts` — 主流程有覆盖或缺口已记录

---

## 维护说明

- [ ] （维护者）新增 `app/**/page.tsx` 时在本文件对应阶段追加 `- [ ]` 行并带 **ID**
- [ ] （维护者）新增 `app/api/**/route.ts` 时在阶段 7 追加条目
- [ ] （维护者）路由以仓库为准，定期 diff `app/` 与本清单

### Issue 记录格式（建议）

发现问题时，建议在独立 review 文档、PR comment 或 issue 中统一按以下格式记录：

```md
### [严重级别] 标题
- 文件：`app/...`
- 行号：`123`
- 现象：一句话描述看到的行为 / 风险
- 原因：为什么这是 bug、回归或实现缺口
- 建议：修复方向；如有需要补充复现步骤
```

**严重级别建议**

- `S0`：权限绕过、数据泄露、金额/积分错误、可导致生产事故
- `S1`：主流程失败、明显功能错误、服务端校验缺失
- `S2`：边界条件、状态同步、体验回退、日志噪音
- `S3`：文案、可维护性、小型一致性问题

### 单项完成标准

满足以下条件再把 `- [ ]` 改为 `- [x]`：

- 已读完对应页面 / Route / 关联上下游代码，不只看单文件
- 如发现问题，已记录 issue，附文件路径与行号
- 已确认主流程、空态、错误态、权限或鉴权路径
- 如涉及写操作，已检查输入校验、幂等、错误码与限流
- 如涉及 UI，已至少看一遍移动端或窄屏表现

### 同步清单命令

当怀疑本文件与仓库路由不一致时，可先跑：

```bash
find app -type f \( -name 'page.tsx' -o -name 'route.ts' -o -name 'layout.tsx' \) | sort
```

按类型拆开看时，可分别跑：

```bash
find app -type f -name 'page.tsx' | sort
find app -type f -name 'route.ts' | sort
find app -type f -name 'layout.tsx' | sort
```

必要时再对照本文件手动补充阶段 / 条目 / ID，避免新增页面或 API 漏审。

---

*基于 Next.js App Router 的 `app/` 梳理；以当前分支实际文件为准增量更新。*
