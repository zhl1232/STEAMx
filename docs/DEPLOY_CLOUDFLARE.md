# 将本项目部署到 Cloudflare

本项目使用 **Next.js 16**、**Supabase** 和 [OpenNext Cloudflare](https://opennext.js.org/cloudflare)，目标运行时是 **Cloudflare Workers**。

> 当前正式部署路径是 **GitHub Actions + OpenNext Cloudflare**，不再把 Cloudflare Dashboard Git 集成当作长期主路径。

---

## 一、前置要求

- Node.js 20+
- `pnpm@10.22.0`（见 `package.json` 的 `packageManager`）
- `wrangler@4.59.2+`（仓库当前已升级到 4.x）
- 已创建 Cloudflare 账号与 Worker 权限 Token
- 已准备 Supabase 项目

安装依赖：

```bash
pnpm install
```

---

## 二、必须准备的 GitHub Actions Secrets

以下值统一配置在 GitHub 仓库或 Environment 的 Secrets 中：

| 名称 | 必填 | 说明 |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | 是 | 用于部署 Worker 与同步 Secrets |
| `CLOUDFLARE_ACCOUNT_ID` | 是 | Cloudflare Account ID |
| `NEXT_PUBLIC_SUPABASE_URL` | 是 | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 是 | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | 否 | 仅在管理端 / 服务端写操作确实依赖时配置 |

> 当前 workflow 会在缺少必填 secret 时**明确失败**，不会静默跳过部署。

建议至少创建两个 GitHub Environments：

- `preview`
- `production`

---

## 三、仓库内置的工作流

### `CI / PR Checks`

文件：`.github/workflows/ci.yml`

每次 PR / `main` push 会执行：

- `pnpm lint`
- `pnpm tsc --noEmit`
- `pnpm exec jest --runInBand`
- `pnpm build`
- `pnpm exec opennextjs-cloudflare build`
- `pnpm exec playwright test e2e/smoke.spec.ts --project=chromium`

### `Preview Deploy`

文件：`.github/workflows/preview.yml`

- 触发：`pull_request` → `main`
- 构建：`pnpm exec opennextjs-cloudflare build --env preview`
- 部署：`pnpm exec opennextjs-cloudflare deploy --env preview`
- 目标 Worker：`steam-preview`
- 行为：部署完成后会把预览 URL 回写到 PR 评论

> 当前 preview 是一个**共享的 preview Worker**，适合内部/小范围协作；如果后续需要每个 PR 独立预览，再扩展为动态命名策略。

### `Release Deploy`

文件：`.github/workflows/release.yml`

- 触发：`push main` 或 `v*` tag
- 构建：`pnpm exec opennextjs-cloudflare build`
- 部署：`pnpm exec opennextjs-cloudflare deploy`
- 目标 Worker：`steam`

---

## 四、Cloudflare 运行时变量如何同步

Preview / Release workflow 在部署前会执行：

```bash
pnpm exec wrangler secret bulk ...
```

把 GitHub Actions 里的 Supabase 相关值同步到 Cloudflare Worker 运行时，因此：

- 构建期环境变量来自 GitHub Actions
- Worker 运行时变量也由同一套 Actions Secrets 驱动
- 不需要再维护一套独立的 Dashboard 变量作为正式来源

Cloudflare Dashboard 仍可用于查看当前 Worker 配置或临时排查，但不是主发布入口。

---

## 五、Wrangler / OpenNext 配置约定

### `wrangler.jsonc`

当前包含两套目标：

- 生产：`steam`
- 预览：`env.preview.name = "steam-preview"`

同时保留自引用 Service 绑定：

- 生产绑定到 `steam`
- Preview 绑定到 `steam-preview`

这样 `opennextjs-cloudflare build --env preview` 与 `deploy --env preview` 能对齐到同一个 preview Worker。

### 为什么仍保留 `middleware.ts`

- Next.js 16 把 `middleware` 重命名为 `proxy`
- 但 `proxy` 固定运行在 Node.js runtime
- 当前 OpenNext Cloudflare 兼容路径仍然依赖 Edge middleware

因此本仓库**继续保留** `middleware.ts`，仅承担 Supabase session 刷新等轻量边界逻辑；在 OpenNext Cloudflare 明确支持等价 `proxy` 路径前，不做迁移。

---

## 六、本地开发、CI smoke 与 Cloudflare 预览的差异

### 本地日常开发

```bash
pnpm dev
```

这仍然是 Next.js 本地开发服务器，不等同于 Cloudflare Workers runtime。

### 本地构建校验

```bash
pnpm build
pnpm exec opennextjs-cloudflare build
```

### Playwright smoke

Playwright 会自动给自启 dev server 注入：

- 占位 `NEXT_PUBLIC_SUPABASE_*`
- `PLAYWRIGHT_SMOKE=1`
- `NEXT_PUBLIC_PLAYWRIGHT_SMOKE=1`

对应地，公开页 smoke 会走仓库内的稳定 fixture，而不是访问真实 Supabase；目标是验证：

- 页面可达
- 无 500
- 无应用级崩溃
- 受保护路由仍会跳转登录页

这让 `/`、`/explore`、`/shop` 的 smoke 在离线或无真实 Supabase 时仍可重复执行。

---

## 七、常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm build` | Next.js 构建 |
| `pnpm exec opennextjs-cloudflare build` | 构建 Cloudflare Worker 产物 |
| `pnpm run deploy:cf` | 本地手动构建并部署（排障用） |
| `pnpm exec playwright test e2e/smoke.spec.ts --project=chromium` | 运行离线 smoke |

---

## 八、参考链接

- [OpenNext - Cloudflare](https://opennext.js.org/cloudflare)
- [Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
