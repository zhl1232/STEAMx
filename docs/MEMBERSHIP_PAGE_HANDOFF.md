# 探索会员介绍页交接

## 范围与依据

- 页面路由：`/membership`；桌面全站页脚「会员服务说明」为入口。
- 开发基线：远端 `main`，`bbcdaddd417feba086f0683aa1bd3e6c5878d96a`。
- 内容依据：[经营方案文档](https://github.com/zhl1232/STEAMx/blob/fe81bdf8f308830c1425a705de48c05d9bf4dfbd/docs/ALIPAY_MEMBERSHIP_BUSINESS_DESCRIPTION_DRAFT.md)，以及本次用户对方案与页面开发的确认。文档保留原分支，不合并到 main。
- 仅新增公开说明页与局部样式、页脚入口及项目索引。没有新增依赖、支付按钮、外部支付跳转或交易接口，没有改动权限、额度、数据库、workflow 或部署配置。
- 页面不依赖用户身份，登录与未登录均可阅读全部说明。反馈链接复用 `/about#feedback`；未登录用户按既有流程登录，已登录用户进入现有反馈对话框。

## 开售前仍须完成

页面始终标明「尚未开放购买」「计划提供」。此次交付不证明支付产品获批或交易闭环可用，也不代表以下代码已实现：

1. **额度周期差异**：现有 `lib/membership.ts` 及 AI credits 数据库逻辑按北京时间自然月重置。拟销售方案为从实际开通起 30 天、每个购买周期总共 1500 点，跨月不重复发放，余额不结转。本次没有修改或运行相关迁移；必须另行实现并验证跨月、到期、续购、退款场景后才能开售。
2. 核实支付宝主体、产品审批、会员收款适用性及真实支付/退款闭环。本次没有操作任何交易。
3. 核验账号对应、24 小时人工开通、状态与到期展示，以及工作日 9–18 时（北京时间）、2 工作日首次回复的执行能力。
4. 核验退款流程：7 日内未使用付费权益全退；其他按实际履约依法核实并说明；确认后 5 工作日内发起原路退款。正式服务条款须与实际履约一致。

## 发布边界

2026-10-11 已检查全部 `.github/workflows/`：`ci.yml` 为 `workflow_call` 与面向 main 的 PR；`release.yml` 为 main push、v* tag 与手动触发；内容清理工作流只对 main 指定路径 push 或手动触发；其余运维工作流均手动触发。仅推送独立 feature branch，不创建 PR、tag，不 force push、不修改 main、不部署。

## 验证

使用独立 checkout，依赖按现有 lockfile 安装。测试环境仅用 `127.0.0.1` Supabase 地址和明确的 placeholder key；浏览器登录态使用虚构用户与本地拦截，不代表真实会员开通记录。

- `pnpm run lint`：退出 0，已有 React 警告；新增会员页无警告。
- `pnpm run type-check`：通过。
- `pnpm exec vitest run --maxWorkers=4`：415 文件通过，1 文件失败，1 文件跳过；2222 项通过，3 项失败，31 项跳过。失败全部在未改动的 `__tests__/ldraw-packer.test.ts`，mock 的 `${process.cwd()}/scripts/ldraw-models` 与 Windows 下实现传入的反斜杠路径不匹配，抛出 ENOENT。本次不修改无关 LDraw 测试或实现。
- `node --test scripts/check-seo.test.mjs`：7 项通过。
- Chrome 实际 UI：1440×900 与 390×900、未登录和本地模拟登录共四组均通过。检查 HTTP 200、标题、未开放购买提示、无购买按钮、无横向溢出、全部 6 个页内链接的 Tab 焦点和可见焦点样式、服务锚点跳转、反馈链接与两种身份的对话框；无浏览器 pageerror。免费探索与课程链接指向现有路由，本次未验收其全部内容功能。
- 已人工查看桌面与手机整页截图，调整手机免费课程区为自然换行后重跑四组验收。截图与假会话脚本保存在任务目录 `membership-evidence/`，未将其作为真实会员或交易凭证。
- 标准 `pnpm run build`：Scratch webpack 构建及复制通过；Next Turbopack 构建因 Windows `os error 112`（磁盘空间不足）失败，不能标记完整 build 通过。
- 关闭本任务 dev、仅清理本 checkout 的 `.next` 缓存后，`pnpm exec next build --webpack` **完整通过（退出 0）**：编译、类型检查、161 个静态页生成和 standalone 跟踪完成，`/membership` 为静态页。仍使用假 Supabase 配置，数据驱动页面出现预期的本地连接拒绝日志；此构建不证明生产数据集成通过。项目默认构建配置未改动。

未使用真实账号做开通、支付、额度扣减或退款验收，未调用生产数据库写入。
