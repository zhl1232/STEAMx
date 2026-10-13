# 创探空间

帮家长陪孩子找项目、动手做：搭积木、做小实验、学编程，去自然里观察。

## 从哪里开始

- 找实现位置：[项目索引](PROJECT_INDEX.md)。
- 查现行规则：[文档导航与唯一来源](docs/README.md)。
- 看产品方向和任务：[产品方向](docs/product-direction.md)、[下一步](docs/next-step.md)。

README 只负责介绍和启动，不另行维护会员额度、登录规则、页面按钮或生产发布状态。对外品牌常量在 `lib/brand.ts`，搜索身份在 `lib/seo/site.ts`；首页各尺寸的入口与验收口径见 [SEO 索引清单](docs/seo-indexing-checklist.md)。

## 技术与模块

Next.js 16、React 19、TypeScript、Tailwind CSS、shadcn/ui、TanStack Query；数据与认证使用 Supabase 兼容服务，应用以 Docker 方式部署。

模块包括探索项目、技能课程、自然观察、PBL 挑战、统一作品、游乐场、个人成长和管理后台。不在本页维护游戏、徽章、课程或迁移数量；数量应从相应版本的代码或真实数据核对。

## 本地启动

开发环境与 CI 对齐使用 Node.js 22、pnpm 10.22.0。在项目根目录：

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
# 编辑 .env.local，使用获准的开发环境配置，勿复制生产凭据。
pnpm dev
```

默认开发地址为 `http://localhost:3000`。前端至少需要有效的 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_ANON_KEY`；假地址只适用于明确隔离的测试，不保证数据页面、登录或接口可用。服务端功能还需要各自的配置，逐项参照 `.env.example` 和专项文档。

### 完整后端不是“创建任意 Supabase 项目即可”

当前迁移工具面向项目托管环境的 pg-meta `/pg/query` API，还需要服务端 `SUPABASE_SERVICE_ROLE_KEY`。官方托管实例不能仅凭品牌名称就被视为与当前迁移方式兼容。新建空库、接入已有库和日常升级是不同任务；启动前端不要求自动运行迁移，更不能给空库直接 baseline。

数据库准备、只读预检、写入授权和命令模式只在 [数据库连接与迁移](docs/database-psql.md) 维护。

## 开发与验证

```sh
pnpm run lint
pnpm run type-check
pnpm exec vitest run
pnpm run build
```

具体执行范围以 `package.json` 和 `.github/workflows/ci.yml` 为准。本地构建包含 Scratch；生产镜像的分层构建见 [部署说明](docs/deployment.md)。使用替身、占位配置的测试不代表真实账号、生产数据或供应商服务已验收。

修改前遵循 [AGENTS.md](AGENTS.md)，先读索引中的相关模块与其规则来源。规则变更更新对应专题文档，只有入口变化才增改索引；不要把交付日志重复贴入索引。项目使用根目录 `proxy.ts`，不要恢复 `middleware.ts`。

## 发布

应用发布见 [生产部署](docs/deployment.md)，课程模型资源发布见 [LDraw 发布](docs/ldraw-publishing.md)。修改文档、创建 PR 和合入生产是不同操作；合入 `main` 仍需本次授权，不能把此前授权沿用到新任务。

## 许可证

MIT License
