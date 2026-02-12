# 将本项目部署到 Cloudflare

本项目使用 **Next.js 16** 与 **Supabase**，部署到 Cloudflare 采用 [OpenNext Cloudflare](https://opennext.js.org/cloudflare) 适配器，运行在 **Cloudflare Workers** 上（支持 SSR、API 路由、Server Components）。

> 注意：旧的 `@cloudflare/next-on-pages` 已弃用，官方推荐使用 OpenNext。

---

## 一、前置要求

- Node.js 18+
- pnpm 8+
- [Cloudflare 账号](https://dash.cloudflare.com/sign-up)
- 已配置好的 Supabase 项目（见 README 中的「配置 Supabase」）

---

## 二、安装依赖

在项目根目录执行：

```bash
pnpm install
```

本项目已在 `package.json` 中加入：

- `@opennextjs/cloudflare`：Next.js → Cloudflare Workers 适配
- `wrangler`（devDependency）：Cloudflare CLI，版本需 ≥ 3.99.0

---

## 三、环境变量（必填）

部署到 Cloudflare 后，必须在 Worker 里配置下面两个变量，否则登录、数据都会失败。

### 在 Cloudflare 控制台要填什么

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → 点击你的 Worker（名字是 `steam-explore-share`，或你部署后看到的那个）
2. 进入 **Settings** → **Variables and Secrets**
3. 在 **Environment Variables** 里点 **Add**，按下面**逐条添加**：

| 变量名（照抄） | 值从哪里来 | 说明 |
|----------------|------------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 控制台 → Project Settings → API → **Project URL**，一整段 `https://xxxxx.supabase.co` | 必填 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 同上页 → **Project API keys** 里的 **anon public** 那一长串 | 必填 |

**示例（仅作格式参考，不要用下面的假值）：**

- 变量名：`NEXT_PUBLIC_SUPABASE_URL`  
  值：`https://abcdefghijk.supabase.co`

- 变量名：`NEXT_PUBLIC_SUPABASE_ANON_KEY`  
  值：`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxx...`（很长的一串）

Supabase 控制台路径：<https://app.supabase.com> → 选你的项目 → **Project Settings**（左下齿轮）→ **API**。

### 可选：管理员相关

如果用到「管理员审核项目、后台」等需要 **service_role** 的功能，再额外加一条：

| 变量名 | 值从哪里来 |
|--------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → **Project API keys** 里的 **service_role**（注意保密，不要暴露到前端） |

不加的话，普通浏览、登录、发帖、评论都只靠上面两个变量即可。

---

## 四、CI/CD 部署（推荐）

只通过 Git 推送触发部署，无需在本地跑 `wrangler`。

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Workers** → **Deploy with Git**
2. 连接 GitHub/GitLab 仓库，选择本仓库和要部署的分支
3. **构建配置**（界面里「构建命令」和「部署命令」分开时，按下面填）：

   | 配置项 | 要填的值 |
   |--------|----------|
   | **构建命令** | `pnpm install && pnpm exec opennextjs-cloudflare build` |
   | **部署命令** | `pnpm exec opennextjs-cloudflare deploy` |
   | **路径** | `/`（项目根目录，保持默认即可） |
   | **非生产分支部署命令** | 可选；若要预览分支，可填 `pnpm exec opennextjs-cloudflare deploy` |

   **不要**用默认的 `pnpm run build` 和 `npx wrangler deploy`：本项目用 OpenNext，必须先跑 `opennextjs-cloudflare build` 生成 `.open-next/`，再用 `opennextjs-cloudflare deploy` 部署。

4. 环境变量已在控制台配好的话，CI 会用同一套；若在 Git 集成里也有 **Variables**，变量名同上（`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`）。
5. 保存后，推送到该分支即自动构建并部署。

---

## 五、配置说明

### 仓库内与 Cloudflare 相关的文件

| 文件 | 说明 |
|------|------|
| `wrangler.jsonc` | Wrangler 配置：Worker 名、兼容性、静态资源、自引用 Service 等（CI 构建时会用） |
| `public/_headers` | 静态资源缓存：`/_next/static/*` 长期缓存 |
| `.gitignore` | 已加入 `.open-next`（构建产物，不提交） |

### 可选：图片优化（Next.js Image）

若要用 Cloudflare 的图片优化，需在 Cloudflare 控制台开通 **Images**，并在 `wrangler.jsonc` 中取消注释 `images` 配置，详见 [OpenNext - Image Optimization](https://opennext.js.org/cloudflare/howtos/image)。

### 可选：ISR/缓存（R2）

若要用 Next.js 的增量静态再生成（ISR）或缓存到 R2，需要：

1. 在 Cloudflare 创建 R2 存储桶
2. 在 `wrangler.jsonc` 中配置 `r2_buckets` 的 `NEXT_INC_CACHE_R2_BUCKET`
3. 可选：在项目根目录添加 `open-next.config.ts`，使用 `@opennextjs/cloudflare` 的 R2 incremental cache

详见 [OpenNext - Caching](https://opennext.js.org/cloudflare/caching)。

---

### Worker 体积限制

- **免费版**：Worker 压缩后约 3 MiB
- **付费版**：约 10 MiB

若构建后体积超限，可考虑：

- 升级 Workers 计划
- 减少依赖或做代码分割
- 查看 [OpenNext - Known issues](https://opennext.js.org/cloudflare/known-issues) 与 [Troubleshooting](https://opennext.js.org/cloudflare/troubleshooting)

---

## 六、常用脚本（CI 相关）

| 命令 | 说明 |
|------|------|
| `pnpm run deploy:cf` | 构建并部署到 Cloudflare（CI 中执行） |
| `pnpm run build` | 仅 Next.js 构建（本地开发或非 Cloudflare 时用） |

---

## 七、参考链接

- [OpenNext - Cloudflare](https://opennext.js.org/cloudflare)
- [OpenNext - Get Started (Cloudflare)](https://opennext.js.org/cloudflare/get-started)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
